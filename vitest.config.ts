import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next', 'out', 'workers', '**/archived/**', 'tests/production/**'],
    env: {
      NODE_ENV: 'test'
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 50,
        statements: 60
      },
      exclude: [
        'node_modules/',
        'tests/',
        '__tests__/',
        '*.config.*',
        'migrations/',
        'docs/',
        'ARCH_DOCS/',
        'workers/',
        '**/*.d.ts',
        'app/api/**' // API routes now in workers/
      ]
    }
  }
})
