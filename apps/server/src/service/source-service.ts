// Connectors, repositories, the probe and the trial build (docs/06 §2.4, §10.3; 01 §11 steps 1–2).
// Credentials go through the plugin in memory and are stored sealed (secrets.ts); responses only ever
// carry a hint. New repositories are read-only until someone makes them writable, which puts them in a
// project (1:1 by default) and probes them.
import {
  type CreateConnectorRequest,
  type RepoRow,
  type RepoSettings,
  type RepoSpec,
  type UpdateRepoRequest,
  type VerifyConnectorRequest,
} from '@cloudcraft/core-protocol';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ActorCtx, Db, Tx } from '../db/client.ts';
import {
  connectors,
  flowInstances,
  nodeRuns,
  projects,
  repoTargets,
  repos,
  secretItems,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan } from '../orchestrator/advance.ts';
import { pgOrchestrator } from '../orchestrator/flow.ts';
import { ApiFailure, pgCode } from './errors.ts';
import { inWorkspace, permissionsOf } from './iam-service.ts';
import { connectorOf, type ConnectorRegistry } from './plugins.ts';
import { probeRepo } from './probe.ts';
import { openSecret, sealSecret } from './secrets.ts';
import { grants } from '@cloudcraft/core-protocol';

export interface SourceSettings {
  masterKey: Buffer;
  connectors: ConnectorRegistry;
}

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function need(tx: Tx, userId: string, key: string) {
  if (!grants(await permissionsOf(tx, userId), key))
    throw new ApiFailure(403, 'auth.forbidden', { permission: key });
}

export function listPlugins(s: SourceSettings, category?: string) {
  return [...s.connectors.values()]
    .map((p) => p.manifest)
    .filter((m) => !category || m.category === category)
    .map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      config_schema: m.configSchema,
      auth_schema: m.authSchema,
    }));
}

export function verifyConnector(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  req: VerifyConnectorRequest,
) {
  return inWorkspace(db, userId, ws, async (tx) => {
    await need(tx, userId, 'core:connectors:manage');
    return connectorOf(s.connectors, req.plugin_id).verify(req.config, req.credential);
  });
}

const connectorRow = (c: typeof connectors.$inferSelect, hint: string) => ({
  id: c.id,
  plugin_id: c.pluginId,
  name: c.name,
  category: c.category,
  config: c.config as Record<string, unknown>,
  credential_hint: hint ? `•••• ${hint}` : '••••',
  status: c.status,
  rev: c.rev,
});

/** Verifies first; a connector whose credential does not work is not saved. */
export async function createConnector(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  req: CreateConnectorRequest,
) {
  const plugin = connectorOf(s.connectors, req.plugin_id);
  const check = await verifyConnector(db, s, userId, ws, req);
  if (!check.ok)
    throw new ApiFailure(400, 'connector.verify_failed', { error_raw: check.error_raw });
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const sealed = sealSecret(s.masterKey, req.credential);
    const secret = await insertRow(tx, ctx, secretItems, {
      credentialClass: 'shared_readonly',
      ciphertext: sealed.ciphertext,
      wrappedDek: sealed.wrappedDek,
      hint: sealed.hint,
    });
    const c = await insertRow(tx, ctx, connectors, {
      name: req.name,
      pluginId: plugin.manifest.id,
      category: plugin.manifest.category,
      config: req.config,
      secretId: secret.id,
    });
    return { ...connectorRow(c, sealed.hint), verify: check };
  });
}

export function listConnectors(db: Db, userId: string, ws: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const rows = await tx
      .select({ c: connectors, hint: secretItems.hint })
      .from(connectors)
      .leftJoin(secretItems, eq(secretItems.id, connectors.secretId))
      .where(isNull(connectors.deletedAt))
      .orderBy(asc(connectors.createdAt));
    return rows.map((r) => connectorRow(r.c, r.hint ?? ''));
  });
}

