import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest config for Production Integration Tests
 * 
 * NO MOCKS - uses real database, API, and services.
 * Run with: npm run test:production
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  },
  test: {
    globals: true,
    environment: 'node',
    // Use production setup, NOT the default setup with mocks
    setupFiles: ['./tests/production/vitest-setup.ts'],
    include: ['tests/production/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next', 'out'],
    // Important: Disable automocking
    mockReset: false,
    clearMocks: false,
    restoreMocks: false,
    env: {
      NODE_ENV: 'production'
    },
    testTimeout: 60000,
    hookTimeout: 30000,
  }
})
