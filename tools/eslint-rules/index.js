// 云匠自定义 ESLint 规则（docs/07 §7.4）。纯 JS，ESLint 配置直接加载，无需编译。
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

// ---------- 工作区地图：包名 → 元素 ----------

/** @typedef {{ kind: 'app'|'package'|'browser'|'plugin'|'sim'|'tools'|'e2e'|'other', name: string, dir: string }} Element */

const BROWSER_PACKAGES = new Set(['ui-kit', 'workbench-ui', 'admin-ui']);

/** 按目录判断元素类型 */
function elementOfDir(relDir) {
  const [top, name] = relDir.split('/');
  if (top === 'apps' && name) return { kind: 'app', name, dir: `apps/${name}` };
  if (top === 'packages' && name)
    return {
      kind: BROWSER_PACKAGES.has(name) ? 'browser' : 'package',
      name,
      dir: `packages/${name}`,
    };
  if (top === 'plugins' && name) return { kind: 'plugin', name, dir: `plugins/${name}` };
  if (top === 'sim') return { kind: 'sim', name: 'sim', dir: 'sim' };
  if (top === 'tools') return { kind: 'tools', name: 'tools', dir: 'tools' };
  if (top === 'e2e') return { kind: 'e2e', name: 'e2e', dir: 'e2e' };
  return { kind: 'other', name: '', dir: '' };
}

/** 读取工作区内所有 @cloudcraft/* 包名对应的元素 */
function loadWorkspace() {
  /** @type {Map<string, Element>} */
  const map = new Map();
  const add = (dir) => {
    const pj = path.join(ROOT, dir, 'package.json');
    if (!fs.existsSync(pj)) return;
    const { name } = JSON.parse(fs.readFileSync(pj, 'utf8'));
    if (name) map.set(name, elementOfDir(dir));
  };
  for (const top of ['apps', 'packages', 'plugins']) {
    const abs = path.join(ROOT, top);
    if (!fs.existsSync(abs)) continue;
    for (const d of fs.readdirSync(abs)) add(`${top}/${d}`);
  }
  add('sim');
  add('tools');
  return map;
}

const WORKSPACE = loadWorkspace();

/** 插件 ID：plugins/ 目录名及其去掉 runtime- / connector- 前缀后的部分，加 06 §11.4 列出的引擎名 */
function loadPluginIds() {
  const ids = new Set(['pi', 'acp', 'claude-code', 'codex', 'apollo']);
  const abs = path.join(ROOT, 'plugins');
  if (fs.existsSync(abs)) {
    for (const d of fs.readdirSync(abs)) {
      ids.add(d);
      ids.add(d.replace(/^(runtime|connector|module)-/, ''));
    }
  }
  return ids;
}

const PLUGIN_IDS = loadPluginIds();

const NODE_BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

/** 允许的依赖方向（docs/07 §2.3） */
function allowed(from, to) {
  if (from.dir === to.dir) return true;
  switch (from.kind) {
    case 'app':
      return to.kind === 'package' || to.kind === 'browser';
    case 'package':
      return to.kind === 'package' || to.kind === 'browser';
    case 'browser':
      return to.dir === 'packages/core-protocol' || to.dir === 'packages/ui-kit';
    case 'plugin':
      return to.dir === 'packages/core-protocol' || to.dir === 'packages/mcp-tool-host';
    case 'sim':
      return false;
    default:
      return true; // tools、e2e 可以引用任何包
  }
}

function relFile(filename) {
  return path.relative(ROOT, filename).split(path.sep).join('/');
}

// ---------- 规则 1：依赖边界 ----------

const boundaries = {
  meta: {
    type: 'problem',
    docs: { description: '包之间的依赖方向（docs/07 §2.3）' },
    schema: [],
    messages: {
      forbidden: '{{from}} 不能依赖 {{to}}（docs/07 §2.3）',
      unknown: '未知的内部包 {{spec}}',
      crossRelative: '跨包引用要用包名（@cloudcraft/...），不要用相对路径穿过包目录',
      nodeBuiltin: '纯浏览器包不能用 Node 内置模块 {{spec}}；宿主能力走 HostPlatformAdapter',
    },
  },
  create(context) {
    const rel = relFile(context.filename);
    const from = elementOfDir(path.posix.dirname(rel));
    if (from.kind === 'other') return {};

    const check = (node, spec) => {
      if (typeof spec !== 'string') return;
      if (from.kind === 'browser' && NODE_BUILTINS.has(spec)) {
        context.report({ node, messageId: 'nodeBuiltin', data: { spec } });
        return;
      }
      if (spec.startsWith('@cloudcraft/')) {
        const pkg = spec.split('/').slice(0, 2).join('/');
        const to = WORKSPACE.get(pkg);
        if (!to) return context.report({ node, messageId: 'unknown', data: { spec } });
        if (!allowed(from, to))
          context.report({ node, messageId: 'forbidden', data: { from: from.dir, to: to.dir } });
        return;
      }
      if (spec.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        const to = elementOfDir(target);
        if (to.kind !== 'other' && to.dir !== from.dir)
          context.report({ node, messageId: 'crossRelative' });
      }
    };

    const fromSource = (node) => node.source && check(node.source, node.source.value);
    return {
      ImportDeclaration: fromSource,
      ExportNamedDeclaration: fromSource,
      ExportAllDeclaration: fromSource,
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(node.source, node.source.value);
      },
    };
  },
};

