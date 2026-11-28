// Environment accounts and the onboarding health check (docs/06 §2.4 env_accounts, §2.10, §10.3; 01
// §11 steps 3–4). Secrets are sealed like connector credentials (workspace_secret: Bot side, never
// personal) and responses carry no secret at all. Every sign-in the Bot tries is an env_login node of a
// health_check flow run by a Bot executor; when the node ends its results are written back to the
// accounts here, and a secret that only existed for a try before saving is destroyed.
import {
  parseCookieInput,
  type CreateEnvAccountRequest,
  type EnvAccountRow,
  type EnvLoginResult,
  type EnvLoginTarget,
  type HealthCheckResponse,
  type UpdateEnvAccountRequest,
} from '@cloudcraft/core-protocol';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ActorCtx, Db, Tx } from '../db/client.ts';
import {
  connectors,
  envAccounts,
  environments,
  flowInstances,
  projects,
  repoTargets,
  secretItems,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan, type PlanNode } from '../orchestrator/advance.ts';
import { pgOrchestrator } from '../orchestrator/flow.ts';
import { ApiFailure } from './errors.ts';
import { inWorkspace } from './iam-service.ts';
import { sealSecret } from './secrets.ts';
import { need, projectRepoSpecs, repoRows, type SourceSettings } from './source-service.ts';

const MANAGE = 'core:projects:manage';
export const ENV_LOGIN = 'env_login';

type AccountRow = typeof envAccounts.$inferSelect;

function rowOf(a: AccountRow, hint: string): EnvAccountRow {
  return {
    id: a.id,
    environment_id: a.environmentId,
    role_name: a.roleName,
    account_name: a.accountName,
    credential_type: a.credentialType as EnvAccountRow['credential_type'],
    data_permission: a.dataPermission as EnvAccountRow['data_permission'],
    hint,
    login: {
      state: a.loginState as EnvAccountRow['login']['state'],
      at: a.loginAt?.toISOString() ?? null,
      error: a.loginError,
      identity: a.identity,
      expires_at: a.expiresAt?.toISOString() ?? null,
    },
  };
}

async function accountRows(tx: Tx, where: ReturnType<typeof and>) {
  const rows = await tx
    .select({ a: envAccounts, hint: secretItems.hint })
    .from(envAccounts)
    .innerJoin(secretItems, eq(secretItems.id, envAccounts.secretId))
    .where(and(isNull(envAccounts.deletedAt), where))
    .orderBy(asc(envAccounts.sortOrder), asc(envAccounts.createdAt));
  return rows.map((r) => rowOf(r.a, r.hint));
}

async function environmentOf(tx: Tx, projectId: string, envId: string) {
  const [e] = await tx
    .select()
    .from(environments)
    .where(
      and(
        eq(environments.id, envId),
        eq(environments.projectId, projectId),
        isNull(environments.deletedAt),
      ),
    );
  if (!e) throw new ApiFailure(404, 'environment.not_found');
  return e;
}

/** A password needs its account name; a cookie must hold at least one cookie. */
function checkInput(type: string, accountName: string | null | undefined, secret?: string) {
  if (type === 'password' && !accountName?.trim())
    throw new ApiFailure(400, 'env_account.name_required');
  if (type === 'cookie' && secret !== undefined && !parseCookieInput(secret).cookies.length)
    throw new ApiFailure(400, 'env_account.cookie_unreadable');
}

/** Sealed for storage; no hint, a password's tail is not something to show. */
const seal = (s: SourceSettings, secret: string) => ({
  ...sealSecret(s.masterKey, { secret }),
  hint: '',
});

const expiryOf = (type: string, secret: string) => {
  const at = type === 'cookie' ? parseCookieInput(secret).expires_at : null;
  return at ? new Date(at) : null;
};

/** Starts a health_check flow that signs in with the given targets (one env_login node). */
async function startLogin(tx: Tx, ctx: ActorCtx, projectId: string, targets: EnvLoginTarget[]) {
  const plan: Plan = {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    nodes: [loginNode(targets)],
  };
  return pgOrchestrator.startFlow(tx, ctx, { projectId, kind: 'health_check', plan });
}

const loginNode = (targets: EnvLoginTarget[]): PlanNode => ({
  key: ENV_LOGIN,
  kind: 'auto',
  node_kind: 'deterministic_verify',
  config: { action: ENV_LOGIN, targets },
});

