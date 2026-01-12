#!/usr/bin/env node
/**
 * Test SignalWire space name extraction
 */

require('dotenv').config({ path: '.env.local' })

const rawSpace = String(process.env.SIGNALWIRE_SPACE || '')
console.log('Raw SIGNALWIRE_SPACE:', rawSpace)

const swSpace = rawSpace
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')
  .replace(/\.signalwire\.com$/i, '')
  .trim()

console.log('Extracted space name:', swSpace)
console.log('Expected format: just the subdomain (e.g., "myspace")')

const swProject = process.env.SIGNALWIRE_PROJECT_ID
const swEndpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`

console.log('\nConstructed endpoint:')
console.log(swEndpoint)
console.log('\nExpected format:')
console.log('https://SPACE.signalwire.com/api/laml/2010-04-01/Accounts/PROJECT_ID/Calls.json')