/** The connector with its credential opened, for one call in this request. */
async function opened(tx: Tx, s: SourceSettings, connectorId: string) {
  const [row] = await tx
    .select({ c: connectors, secret: secretItems })
    .from(connectors)
    .innerJoin(secretItems, eq(secretItems.id, connectors.secretId))
    .where(and(eq(connectors.id, connectorId), isNull(connectors.deletedAt)));
  if (!row || !row.secret.ciphertext || !row.secret.wrappedDek)
    throw new ApiFailure(404, 'connector.not_found');
  return {
    connector: row.c,
    plugin: connectorOf(s.connectors, row.c.pluginId),
    config: row.c.config as Record<string, unknown>,
    credential: openSecret(s.masterKey, {
      ciphertext: row.secret.ciphertext,
      wrappedDek: row.secret.wrappedDek,
    }),
  };
}

export function remoteRepos(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  connectorId: string,
  q: { search?: string; page: number; refresh: boolean },
) {
  return inWorkspace(db, userId, ws, async (tx) => {
    await need(tx, userId, 'core:projects:manage');
    const key = `${ws}:${connectorId}:${q.search ?? ''}:${q.page}`;
    const hit = cache.get(key);
    if (hit && !q.refresh && Date.now() - hit.at < CACHE_MS) return hit.value;
    const o = await opened(tx, s, connectorId);
    const r = await o.plugin.listRepos(o.config, o.credential, {
      search: q.search,
      page: q.page,
      perPage: 30,
    });
    const value = {
      items: r.items,
      next_cursor: r.has_more ? String(q.page + 1) : null,
      has_more: r.has_more,
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  });
}

/** New repositories join read-only (06 §10.3: no accidental write access). */
export function attachRepos(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  req: { connector_id: string; remote_ids: string[] },
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, 'core:projects:manage');
    const o = await opened(tx, s, req.connector_id);
    const out: string[] = [];
    for (const id of req.remote_ids) {
      const [existing] = await tx
        .select()
        .from(repos)
        .where(
          and(
            eq(repos.connectorId, req.connector_id),
            eq(repos.remoteRepoId, id),
            isNull(repos.deletedAt),
          ),
        );
      if (existing) {
        out.push(existing.id);
        continue;
      }
      const r = await o.plugin.getRepo(o.config, o.credential, id);
      const row = await insertRow(tx, ctx, repos, {
        connectorId: req.connector_id,
        remoteRepoId: r.remote_id,
        path: r.path,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch,
      });
      out.push(row.id);
    }
    return { items: await repoRows(tx, out) };
  });
}

/** The probe's guess without the bookkeeping kept next to it (link_deps). */
function detectedOf(meta: unknown): RepoSettings {
  const d = { ...(meta as RepoSettings & { link_deps?: string[] }) };
  delete d.link_deps;
  return d;
}

function effective(t: typeof repoTargets.$inferSelect | undefined): RepoSettings | null {
  if (!t?.autoDetectedMeta) return null;
  return { ...detectedOf(t.autoDetectedMeta), ...(t.manualOverrides as Partial<RepoSettings>) };
}

