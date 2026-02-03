import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  ...compat.extends('next/core-web-vitals', 'prettier'),
  {
    rules: {
      // Warn on console.log for gradual cleanup (allow warn/error/info)
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // Demote to warnings for incremental cleanup
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-sync-scripts': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  {
    files: ['scripts/**/*', 'tools/**/*', 'tests/**/*', '__tests__/**/*', 'workers/**/*', 'migrations/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'dist/',
      'dist_deploy/',
      '.open-next/',
      '.wrangler/',
      'workers/dist/',
      '*.config.js',
      '*.config.ts',
    ],
  },
]
