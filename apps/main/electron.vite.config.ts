import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Renderer source lives in the sibling @asf/renderer package. electron-vite
// orchestrates main + preload + renderer from here; configFile:false stops Vite
// from also auto-loading ../renderer/vite.config.ts (which is for standalone use).
const rendererRoot = resolve(__dirname, '../renderer');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@asf/domain', '@asf/contracts', '@asf/indexer'] })],
    build: {
      outDir: resolve(__dirname, 'dist/main'),
      // Two entries: the app entry plus the indexer worker, which index.ts spawns
      // by path via `new Worker(join(__dirname, 'worker.js'))`. Without emitting
      // worker.js the indexer thread can't start in a packaged build.
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.ts'),
          worker: resolve(__dirname, 'src/services/worker.ts'),
        },
        output: { entryFileNames: '[name].js' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@asf/domain', '@asf/contracts'] })],
    build: {
      outDir: resolve(__dirname, 'dist/preload'),
      lib: { entry: resolve(__dirname, 'src/preload.ts') },
    },
  },
  renderer: {
    root: rendererRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': resolve(rendererRoot, 'src') },
    },
    build: {
      // Output into the main app's dist so a packaged build is self-contained
      // under apps/main/dist (index.html loaded relative to dist/main).
      outDir: resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(rendererRoot, 'index.html'),
      },
    },
  },
});