async function targetsOf(tx: Tx, ids: string[]): Promise<EnvLoginTarget[]> {
  if (!ids.length) return [];
  const rows = await tx
    .select({ a: envAccounts, e: environments })
    .from(envAccounts)
    .innerJoin(environments, eq(environments.id, envAccounts.environmentId))
    .where(and(inArray(envAccounts.id, ids), isNull(envAccounts.deletedAt)))
    .orderBy(asc(environments.sortOrder), asc(envAccounts.sortOrder), asc(envAccounts.createdAt));
  return rows.map(({ a, e }) => ({
    account_id: a.id,
    environment_id: e.id,
    entry_url: e.entryUrl,
    credential_type: a.credentialType as EnvLoginTarget['credential_type'],
    ...(a.accountName ? { account_name: a.accountName } : {}),
    credential_ref: a.secretId,
  }));
}

export function listEnvAccounts(db: Db, userId: string, ws: string, projectId: string) {
  return inWorkspace(db, userId, ws, async (tx) => ({
    items: await accountRows(tx, eq(envAccounts.projectId, projectId)),
    next_cursor: null,
    has_more: false,
  }));
}

/** Saves the account and lets the Bot try it right away (「保存并识别账号」). */
export function createEnvAccount(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  projectId: string,
  envId: string,
  req: CreateEnvAccountRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    await environmentOf(tx, projectId, envId);
    checkInput(req.credential_type, req.account_name, req.secret);
    const sealed = seal(s, req.secret);
    const secret = await insertRow(tx, ctx, secretItems, {
      credentialClass: 'workspace_secret',
      ciphertext: sealed.ciphertext,
      wrappedDek: sealed.wrappedDek,
      hint: sealed.hint,
    });
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(envAccounts)
      .where(eq(envAccounts.environmentId, envId))) as [{ n: number }];
    const a = await insertRow(tx, ctx, envAccounts, {
      projectId,
      environmentId: envId,
      roleName: req.role_name.trim(),
      accountName: req.credential_type === 'password' ? req.account_name!.trim() : null,
      credentialType: req.credential_type,
      secretId: secret.id,
      dataPermission: req.data_permission,
      expiresAt: expiryOf(req.credential_type, req.secret),
      sortOrder: n,
    } as never);
    const flowId = await startLogin(tx, ctx, projectId, await targetsOf(tx, [a.id]));
    return { account: rowOf(a, sealed.hint), flow_id: flowId };
  });
}

/**
 * Changes an account; a new secret replaces the old ciphertext in place (the old one is gone, 06
 * §2.11) and the Bot tries the account again.
 */
export function updateEnvAccount(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  projectId: string,
  id: string,
  req: UpdateEnvAccountRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    const [old] = await tx
      .select()
      .from(envAccounts)
      .where(
        and(
          eq(envAccounts.id, id),
          eq(envAccounts.projectId, projectId),
          isNull(envAccounts.deletedAt),
        ),
      );
    if (!old) throw new ApiFailure(404, 'env_account.not_found');
    const type = req.credential_type ?? old.credentialType;
    if (type !== old.credentialType && !req.secret)
      throw new ApiFailure(400, 'env_account.secret_required');
    const name = type === 'password' ? (req.account_name ?? old.accountName) : null;
    checkInput(type, name, req.secret);
    if (req.secret) {
      const sealed = seal(s, req.secret);
      const [sec] = await tx.select().from(secretItems).where(eq(secretItems.id, old.secretId));
      await updateRow(tx, ctx, secretItems, old.secretId, {
        ciphertext: sealed.ciphertext,
        wrappedDek: sealed.wrappedDek,
        hint: sealed.hint,
        keyEpoch: (sec?.keyEpoch ?? 0) + 1,
      } as never);
    }
    const a = await updateRow(tx, ctx, envAccounts, id, {
      ...(req.role_name ? { roleName: req.role_name.trim() } : {}),
      ...(req.data_permission ? { dataPermission: req.data_permission } : {}),
      credentialType: type,
      accountName: name?.trim() ?? null,
      ...(req.secret
        ? {
            expiresAt: expiryOf(type, req.secret),
            loginState: 'unchecked',
            loginAt: null,
            loginError: null,
            identity: null,
          }
        : {}),
    } as never);
    const retry = !!req.secret || (req.account_name !== undefined && type === 'password');
    const flowId = retry ? await startLogin(tx, ctx, projectId, await targetsOf(tx, [id])) : null;
    const [{ hint }] = (await tx
      .select({ hint: secretItems.hint })
      .from(secretItems)
      .where(eq(secretItems.id, a.secretId))) as [{ hint: string }];
    return { account: rowOf(a, hint), flow_id: flowId };
  });
}

