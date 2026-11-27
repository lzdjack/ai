// ESLint 配置：通用规则 + 防跑偏检查（docs/07 §7.4）
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import globals from 'globals';
import cc from './tools/eslint-rules/index.js';

const FRONTEND = [
  'packages/ui-kit/**',
  'packages/workbench-ui/**',
  'packages/admin-ui/**',
  'apps/desktop/**',
  'apps/web/**',
];
const TESTS = ['**/*.test.{ts,tsx}', '**/test/**', 'e2e/**'];

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      'coverage/**',
      'docs/**',
      'reference/**',
      'scripts/**',
      'tokens/**',
      'fixtures/**',
      'index.html',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  comments.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { cc },
    rules: {
      // 类型逃逸（07 §7.4 第 8 条）
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true },
      ],
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      // 依赖边界（07 §2.3）
      'cc/boundaries': 'error',
    },
  },
  {
    // 核心不按插件名分支（07 §7.4 第 2 条）
    files: ['apps/**', 'packages/**'],
    rules: { 'cc/no-plugin-id-branch': 'error' },
  },
  {
    // 前端不写死颜色（第 3 条）
    files: FRONTEND,
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'cc/no-hardcoded-color': 'error' },
  },
  {
    // 产品代码不写死中文文案（第 4 条）
    files: ['apps/**', 'packages/**', 'plugins/**'],
    ignores: TESTS,
    rules: { 'cc/no-hardcoded-cjk': 'error' },
  },
  {
    // 测试不提交 .only，.skip 注明台账编号（第 9 条）
    files: TESTS,
    rules: { 'cc/test-focus-skip': 'error' },
  },
);
