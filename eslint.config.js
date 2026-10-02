import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'factory-playwright-report', 'test-results', 'factory-test-results']),
  {
    files: ['**/*.mjs', '*.config.js'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  { files: ['src/main.jsx'], rules: { 'react-refresh/only-export-components': 'off' } },
  { files: ['tests/factory/*.pw.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
])
