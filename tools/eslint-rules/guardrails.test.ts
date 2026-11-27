// 防跑偏检查的聚合测试（docs/07 §7.4）：每条规则一个违规样例必须被拦下，正常写法不能误报。
import { ESLint } from 'eslint';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');
const eslint = new ESLint({ cwd: ROOT });

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, filePath) });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const violations: Array<[string, string, string, string]> = [
  // [说明, 文件, 代码, 期望命中的规则]
  ['应用引用插件', 'apps/server/src/a.ts', "import '@cloudcraft/runtime-pi';", 'cc/boundaries'],
  [
    '核心包引用应用',
    'packages/core-protocol/src/a.ts',
    "import '@cloudcraft/server';",
    'cc/boundaries',
  ],
  [
    '插件引用别的插件',
    'plugins/runtime-pi/src/a.ts',
    "import '@cloudcraft/connector-gitlab';",
    'cc/boundaries',
  ],
  ['模拟服务引用产品代码', 'sim/src/a.ts', "import '@cloudcraft/core-protocol';", 'cc/boundaries'],
  ['浏览器包用 Node 模块', 'packages/ui-kit/src/a.ts', "import 'node:fs';", 'cc/boundaries'],
  [
    '相对路径穿过包目录',
    'apps/server/src/a.ts',
    "import '../../bot-executor/src/index';",
    'cc/boundaries',
  ],
  [
    '按插件名分支',
    'apps/server/src/a.ts',
    "export const f = (e: string) => e === 'pi';",
    'cc/no-plugin-id-branch',
  ],
  [
    '前端写死十六进制颜色',
    'packages/ui-kit/src/a.tsx',
    "export const c = '#ff3b30';",
    'cc/no-hardcoded-color',
  ],
  [
    '前端写死 rgb 颜色',
    'packages/workbench-ui/src/a.tsx',
    'export const c = `rgba(0, 0, 0, .5)`;',
    'cc/no-hardcoded-color',
  ],
  [
    '写死中文文案',
    'packages/workbench-ui/src/a.tsx',
    'export const A = () => <div>审核通过</div>;',
    'cc/no-hardcoded-cjk',
  ],
  [
    '后端报错写死中文',
    'apps/server/src/a.ts',
    "throw new Error('工单不存在');",
    'cc/no-hardcoded-cjk',
  ],
  [
    '使用 any',
    'apps/server/src/a.ts',
    'export const x: any = 1;',
    '@typescript-eslint/no-explicit-any',
  ],
  [
    '使用 ts-ignore',
    'apps/server/src/a.ts',
    '// @ts-ignore\nexport const x = 1;',
    '@typescript-eslint/ban-ts-comment',
  ],
  [
    '关检查不写理由',
    'apps/server/src/a.ts',
    '// eslint-disable-next-line no-console\nconsole.log(1);',
    '@eslint-community/eslint-comments/require-description',
  ],
  ['提交 .only', 'apps/server/src/a.test.ts', "it.only('x', () => {});", 'cc/test-focus-skip'],
  [
    '.skip 没写台账编号',
    'apps/server/src/a.test.ts',
    "it.skip('x', () => {});",
    'cc/test-focus-skip',
  ],
];

describe('防跑偏检查', () => {
  it.each(violations)('拦下：%s', async (_name, file, code, rule) => {
    expect(await ruleIds(file, code)).toContain(rule);
  });

  it('正常写法不误报', async () => {
    const clean: Array<[string, string]> = [
      [
        'apps/server/src/a.ts',
        "import '@cloudcraft/core-protocol';\nexport const f = (c: { canSteer: boolean }) => c.canSteer;",
      ],
      [
        'plugins/runtime-pi/src/a.ts',
        "import '@cloudcraft/core-protocol';\nimport '@cloudcraft/mcp-tool-host';",
      ],
      [
        'packages/workbench-ui/src/a.tsx',
        "import '@cloudcraft/ui-kit';\nexport const s = { color: 'var(--blue)' };",
      ],
      ['apps/server/src/a.test.ts', "// P3-a 等模拟服务支持\nit.skip('x', () => {});"],
      [
        'tools/a.ts',
        "import '@cloudcraft/server';\nexport const msg = '中文提示可以出现在工具里';",
      ],
      [
        'sim/src/a.ts',
        "import fs from 'node:fs';\nexport const msg = '模拟服务的报文可以有中文';\nexport { fs };",
      ],
    ];
    for (const [file, code] of clean) {
      expect(await ruleIds(file, code), file).toEqual([]);
    }
  });
});
