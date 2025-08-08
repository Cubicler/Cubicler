import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: [
      // Default-ish excludes + integration folder
      '**/node_modules/**',
      '**/dist/**',
      '**/.{git,svn,hg}/**',
      '**/cypress/**',
      '**/.next/**',
      '**/coverage/**',
      'tests/integration/**',
    ],
  },
  resolve: {
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  },
});
