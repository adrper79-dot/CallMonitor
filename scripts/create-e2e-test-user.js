#!/usr/bin/env node

/**
 * Create E2E Test User Script
 *
 * Creates a test user account for E2E testing via the API.
 * This is more reliable than manual signup through the UI.
 */

const https = require('https')

// Test user credentials
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'adrper79@gmail.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123qweASD'
const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

console.log('🚀 Creating E2E test user...')
console.log(`📧 Email: ${TEST_EMAIL}`)
console.log(`🔑 Password: ${TEST_PASSWORD}`)
console.log(`🌐 API: ${API_BASE}`)

// Signup payload
const signupData = {
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  name: 'E2E Test User',
  organizationName: 'E2E Test Organization'
}

const data = JSON.stringify(signupData)

const options = {
  hostname: 'wordisbond-api.adrper79.workers.dev',
  port: 443,
  path: '/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'User-Agent': 'E2E-Test-Setup/1.0'
  }
}

const req = https.request(options, (res) => {
  console.log(`📡 Status: ${res.statusCode}`)
  console.log(`📡 Headers:`, res.headers)

  let body = ''
  res.on('data', (chunk) => {
    body += chunk
  })

  res.on('end', () => {
    try {
      const response = JSON.parse(body)
      console.log('📦 Response:', response)

      if (res.statusCode === 201 || res.statusCode === 200) {
        console.log('✅ User created successfully!')
        console.log('📧 Please check your email and verify the account.')
        console.log('🔗 Verification link will be sent to:', TEST_EMAIL)
      } else if (response.error && response.error.includes('already exists')) {
        console.log('ℹ️  User already exists. Proceeding with existing account.')
      } else {
        console.log('❌ Failed to create user:', response.error || response)
        process.exit(1)
      }
    } catch (e) {
      console.log('❌ Failed to parse response:', body)
      process.exit(1)
    }
  })
})

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message)
  process.exit(1)
})

req.write(data)
req.end()