async function repoRows(tx: Tx, ids?: string[]): Promise<RepoRow[]> {
  const rs = await tx
    .select()
    .from(repos)
    .where(
      and(
        isNull(repos.deletedAt),
        ids
          ? inArray(repos.id, ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
          : undefined,
      ),
    )
    .orderBy(asc(repos.path));
  const ts = await tx.select().from(repoTargets).where(isNull(repoTargets.deletedAt));
  return rs.map((r) => {
    const t = ts.find((x) => x.repoId === r.id);
    const meta = t?.autoDetectedMeta as
      (RepoSettings & { link_deps?: string[] }) | null | undefined;
    return {
      id: r.id,
      connector_id: r.connectorId,
      remote_repo_id: r.remoteRepoId,
      path: r.path,
      clone_url: r.cloneUrl,
      access_mode: r.accessMode as RepoRow['access_mode'],
      project_id: t?.projectId ?? null,
      settings: effective(t),
      detected: meta ? detectedOf(meta) : null,
      manual_overrides: Object.keys((t?.manualOverrides as object) ?? {}),
      probe: {
        state: (t?.probeState ?? 'pending') as RepoRow['probe']['state'],
        at: t?.probedAt?.toISOString() ?? null,
        notes: t?.probeNotes ?? [],
      },
      rev: r.rev,
    };
  });
}

export function listRepos(db: Db, userId: string, ws: string) {
  return inWorkspace(db, userId, ws, async (tx) => ({
    items: await repoRows(tx),
    next_cursor: null,
    has_more: false,
  }));
}

async function runProbe(
  tx: Tx,
  ctx: ActorCtx,
  s: SourceSettings,
  repo: typeof repos.$inferSelect,
  target: typeof repoTargets.$inferSelect,
) {
  if (!repo.connectorId || !repo.remoteRepoId) return;
  const o = await opened(tx, s, repo.connectorId);
  try {
    const read = (p: string) =>
      o.plugin.readFile(
        o.config,
        o.credential,
        repo.remoteRepoId!,
        target.packageDir === '.' ? p : `${target.packageDir}/${p}`,
        repo.defaultBranch,
      );
    const r = await probeRepo(read, repo.defaultBranch);
    const pkg = await read('package.json');
    const linkDeps = pkg
      ? Object.values({
          ...(JSON.parse(pkg) as { dependencies?: Record<string, string> }).dependencies,
        })
          .map((v) => /^(?:link|file):(?:\.\.\/)+([^/]+)\/?$/.exec(v)?.[1])
          .filter((x): x is string => !!x)
      : [];
    await updateRow(tx, ctx, repoTargets, target.id, {
      autoDetectedMeta: { ...r.settings, link_deps: linkDeps },
      probeState: 'done',
      probedAt: sql`now()`,
      probeNotes: r.notes,
    } as never);
  } catch (e) {
    await updateRow(tx, ctx, repoTargets, target.id, {
      probeState: 'failed',
      probedAt: sql`now()`,
      probeNotes: [(e as Error).message.slice(0, 500)],
    } as never);
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || 'project';

/**
 * Writable: joins a project (the given one, or a new one named after the repo) and gets probed.
 * Settings change only what the person typed (manual_overrides); reset_overrides gives fields back
 * to the probe.
 */
export function updateRepo(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  id: string,
  req: UpdateRepoRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, 'core:projects:manage');
    const [repo] = await tx
      .select()
      .from(repos)
      .where(and(eq(repos.id, id), isNull(repos.deletedAt)));
    if (!repo) throw new ApiFailure(404, 'repo.not_found');
    let current = repo;
    if (req.access_mode && req.access_mode !== repo.accessMode)
      current = await updateRow(tx, ctx, repos, id, { accessMode: req.access_mode } as never, {
        expectedRev: req.rev,
      });
    let [target] = await tx
      .select()
      .from(repoTargets)
      .where(and(eq(repoTargets.repoId, id), isNull(repoTargets.deletedAt)));
    if (current.accessMode === 'read_write' && !target) {
      let projectId = req.project_id;
      if (!projectId) {
        const name = repo.path.split('/').pop()!;
        try {
          projectId = (await insertRow(tx, ctx, projects, { name, slug: slugify(name) })).id;
        } catch (e) {
          if (pgCode(e) !== '23505') throw e;
          projectId = (
            await insertRow(tx, ctx, projects, { name, slug: `${slugify(name)}-${id.slice(0, 4)}` })
          ).id;
        }
        // the creator sees the new project in this transaction (visibility is resolved per transaction)
        await tx.execute(
          sql`select set_config('app.visible_project_ids', (current_setting('app.visible_project_ids', true)::uuid[] || ${projectId}::uuid)::text, true)`,
        );
      }
      target = await insertRow(tx, ctx, repoTargets, { projectId, repoId: id });
      await runProbe(tx, ctx, s, current, target);
    }
    if (target && (req.settings || req.reset_overrides)) {
      const [fresh] = await tx.select().from(repoTargets).where(eq(repoTargets.id, target.id));
      const overrides: Record<string, unknown> = {
        ...(fresh!.manualOverrides as Record<string, unknown>),
        ...(req.settings ?? {}),
      };
      for (const k of req.reset_overrides ?? []) delete overrides[k];
      await updateRow(tx, ctx, repoTargets, target.id, { manualOverrides: overrides } as never);
    }
    return (await repoRows(tx, [id]))[0]!;
  });
}

