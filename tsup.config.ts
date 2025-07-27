import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  bundle: true,
  minify: false,
  keepNames: true,
  treeshake: true,
  external: [
    // Keep Node.js built-ins external
    'fs',
    'path',
    'url',
    'events',
    'stream',
    'crypto',
    'os',
    'util',
    'http',
    'https',
    'querystring',
    'zlib',
    'buffer'
  ],
  esbuildOptions: (options) => {
    options.platform = 'node';
    options.packages = 'external';
  },
  onSuccess: async () => {
    console.log('✅ Build completed successfully!');
  },
});
