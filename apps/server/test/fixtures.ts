// Two workspaces (A, B), each with an owner, one project and one running flow.
import { PLAN_SCHEMA_VERSION, type Plan } from '../src/orchestrator/advance.ts';
import { pgOrchestrator } from '../src/orchestrator/flow.ts';
import { withWorkspaceTx, type Db } from '../src/db/client.ts';
import { projects, users } from '../src/db/schema/index.ts';
import { createWorkspace, insertRow } from '../src/db/write.ts';

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