/** Soft delete (06 §2.11): the account can come back; its secret stays sealed until purged. */
export function deleteEnvAccount(
  db: Db,
  userId: string,
  ws: string,
  projectId: string,
  id: string,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    const [a] = await tx
      .select()
      .from(envAccounts)
      .where(and(eq(envAccounts.id, id), eq(envAccounts.projectId, projectId)));
    if (!a || a.deletedAt) throw new ApiFailure(404, 'env_account.not_found');
    await updateRow(tx, ctx, envAccounts, id, { deletedAt: sql`now()` } as never);
    return { ok: true };
  });
}

/** The Bot tries the project's accounts again (all of them, or the given ones). */
export function checkEnvAccounts(
  db: Db,
  userId: string,
  ws: string,
  projectId: string,
  ids?: string[],
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    const all = await tx
      .select({ id: envAccounts.id })
      .from(envAccounts)
      .where(and(eq(envAccounts.projectId, projectId), isNull(envAccounts.deletedAt)));
    const pick = all.map((x) => x.id).filter((x) => !ids || ids.includes(x));
    if (!pick.length) throw new ApiFailure(409, 'env_account.none');
    return { flow_id: await startLogin(tx, ctx, projectId, await targetsOf(tx, pick)) };
  });
}

/**
 * 「保存前试登录」: the Bot tries an account that is not saved. Its secret is sealed only for this try
 * and destroyed when the try ends (loginFinished); the result is read from the flow.
 */
export function tryEnvAccount(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  projectId: string,
  envId: string,
  req: CreateEnvAccountRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    const e = await environmentOf(tx, projectId, envId);
    checkInput(req.credential_type, req.account_name, req.secret);
    const sealed = seal(s, req.secret);
    const secret = await insertRow(tx, ctx, secretItems, {
      credentialClass: 'workspace_secret',
      ciphertext: sealed.ciphertext,
      wrappedDek: sealed.wrappedDek,
      hint: '',
    });
    const flowId = await startLogin(tx, ctx, projectId, [
      {
        environment_id: e.id,
        entry_url: e.entryUrl,
        credential_type: req.credential_type,
        ...(req.credential_type === 'password' ? { account_name: req.account_name!.trim() } : {}),
        credential_ref: secret.id,
      },
    ]);
    return { flow_id: flowId };
  });
}

/** The secrets an env_login node of this plan may hand to its executor. */
export function envLoginRefs(plan: Plan): string[] {
  return plan.nodes
    .filter((n) => n.config?.action === ENV_LOGIN)
    .flatMap((n) => ((n.config?.targets ?? []) as EnvLoginTarget[]).map((t) => t.credential_ref));
}

/**
 * An env_login node ended (inside the executor's write-back transaction): results go onto the
 * accounts; a cookie account takes the identity the Bot found as its name; secrets made only for a
 * try before saving are destroyed whatever the outcome.
 */
