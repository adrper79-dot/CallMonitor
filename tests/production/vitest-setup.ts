/**
 * Production Test Vitest Setup
 * 
 * This setup file is specifically for production integration tests.
 * It does NOT mock anything - we want real connections to everything.
 */

import { config } from 'dotenv'

// Load production test environment
config({ path: './tests/.env.production' })

// Validate we have real credentials
const required = ['DATABASE_URL', 'WORKERS_API_URL', 'TEST_ORG_ID', 'TEST_USER_ID']
const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('❌ Missing required environment variables for production tests:')
  missing.forEach(key => console.error(`   - ${key}`))
  console.error('\nCreate tests/.env.production with real credentials.')
  process.exit(1)
}

console.log('🚀 Production Integration Tests')
console.log('   Database: Connected to Neon PostgreSQL')
console.log(`   API: ${process.env.WORKERS_API_URL}`)
console.log(`   Test Org: ${process.env.TEST_ORG_ID}`)
console.log('   Mocks: DISABLED (real systems only)')
console.log('')
