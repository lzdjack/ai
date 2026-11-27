import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'apps/*/src/**/*.test.{ts,tsx}',
      'apps/*/test/**/*.test.ts',
      'packages/*/src/**/*.test.{ts,tsx}',
      'plugins/*/src/**/*.test.ts',
      'sim/src/**/*.test.ts',
      'tools/**/*.test.ts',
    ],
    passWithNoTests: true,
  },
});