export async function loginFinished(
  tx: Tx,
  ctx: ActorCtx,
  flowId: string,
  nodeKey: string,
  output: Record<string, unknown>,
) {
  if (nodeKey !== ENV_LOGIN) return;
  const [flow] = await tx.select().from(flowInstances).where(eq(flowInstances.id, flowId));
  if (!flow || flow.kind !== 'health_check') return;
  const node = (flow.plan as Plan).nodes.find((n) => n.key === ENV_LOGIN);
  const targets = (node?.config?.targets ?? []) as EnvLoginTarget[];
  const results = ((output.results ?? []) as EnvLoginResult[]).filter((r) =>
    targets.some((t) => t.credential_ref === r.credential_ref),
  );
  for (const r of results) {
    const t = targets.find((x) => x.credential_ref === r.credential_ref)!;
    if (!t.account_id) continue;
    const [a] = await tx.select().from(envAccounts).where(eq(envAccounts.id, t.account_id));
    // the secret changed after this try started: the result is not about the current one
    if (!a || a.deletedAt || a.secretId !== t.credential_ref) continue;
    await updateRow(tx, ctx, envAccounts, a.id, {
      loginState: r.state,
      loginAt: sql`now()`,
      loginError: r.error ?? null,
      identity: r.identity ?? null,
      ...(r.expires_at ? { expiresAt: new Date(r.expires_at) } : {}),
      ...(a.credentialType === 'cookie' && r.identity ? { accountName: r.identity } : {}),
    } as never);
  }
  for (const t of targets.filter((x) => !x.account_id))
    await updateRow(tx, ctx, secretItems, t.credential_ref, {
      ciphertext: null,
      wrappedDek: null,
      rotationState: 'revoked_purged',
    } as never);
}

/**
 * 「AI 体检」(01 §11 step 4): what is known without running anything, and per project one flow that
 * signs in with every account (if it has any) and then trial-builds its repos (if they are probed).
 */
export function healthCheck(db: Db, userId: string, ws: string): Promise<HealthCheckResponse> {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, MANAGE);
    const startedAt = new Date().toISOString();
    const conns = await tx
      .select({ name: connectors.name, status: connectors.status })
      .from(connectors)
      .where(and(eq(connectors.scope, 'workspace'), isNull(connectors.deletedAt)))
      .orderBy(asc(connectors.createdAt));
    const repoList = await repoRows(tx);
    const rw = repoList.filter((r) => r.access_mode === 'read_write');
    const envs = await tx
      .select({
        id: environments.id,
        name: environments.name,
        tier: environments.envTier,
        project: environments.projectId,
        accounts: sql<number>`(select count(*)::int from env_accounts a where a.environment_id = "environments"."id" and a.deleted_at is null)`,
      })
      .from(environments)
      .where(isNull(environments.deletedAt))
      .orderBy(asc(environments.sortOrder), asc(environments.createdAt));
    const projectIds = (
      await tx.select({ id: projects.id }).from(projects).where(isNull(projects.deletedAt))
    ).map((x) => x.id);
    const flows: HealthCheckResponse['flows'] = [];
    for (const projectId of projectIds) {
      const accounts = await tx
        .select({ id: envAccounts.id })
        .from(envAccounts)
        .where(and(eq(envAccounts.projectId, projectId), isNull(envAccounts.deletedAt)));
      const [hasTarget] = await tx
        .select({ id: repoTargets.id })
        .from(repoTargets)
        .where(and(eq(repoTargets.projectId, projectId), isNull(repoTargets.deletedAt)))
        .limit(1);
      const nodes: PlanNode[] = [];
      if (accounts.length)
        nodes.push(
          loginNode(
            await targetsOf(
              tx,
              accounts.map((a) => a.id),
            ),
          ),
        );
      let repoSpecs: Plan['repos'] = [];
      if (hasTarget)
        try {
          repoSpecs = await projectRepoSpecs(tx, projectId);
          nodes.push({
            key: 'trial_build',
            kind: 'auto',
            node_kind: 'deterministic_verify',
            config: { action: 'trial_build' },
          });
        } catch {
          // not probed yet: reported under facts.repos.not_probed, nothing to build
        }
      if (!nodes.length) continue;
      const plan: Plan = { plan_schema_version: PLAN_SCHEMA_VERSION, nodes, repos: repoSpecs };
      flows.push({
        project_id: projectId,
        flow_id: await pgOrchestrator.startFlow(tx, ctx, {
          projectId,
          kind: 'health_check',
          plan,
        }),
      });
    }
    return {
      started_at: startedAt,
      facts: {
        connectors: conns.map((c) => ({ name: c.name, enabled: c.status === 'enabled' })),
        repos: {
          read_write: rw.length,
          read_only: repoList.length - rw.length,
          not_probed: rw
            .filter((r) => r.probe.state !== 'done' || !r.settings?.build_command)
            .map((r) => r.path),
        },
        environments: envs.map((e) => ({
          id: e.id,
          name: e.name,
          tier: e.tier,
          accounts: e.accounts,
        })),
      },
      flows,
    };
  });
}
