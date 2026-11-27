// dev:up 的种子数据（docs/07 §4.4，P1 起）：2 个空间、几名成员、1 个项目。
// 走和产品一样的写入函数（运行账号、RLS、操作记录），可重复执行：已有种子用户就跳过。
import { databaseUrls, type Config } from '@cloudcraft/config';
import { createDb, createWorkspace, insertRow, schema } from '@cloudcraft/server';
import { eq } from 'drizzle-orm';

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
    if (existing.length) return 'exists';
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
