import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.js',
      'jest.config.js',
      'commitlint.config.mjs',
      'lint-staged.config.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2024,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      unicorn,
    },
    rules: {
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-array-for-each': 'error',
      'unicorn/no-useless-undefined': 'error', // equivalente a noUselessUndefined
      'unicorn/prefer-string-slice': 'error', // equivalente a noSubstr
      'unicorn/prefer-at': 'error', // equivalente a useAtIndex

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: 'error',
    },
  },

  // Migrations and seeds — relaxed rules
  {
    files: ['src/database/migrations/**/*.ts', 'src/database/seeds/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // Tests — relaxed rules
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  prettierConfig
);
