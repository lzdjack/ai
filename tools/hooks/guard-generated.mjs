// Claude Code PreToolUse 钩子：拦截直接编辑生成物和密钥文件（docs/07 §7.4）。
// 退出码 2 = 拦下，stderr 内容反馈给 Claude。
import path from 'node:path';

const RULES = [
  { test: (p) => p === 'index.html', hint: '运行 python3 scripts/build-index.py 生成' },
  {
    test: (p) => p.startsWith('reference/src/'),
    hint: '改 scripts/gen-*.py 后运行 python3 scripts/build-all.py',
  },
  { test: (p) => p.endsWith('openapi.json'), hint: '运行 pnpm gen 生成' },
  { test: (p) => p === 'pnpm-lock.yaml', hint: '用 pnpm add / pnpm install 更新' },
  { test: (p) => /(^|\/)\.env(\.|$)/.test(p), hint: '密钥文件由用户自己编辑，Claude 不经手' },
];

let input = '';
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  file = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
const target = rel.startsWith('..') ? path.resolve(file) : rel;

const hit = RULES.find((r) => r.test(target));
if (hit) {
  process.stderr.write(`「${target}」是生成物或密钥文件，不要直接编辑：${hit.hint}\n`);
  process.exit(2);
}
