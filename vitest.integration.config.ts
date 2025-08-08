import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  },
});

