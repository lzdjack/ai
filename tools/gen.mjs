// pnpm gen：重新生成所有生成物（docs/07 §3.2）。生成器随任务加入，verify 会检查生成物是否最新。
// 每项：{ name, run: () => Promise<void> | void, outputs: string[] }（outputs 为相对仓库根的路径）
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const bin = (name, pkg = '.') => path.join(ROOT, pkg, 'node_modules', '.bin', name);

function sh(cwd, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: path.join(ROOT, cwd), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} 失败：\n${r.stdout}${r.stderr}`);
}

export const GENERATORS = [
  {
    // 表结构改了就多出一个新迁移文件；没改不产生文件
    name: '数据库迁移 SQL',
    run: () => sh('apps/server', bin('drizzle-kit', 'apps/server'), ['generate']),
    outputs: ['apps/server/drizzle'],
  },
  {
    name: 'RLS 与权限 SQL',
    run: () => sh('.', bin('tsx'), ['apps/server/src/db/gen-security.ts']),
    outputs: ['apps/server/src/db/sql/security.sql'],
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const g of GENERATORS) await g.run();
}
