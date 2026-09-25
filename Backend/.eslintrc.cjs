/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'prettier',
  ],
  ignorePatterns: ['build', 'dist', 'coverage', 'node_modules', 'vitest.config.ts'],
  rules: {
    // Existing backend code uses explicit `any` in a few third-party boundaries,
    // but unsafe `as any` assertions are never allowed.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Server output and deliberately sequential database work are expected.
    'no-console': 'off',
    'no-await-in-loop': 'off',
    // Module helpers may reference later declarations before any handler runs.
    '@typescript-eslint/no-use-before-define': 'off',
    // Mongoose documents and Socket.IO state are mutable objects.
    'no-param-reassign': ['error', { props: false }],
    'no-continue': 'off',
    // Express ignores handler returns; Mongoose requires function callbacks.
    'consistent-return': 'off',
    'func-names': 'off',
    // Cron jobs start on construction and detached promises are intentional.
    'no-new': 'off',
    'no-void': 'off',
    // The existing customError constructor intentionally has a lowercase name.
    'new-cap': 'off',
    // Destructuring can discard explicit types on request payloads.
    'prefer-destructuring': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
        message: 'Do not use `as any`; use an explicit type or `unknown`.',
      },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
      { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
    ],
    camelcase: 'off',
    'import/prefer-default-export': 'off',
    'no-underscore-dangle': 'off',
    'no-use-before-define': 'off',
    'class-methods-use-this': 'off',
  },
};
