import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  // auk-develop (and its web-tree-sitter runtime) stay external so they
  // resolve their own wasm assets from node_modules at runtime.
  external: ['auk-develop', 'web-tree-sitter'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