export function probe(db: Db, s: SourceSettings, userId: string, ws: string, id: string) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, 'core:projects:manage');
    const [repo] = await tx.select().from(repos).where(eq(repos.id, id));
    if (!repo) throw new ApiFailure(404, 'repo.not_found');
    for (const t of await tx
      .select()
      .from(repoTargets)
      .where(and(eq(repoTargets.repoId, id), isNull(repoTargets.deletedAt))))
      await runProbe(tx, ctx, s, repo, t);
    return (await repoRows(tx, [id]))[0]!;
  });
}

/**
 * The project's repositories as an execution plan (dependency order: a repo another one links to
 * comes first), with each repo's credential referenced, not included.
 */
async function projectRepoSpecs(tx: Tx, projectId: string): Promise<RepoSpec[]> {
  const rows = await tx
    .select({ r: repos, t: repoTargets, c: connectors })
    .from(repoTargets)
    .innerJoin(repos, eq(repos.id, repoTargets.repoId))
    .leftJoin(connectors, eq(connectors.id, repos.connectorId))
    .where(
      and(
        eq(repoTargets.projectId, projectId),
        isNull(repoTargets.deletedAt),
        isNull(repos.deletedAt),
      ),
    );
  const specs = rows.map(({ r, t, c }) => {
    const e = effective(t);
    if (!e?.build_command) throw new ApiFailure(409, 'repo.not_probed', { repo: r.path });
    const name = r.path.split('/').pop()!;
    const deps = ((t.autoDetectedMeta as { link_deps?: string[] }).link_deps ?? []) as string[];
    const spec: RepoSpec = {
      id: r.id,
      name,
      clone_url: r.cloneUrl,
      ref: e.default_branch,
      build_command: e.build_command,
      ...(e.test_command ? { test_command: e.test_command } : {}),
      ...(e.typecheck_command ? { typecheck_command: e.typecheck_command } : {}),
      verify_strategy:
        e.verify_strategy === 'browser_dist_replace' ? 'browser_dist_replace' : 'test_suite',
      ...(e.dist_dir ? { dist_dir: e.dist_dir } : {}),
      ...(e.asset_url_patterns.length ? { asset_url_patterns: e.asset_url_patterns } : {}),
      ...(c?.secretId ? { credential_ref: c.secretId } : {}),
    };
    return { spec, deps };
  });
  const ordered: RepoSpec[] = [];
  const left = [...specs];
  while (left.length) {
    const i = left.findIndex((x) => x.deps.every((d) => !left.some((y) => y.spec.name === d)));
    ordered.push(left.splice(i < 0 ? 0 : i, 1)[0]!.spec);
  }
  return ordered;
}

export function trialBuild(db: Db, userId: string, ws: string, projectId: string) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    await need(tx, userId, 'core:projects:manage');
    const repoSpecs = await projectRepoSpecs(tx, projectId);
    if (!repoSpecs.length) throw new ApiFailure(409, 'project.no_repos');
    const plan: Plan = {
      plan_schema_version: PLAN_SCHEMA_VERSION,
      repos: repoSpecs,
      nodes: [
        {
          key: 'trial_build',
          kind: 'auto',
          node_kind: 'deterministic_verify',
          config: { action: 'trial_build' },
        },
      ],
    };
    return {
      flow_id: await pgOrchestrator.startFlow(tx, ctx, { projectId, kind: 'trial_build', plan }),
    };
  });
}

export function flowStatus(db: Db, userId: string, ws: string, flowId: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const [f] = await tx.select().from(flowInstances).where(eq(flowInstances.id, flowId));
    if (!f) throw new ApiFailure(404, 'flow.not_found');
    const runs = await tx
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.flowInstanceId, flowId))
      .orderBy(asc(nodeRuns.createdAt));
    return {
      id: f.id,
      kind: f.kind,
      status: f.status,
      nodes: runs.map((r) => ({
        key: r.nodeKey,
        status: r.status,
        attempt_no: r.attemptNo,
        output: r.structuredOutput,
        error: r.errorRaw,
      })),
    };
  });
}
