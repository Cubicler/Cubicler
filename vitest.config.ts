import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Allow opting into single-thread mode for restrictive environments (e.g., sandboxes)
const SINGLE_THREAD = process.env.VITEST_SINGLE_THREAD === '1';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    // In restrictive sandboxes, killing workers can fail (EPERM).
    // Use single-thread mode only when VITEST_SINGLE_THREAD=1.
    pool: 'threads',
    poolOptions: {
      threads: SINGLE_THREAD ? { singleThread: true } : { singleThread: false },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
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
    alias: [
      // Allow importing local ESM files without the .js extension in tests
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' },
      // Workaround: the external package '@cubicler/cubicagent-openai' ships a dist file
      // that imports from '@/utils/...'. Map '@/...' to that package's dist folder.
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(
          process.cwd(),
          'node_modules/@cubicler/cubicagent-openai/dist/$1'
        ),
      },
    ],
  },
});
