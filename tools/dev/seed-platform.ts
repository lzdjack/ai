// dev:up 的种子数据（docs/07 §4.4，P1 起）：2 个空间、几名成员、1 个项目。
// 走和产品一样的写入函数（运行账号、RLS、操作记录），可重复执行：已有种子用户就跳过。
import { databaseUrls, type Config } from '@cloudcraft/config';
import { BUILTIN_ROLES } from '@cloudcraft/core-protocol';
import {
  createDb,
  createWorkspace,
  insertRow,
  schema,
  withWorkspaceTx,
  type Db,
} from '@cloudcraft/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

const USERS = [
  { email: 'zhangsan@demo.local', displayName: '张三' },
  { email: 'lisi@demo.local', displayName: '李四' },
  { email: 'wangwu@demo.local', displayName: '王五' },
];

export async function seedPlatform(c: Config): Promise<'seeded' | 'exists'> {
  const db = createDb(databaseUrls(c).app, { max: 2 });
  try {
    const existing = await db.orm
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, USERS[0]!.email));
    if (existing.length) {
      await ensureDemoRoles(db);
      return 'exists';
    }
    const [zhang, li, wang] = await db.orm.insert(schema.users).values(USERS).returning();
    await db.orm.transaction(async (tx) => {
      const ctx = await createWorkspace(
        tx,
        zhang!.id,
        { kind: 'organization', slug: 'demo', name: '演示团队' },
        'system_sync',
      );
      await insertRow(tx, ctx, schema.workspaceMembers, { userId: li!.id });
      await insertRow(tx, ctx, schema.workspaceMembers, { userId: wang!.id });
      await insertRow(tx, ctx, schema.projects, { name: '审批中心', slug: 'approval-center' });
    });
    await ensureDemoRoles(db);
    await db.orm.transaction((tx) =>
      createWorkspace(
        tx,
        li!.id,
        { kind: 'personal', slug: 'lisi', name: '李四的个人空间' },
        'system_sync',
      ),
    );
    return 'seeded';
  } finally {
    await db.close();
  }
}

/**
 * P2 brought roles: the demo team's owner is 张三; 李四 and 王五 are members of the project. Also fills
 * databases seeded before P2 (their workspaces have no roles yet). Idempotent.
 */
async function ensureDemoRoles(db: Db) {
  const byEmail = async (email: string) =>
    (await db.orm.select().from(schema.users).where(eq(schema.users.email, email)))[0]!;
  const [zhang, li, wang] = await Promise.all(USERS.map((u) => byEmail(u.email)));
  // workspaces are behind RLS: find the demo team through 张三's memberships
  const mine = await db.orm.execute<{ id: string; slug: string }>(
    sql`select id, slug from app_my_workspaces(${zhang!.id}::uuid)`,
  );
  const ws = mine.rows.find((w) => w.slug === 'demo');
  if (!ws) return;
  await withWorkspaceTx(
    db,
    { userId: zhang!.id, workspaceId: ws.id, clientSource: 'system_sync' },
    async (tx, ctx) => {
      let roles = await tx.select().from(schema.roles).where(isNull(schema.roles.deletedAt));
      if (!roles.length)
        for (const r of BUILTIN_ROLES)
          roles.push(
            await insertRow(tx, ctx, schema.roles, {
              key: r.key,
              isBuiltin: true,
              isOwner: r.is_owner,
              permissions: r.permissions,
            }),
          );
      roles = roles.filter((r) => r.isBuiltin);
      const role = (key: string) => roles.find((r) => r.key === key)!.id;
      const [project] = await tx
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.slug, 'approval-center'));
      const want = [
        { userId: zhang!.id, roleId: role('ws_owner'), scopeType: 'workspace', scopeId: null },
        { userId: li!.id, roleId: role('member'), scopeType: 'workspace', scopeId: null },
        { userId: wang!.id, roleId: role('member'), scopeType: 'workspace', scopeId: null },
        ...(project
          ? [li!, wang!].map((u) => ({
              userId: u.id,
              roleId: role('member'),
              scopeType: 'project',
              scopeId: project.id,
            }))
          : []),
      ];
      for (const b of want) {
        const has = await tx
          .select()
          .from(schema.roleBindings)
          .where(
            and(
              eq(schema.roleBindings.userId, b.userId),
              eq(schema.roleBindings.roleId, b.roleId),
              eq(schema.roleBindings.scopeType, b.scopeType),
              isNull(schema.roleBindings.deletedAt),
            ),
          );
        if (!has.some((h) => h.scopeId === b.scopeId))
          await insertRow(tx, ctx, schema.roleBindings, b);
      }
    },
  );
}
