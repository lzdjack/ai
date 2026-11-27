// pnpm dev:reset --yes：清空本地数据（保留 .env 和 keys/）后重新 dev:up（docs/07 §4.4）。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_SUBDIRS, ROOT, compose, dataDir, loadConfigOrExit, must } from './lib.ts';

const dir = dataDir();
const targets = DATA_SUBDIRS.map((d) => path.join(dir, d));

if (!process.argv.includes('--yes')) {
  console.log('会删除以下目录里的全部数据（.env 和 keys/ 保留）：');
  for (const t of targets) console.log(`  ${t}`);
  console.log('确认后运行：pnpm dev:reset --yes');
  process.exit(1);
}

must('停止容器', compose(loadConfigOrExit(), ['down']));
for (const t of targets) fs.rmSync(t, { recursive: true, force: true });
console.log('✓ 已清空数据');

const up = spawnSync(process.execPath, ['--import', 'tsx', path.join(ROOT, 'tools/dev/up.ts')], {
  stdio: 'inherit',
});
process.exit(up.status ?? 1);
