/**
 * `no-restricted-syntax` below guards the UI conventions documented in
 * CLAUDE.md > UI Conventions (Frontend). Each selector matches a class name
 * inside a `className` attribute — either a plain string literal, a string
 * literal inside a conditional, or a chunk of a template literal.
 */
const DEAD_V4_CLASSES = [
  'input-bordered',
  'select-bordered',
  'textarea-bordered',
  'file-input-bordered',
  'form-control',
  'label-text',
  'label-text-alt',
  'tabs-boxed',
  'card-compact',
  'tab-lg',
].join('|');

const BANNED_SHADOWS = ['shadow-md', 'shadow-xl', 'shadow-2xl'].join('|');

const classNameLiteral = (pattern) =>
  `JSXAttribute[name.name='className'] Literal[value=/${pattern}/]`;
const classNameTemplate = (pattern) =>
  `JSXAttribute[name.name='className'] TemplateElement[value.raw=/${pattern}/]`;

const forbid = (pattern, message) => [
  { selector: classNameLiteral(pattern), message },
  { selector: classNameTemplate(pattern), message },
];

module.exports = {
  root: true,
  env: { browser: true, node: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  // `vendor` is a checked-in copy of a package owned by another repository
  // (see Frontend/vendor/yomitan-content/README.md). It is linted where it is
  // maintained; linting the copy here would only invite edits to the copy.
  ignorePatterns: ['dist', 'vendor', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@stylistic/js'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'no-restricted-syntax': [
      'error',
      ...forbid(
        `(^|\\\\s)(${DEAD_V4_CLASSES})($|\\\\s)`,
        'This daisyUI v4 class does not exist in v5. See CLAUDE.md > UI Conventions.'
      ),
      ...forbid(
        '(^|\\\\s)btn-disabled($|\\\\s)',
        'Use the `disabled` attribute. `btn-disabled` only sets pointer-events:none, so the control stays keyboard-focusable and Enter-activatable. On a non-button element, pair it with tabIndex={-1} and aria-disabled.'
      ),
      ...forbid(
        `(^|\\\\s)(${BANNED_SHADOWS})($|\\\\s)`,
        'Only shadow-sm (resting) and shadow-lg (floating) are allowed. Prefer the `surface` / `surface-raised` utilities.'
      ),
    ],
  },
};
