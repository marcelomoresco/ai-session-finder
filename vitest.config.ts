import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Sprint 00 ships no tests yet; do not fail the suite until Sprint 01.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: ['**/*.config.*', '**/dist/**', '**/node_modules/**'],
    },
    include: ['**/*.{test,spec}.ts'],
  },
});
