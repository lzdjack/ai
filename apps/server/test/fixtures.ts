// Two workspaces (A, B), each with an owner, one project and one running flow.
import { PLAN_SCHEMA_VERSION, type Plan } from '../src/orchestrator/advance.ts';
import { pgOrchestrator } from '../src/orchestrator/flow.ts';
import { withWorkspaceTx, type Db } from '../src/db/client.ts';
import { projects, users } from '../src/db/schema/index.ts';
import { createWorkspace, insertRow } from '../src/db/write.ts';
import crypto from 'node:crypto';
import type { AccountSettings } from '../src/service/account-service.ts';
import type { SourceSettings } from '../src/service/source-service.ts';

export const PLAN: Plan = {
  plan_schema_version: PLAN_SCHEMA_VERSION,
  nodes: [
    { key: 'fix', kind: 'auto' },
    { key: 'review', kind: 'human' },
    { key: 'deploy', kind: 'auto' },
  ],
};

export interface Space {
  userId: string;
  workspaceId: string;
  projectId: string;
  flowId: string;
}

export async function seedSpace(db: Db, slug: string): Promise<Space> {
  const [user] = await db.orm
    .insert(users)
    .values({ email: `${slug}@test.local`, displayName: slug })
    .returning();
  const { workspaceId, projectId } = await db.orm.transaction(async (tx) => {
    const ctx = await createWorkspace(tx, user!.id, { kind: 'organization', slug, name: slug });
    const p = await insertRow(tx, ctx, projects, { name: `${slug} project`, slug: 'main' });
    return { workspaceId: ctx.workspaceId, projectId: p.id };
  });
  // a new transaction re-resolves the visible projects, now including the new one
  const flowId = await withWorkspaceTx(db, { userId: user!.id, workspaceId }, (tx, ctx) =>
    pgOrchestrator.startFlow(tx, ctx, { projectId, kind: 'round', plan: PLAN }),
  );
  return { userId: user!.id, workspaceId, projectId, flowId };
}

/** Account settings for tests: fixed secrets, mail kept in memory, no practical rate limit. */
export function testAccounts(over: Partial<AccountSettings> = {}) {
  const mails: { to: string; subject: string; text: string }[] = [];
  const settings: AccountSettings = {
    authSecret: 'test-auth-secret-0123456789abcdef',
    otpPepper: 'test-otp-pepper-0123456789abcdef',
    rateLimitPerHour: 1000,
    mailer: { send: async (m) => void mails.push(m) },
    publicUrl: 'http://cloudcraft.test',
    ...over,
  };
  return { settings, mails };
}

/** Credential store and connector plugins for tests: a throwaway master key; plugins on request. */
export function testSources(connectors: SourceSettings['connectors'] = new Map()): SourceSettings {
  return { masterKey: crypto.randomBytes(32), connectors };
}
