import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Renderer test project: jsdom + React. Referenced by the root vitest config's
// `projects`. Coverage thresholds live at the root.
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'renderer',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
  },
});
