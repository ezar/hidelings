import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'poc', 'docs', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['scripts/**/*.mjs', '*.config.{js,ts}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
