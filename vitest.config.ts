import { defineConfig } from 'vitest/config';

// Two projects: Node for domain/persistence/services, jsdom for the React
// renderer. Coverage is configured here and spans both projects.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: [
        '**/*.config.*',
        '**/dist/**',
        '**/node_modules/**',
        '**/vitest.setup.ts',
        '**/e2e/**',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          globals: false,
          environment: 'node',
          include: ['**/*.{test,spec}.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', 'apps/renderer/**'],
          passWithNoTests: true,
        },
      },
      './apps/renderer/vitest.config.ts',
    ],
  },
});
