#!/usr/bin/env node
/**
 * Diagnostic script to check SignalWire configuration
 * Run with: node scripts/check-signalwire-config.js
 */

require('dotenv').config({ path: '.env.local' })

const requiredVars = [
  'SIGNALWIRE_PROJECT_ID',
  'SIGNALWIRE_TOKEN',
  'SIGNALWIRE_SPACE',
  'SIGNALWIRE_NUMBER'
]

console.log('\n=== SignalWire Configuration Check ===\n')

const missing = []
const present = []

for (const varName of requiredVars) {
  const value = process.env[varName]
  if (!value) {
    missing.push(varName)
    console.log(`❌ ${varName}: NOT SET`)
  } else {
    present.push(varName)
    // Show first 4 chars + length for verification without exposing full value
    const preview = value.substring(0, 4) + '...' + `(${value.length} chars)`
    console.log(`✅ ${varName}: ${preview}`)
  }
}

console.log('\n=== Summary ===\n')
console.log(`Present: ${present.length}/${requiredVars.length}`)
console.log(`Missing: ${missing.length}/${requiredVars.length}`)

if (missing.length > 0) {
  console.log('\n⚠️  SignalWire is NOT configured properly!')
  console.log('   Calls will use MOCK mode in development.')
  console.log('   Add these variables to your .env.local file:\n')
  missing.forEach(v => console.log(`   ${v}=your_value_here`))
  console.log('')
  process.exit(1)
} else {
  console.log('\n✅ SignalWire is configured correctly!')
  console.log('   All required variables are set.')
  console.log('')
  process.exit(0)
}
