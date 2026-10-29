// eslint.config.js — checks the game's code (npm run lint). The site itself has no
// build step: this is only a tool for writing the code, never shipped to the page.
//
// Besides catching mistakes, it keeps the syntax simple:
//   no a ? b : c ? d : e      → write if/else, or look the answer up in a table
//   one statement per line, lines up to 120 characters
//   no "let a = 1, b = 2"     → one declaration each
//   no comma tricks (a(), b()) and no reusing a name from an outer scope
// They are errors, like the mistakes: npm run lint must come back clean.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

const simple = 'error';

export default [
  { ignores: ['node_modules/', 'artifacts/', 'digit_model/', 'mnist_tfjs_model/', 'models/'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, tf: 'readonly' },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],   // x == null: null or undefined, on purpose

      'no-nested-ternary': simple,
      'one-var': [simple, 'never'],
      'no-sequences': simple,
      'no-shadow': simple,
      '@stylistic/max-statements-per-line': [simple, { max: 1 }],
      '@stylistic/max-len': [simple, { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true, ignoreRegExpLiterals: true }],
    },
  },
  {
    files: ['tests/**/*.mjs', 'docs/demo/**/*.{js,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
];