// ---------- 规则 2：不按插件名分支 ----------

const noPluginIdBranch = {
  meta: {
    type: 'problem',
    docs: { description: '核心代码不按插件名分支（06 §11.4）' },
    schema: [],
    messages: {
      branch: '不要按插件名「{{id}}」分支；改读 AdapterCapabilities 能力位或插件声明（06 §11.4）',
    },
  },
  create(context) {
    const isId = (n) =>
      n &&
      n.type === 'Literal' &&
      typeof n.value === 'string' &&
      PLUGIN_IDS.has(n.value.toLowerCase());
    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        const lit = isId(node.left) ? node.left : isId(node.right) ? node.right : null;
        if (lit) context.report({ node, messageId: 'branch', data: { id: lit.value } });
      },
      SwitchCase(node) {
        if (isId(node.test))
          context.report({ node, messageId: 'branch', data: { id: node.test.value } });
      },
    };
  },
};

// ---------- 规则 3：前端不写死颜色 ----------

const HEX = /(^|[^\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;
const COLOR_FN = /\b(?:rgba?|hsla?)\(/;

const noHardcodedColor = {
  meta: {
    type: 'problem',
    docs: { description: '前端颜色只用 tokens/theme.css 的变量' },
    schema: [],
    messages: { color: '不要写死颜色「{{text}}」，用 tokens/theme.css 的变量（如 var(--blue)）' },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text !== 'string') return;
      const m = text.match(HEX) || text.match(COLOR_FN);
      if (m) context.report({ node, messageId: 'color', data: { text: m[0].trim() } });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
    };
  },
};

// ---------- 规则 4：界面文案不写死中文 ----------

// 中日韩文字与全角标点的码点范围（用码点构造，避免源码里出现全角空白字符）
const CJK_RANGES = [
  [0x3000, 0x303f],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0xff00, 0xffef],
];
const CJK = new RegExp(
  `[${CJK_RANGES.map(([a, b]) => `${String.fromCodePoint(a)}-${String.fromCodePoint(b)}`).join('')}]`,
);

const noHardcodedCjk = {
  meta: {
    type: 'problem',
    docs: { description: '文案走 i18n 词条（06 §13.6 第 9 项）' },
    schema: [],
    messages: { cjk: '不要在代码里写死中文，放进 i18n/zh-CN.json 词条（06 §13.6 第 9 项）' },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text === 'string' && CJK.test(text)) context.report({ node, messageId: 'cjk' });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
      JSXText: (node) => check(node, node.value),
    };
  },
};

// ---------- 规则 5：测试不提交 .only，.skip 要注明台账编号 ----------

const TEST_FNS = new Set(['describe', 'it', 'test', 'suite']);
const TASK_ID = /\b[EPSUQ]\d+(?:-[0-9A-Za-z]+)?\b/;

const testFocusSkip = {
  meta: {
    type: 'problem',
    docs: { description: '不提交 .only；.skip 必须注明台账编号' },
    schema: [],
    messages: {
      only: '不要提交 .only',
      skip: '.skip 要在同一行或上一行注释里写明台账编号（如 // P3-a 待模拟服务支持）',
    },
  },
  create(context) {
    const source = context.sourceCode;
    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier' || !TEST_FNS.has(node.object.name)) return;
        if (node.property.type !== 'Identifier') return;
        if (node.property.name === 'only') context.report({ node, messageId: 'only' });
        if (node.property.name === 'skip') {
          const line = node.loc.start.line;
          const ok = source
            .getAllComments()
            .some(
              (c) =>
                (c.loc.end.line === line - 1 || c.loc.start.line === line) && TASK_ID.test(c.value),
            );
          if (!ok) context.report({ node, messageId: 'skip' });
        }
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-cloudcraft' },
  rules: {
    boundaries,
    'no-plugin-id-branch': noPluginIdBranch,
    'no-hardcoded-color': noHardcodedColor,
    'no-hardcoded-cjk': noHardcodedCjk,
    'test-focus-skip': testFocusSkip,
  },
};
