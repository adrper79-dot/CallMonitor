#!/usr/bin/env node

/**
 * E2E Test Setup Script
 *
 * Creates a dedicated test user account for E2E testing
 * and configures the authentication state for Playwright tests.
 *
 * Usage:
 *   npm run test:setup:e2e
 */

const fs = require('fs')
const path = require('path')

// Test user credentials (should be set via environment)
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'adrper79@gmail.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123qweASD'

console.log('🚀 Setting up E2E test environment...')
console.log(`📧 Test Email: ${TEST_EMAIL}`)
console.log(`🔑 Test Password: ${TEST_PASSWORD}`)

// Create .env.e2e file for test environment
const envContent = `# E2E Test Environment Variables
BASE_URL=https://wordis-bond.com
E2E_TEST_EMAIL=${TEST_EMAIL}
E2E_TEST_PASSWORD=${TEST_PASSWORD}
`

const envPath = path.join(__dirname, '.env.e2e')
fs.writeFileSync(envPath, envContent)
console.log('✅ Created .env.e2e file')

// Instructions for manual setup
console.log('\n📋 Manual Setup Required:')
console.log('1. Create a test user account at https://wordis-bond.com/signup')
console.log(`   Email: ${TEST_EMAIL}`)
console.log(`   Password: ${TEST_PASSWORD}`)
console.log('2. Verify the email address')
console.log('3. Run: npx playwright test tests/e2e/auth.setup.ts')
console.log('4. Run: npm run test:e2e')
console.log('\n🔧 Alternative: Set environment variables directly:')
console.log(`   $env:E2E_TEST_EMAIL = "${TEST_EMAIL}"`)
console.log(`   $env:E2E_TEST_PASSWORD = "${TEST_PASSWORD}"`)
console.log(`   $env:BASE_URL = "https://wordis-bond.com"`)

console.log('\n✨ E2E test environment setup complete!')