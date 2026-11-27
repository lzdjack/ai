// Claude Code PostToolUse 钩子：改完代码文件立刻跑 ESLint（docs/07 §7.4）。
// 没问题时不输出任何内容；有错时退出码 2，把错误反馈给 Claude。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  file = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file || !/\.(ts|tsx|mts|js|mjs)$/.test(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const abs = path.resolve(root, file);
const rel = path.relative(root, abs).split(path.sep).join('/');
if (!/^(apps|packages|plugins|sim|tools|e2e)\//.test(rel)) process.exit(0);

const eslint = path.join(root, 'node_modules', '.bin', 'eslint');
if (!fs.existsSync(eslint) || !fs.existsSync(abs)) process.exit(0);

const r = spawnSync(eslint, ['--no-warn-ignored', '--max-warnings', '0', abs], {
  cwd: root,
  encoding: 'utf8',
});
if (r.status !== 0) {
  process.stderr.write(`ESLint 发现问题（${rel}）：\n${(r.stdout || r.stderr).trim()}\n`);
  process.exit(2);
}
