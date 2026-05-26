// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.vite/**',
    ],
  },

  // Baseline JS + type-checked TS
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Type-aware parser via project service (auto-discovers nearest tsconfig;
  // root config files fall back to an inferred default project).
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.*'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Project-wide strict rules for TypeScript sources.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': 'warn',
    },
  },

  // React (renderer) — recommended + new JSX runtime (no React import needed).
  {
    files: ['**/*.{jsx,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    ...react.configs.flat['jsx-runtime'],
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Node globals for config files + Electron main process.
  {
    files: ['**/*.config.{ts,js,mts,cts}', 'apps/main/**/*.{ts,mts,cts}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Plain JS (incl. this config) does not get type-aware linting.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // CLI scripts run under Node and may write to stdout.
  {
    files: ['**/scripts/**', '**/*.cli.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
);
