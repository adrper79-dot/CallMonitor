/**
 * Production Integration Test Setup — LIVE SYSTEMS ONLY
 * 
 * Zero mocks. Every test hits real infrastructure.
 * Tests distinguish SERVICE DOWN vs TEST FAILURE vs DEGRADED.
 * 
 * Run with: npm run test:production
 */

import { config } from 'dotenv'

// Load production test environment
config({ path: './tests/.env.production' })

// ─── Required Environment ───────────────────────────────────────────────────

const required = ['WORKERS_API_URL']
const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║  MISSING REQUIRED ENV VARS FOR PRODUCTION TESTS             ║')
  console.error('╠══════════════════════════════════════════════════════════════╣')
  missing.forEach(key => console.error(`║  ❌ ${key.padEnd(56)}║`))
  console.error('║                                                              ║')
  console.error('║  Copy tests/.env.production.example to tests/.env.production ║')
  console.error('║  and fill in real values.                                    ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  process.exit(1)
}

// Defaults
process.env.WORKERS_API_URL = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'

console.log('')
console.log('┌──────────────────────────────────────────────────────────────┐')
console.log('│  🧪 LIVE INTEGRATION TESTS — NO MOCKS                       │')
console.log('│                                                              │')
console.log(`│  API:  ${(process.env.WORKERS_API_URL || '').padEnd(52)}│`)
console.log(`│  DB:   ${process.env.DATABASE_URL ? '✅ Configured'.padEnd(52) : '⚠️  Not configured (DB tests skipped)'.padEnd(52)}│`)
console.log(`│  Org:  ${(process.env.TEST_ORG_ID || 'Not set').padEnd(52)}│`)
console.log('│                                                              │')
console.log('│  Tests report SERVICE DOWN when elements are unreachable     │')
console.log('│  vs TEST FAILURE when elements return unexpected results     │')
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')
