// @ts-check
/**
 * Neural Node & Code - ESLint configuration
 *
 * Flat config for ESLint 10 and typescript-eslint 8.
 * - TypeScript files get the strictest type-aware rules.
 * - Security rules block eval-style code execution.
 * - eslint-config-prettier runs last so ESLint never fights Prettier.
 */
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // ---------------------------------------------------------------------------
  //  Files ESLint never checks
  // ---------------------------------------------------------------------------
  globalIgnores(['dist/', 'coverage/', 'node_modules/', 'public/']),

  // ---------------------------------------------------------------------------
  //  TypeScript source and tests (type-aware linting)
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ---- Security: never execute strings as code -------------------------
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      '@typescript-eslint/no-implied-eval': 'error',

      // ---- Correctness -------------------------------------------------------
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],

      // ---- TypeScript --------------------------------------------------------
      // Matches tsconfig's verbatimModuleSyntax: type-only imports use `import type`.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Allow numbers in template strings, which the HUD uses for scores and lives.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  // ---------------------------------------------------------------------------
  //  Plain JavaScript config files (like this one), which run in Node
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // ---------------------------------------------------------------------------
  //  Prettier compatibility (must stay last)
  //  Turns off any ESLint rule that would conflict with Prettier formatting.
  // ---------------------------------------------------------------------------
  prettierConfig,
);
