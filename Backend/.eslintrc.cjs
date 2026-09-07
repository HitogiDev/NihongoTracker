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
  ignorePatterns: ['build', 'dist', 'coverage', 'node_modules'],
  rules: {
    // Existing backend code uses explicit `any` in a few third-party boundaries,
    // but unsafe `as any` assertions are never allowed.
    '@typescript-eslint/no-explicit-any': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
        message: 'Do not use `as any`; use an explicit type or `unknown`.',
      },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
      { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
    ],
    camelcase: 'off',
    'import/prefer-default-export': 'off',
    'no-underscore-dangle': 'off',
    'no-use-before-define': 'off',
    'class-methods-use-this': 'off',
  },
};
