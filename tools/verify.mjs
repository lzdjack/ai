// pnpm verify：唯一检查入口，本地即 CI（docs/07 §3.3）。
// 全绿时每步只打一行；失败时打印该步输出的末尾并退出 1，省 token。
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GENERATORS } from './gen.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TAIL = 60;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    ...opts,
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

function step(name, fn) {
  const t = Date.now();
  const r = fn();
  const sec = ((Date.now() - t) / 1000).toFixed(1);
  if (r.skip) {
    console.log(`- ${name}：${r.skip}`);
    return;
  }
  if (r.ok) {
    console.log(`✓ ${name}（${sec}s）${r.note ? `  ${r.note}` : ''}`);
    return;
  }
  const lines = r.out.split('\n');
  console.log(`✗ ${name}（${sec}s）`);
  console.log(lines.slice(-TAIL).join('\n'));
  if (lines.length > TAIL) console.log(`…（共 ${lines.length} 行，只显示最后 ${TAIL} 行）`);
  process.exit(1);
}

/** 相对 origin/main 改动过的文件（含未提交的） */
function changedFiles() {
  const base = git(['merge-base', 'HEAD', 'origin/main']);
  const files = new Set();
  if (base.ok)
    git(['diff', '--name-only', base.out])
      .out.split('\n')
      .forEach((f) => f && files.add(f));
  git(['ls-files', '--others', '--exclude-standard'])
    .out.split('\n')
    .forEach((f) => f && files.add(f));
  return [...files];
}

/** git 命令统一关掉路径转义，中文文件名才能按原样匹配 */
const git = (args) => run('git', ['-c', 'core.quotepath=off', ...args]);

const bin = (name) => path.join(ROOT, 'node_modules', '.bin', name);

step('类型检查', () => run(bin('tsc'), ['-p', 'tsconfig.json', '--pretty', 'false']));

step('代码检查与依赖边界', () =>
  run(bin('eslint'), [
    '.',
    '--max-warnings',
    '0',
    '--cache',
    '--cache-location',
    'node_modules/.cache/eslint/',
  ]),
);

/** 生成物当前内容的指纹：路径 → 内容哈希（目录递归展开） */
function fingerprint(outputs) {
  const out = new Map();
  const walk = (rel) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory())
      for (const f of fs.readdirSync(abs)) walk(path.join(rel, f));
    else out.set(rel, crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
  };
  outputs.forEach(walk);
  return out;
}

step('生成物是否最新', () => {
  if (GENERATORS.length === 0) return { skip: '暂无生成器' };
  const outputs = GENERATORS.flatMap((g) => g.outputs);
  const before = fingerprint(outputs);
  const r = run('node', ['tools/gen.mjs']);
  if (!r.ok) return r;
  const after = fingerprint(outputs);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (f) => before.get(f) !== after.get(f),
  );
  return changed.length
    ? { ok: false, out: `生成物和源不一致，已重新生成，检查后提交：\n${changed.join('\n')}` }
    : { ok: true };
});

step('测试', () => run(bin('vitest'), ['run', '--reporter=dot']));

const changed = changedFiles();

step('设计对照表', () => {
  const design = changed.some((f) => /^(docs|reference|scripts|tokens)\//.test(f));
  if (!design) return { skip: '没有改设计文件' };
  return run('python3', ['scripts/build-all.py', '--check']);
});

step('新增依赖', () => {
  const pjs = changed.filter(
    (f) => f.endsWith('package.json') && fs.existsSync(path.join(ROOT, f)),
  );
  const added = [];
  for (const f of pjs) {
    const now = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const old = git(['show', `origin/main:${f}`]);
    const before = old.ok ? JSON.parse(old.out) : {};
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const dep of Object.keys(now[field] ?? {})) {
        if (!(before[field] ?? {})[dep] && !dep.startsWith('@cloudcraft/'))
          added.push(`${f}: ${dep}`);
      }
    }
  }
  if (added.length === 0) return { ok: true };
  return {
    ok: true,
    note: `${added.length} 个新增依赖，PR 里要写明理由：\n  ${added.join('\n  ')}`,
  };
});
