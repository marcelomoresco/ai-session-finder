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
      lib: { entry: resolve(__dirname, 'src/index.ts') },
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
      outDir: resolve(rendererRoot, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(rendererRoot, 'index.html'),
      },
    },
  },
});
