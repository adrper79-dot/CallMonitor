#!/usr/bin/env node
/**
 * Test script to make a call and show full response
 * Run with: node scripts/test-make-call.js
 */

require('dotenv').config({ path: '.env.local' })

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const ORG_ID = 'e102e31a-884d-48b1-a3ac-8a930dd75829'  // From your logs
const PHONE_NUMBER = '+17062677235'  // From your logs

async function makeTestCall() {
  console.log('\n=== Making Test Call ===\n')
  console.log(`API URL: ${API_URL}`)
  console.log(`Organization: ${ORG_ID}`)
  console.log(`Phone: ${PHONE_NUMBER}`)
  console.log('')

  const payload = {
    organization_id: ORG_ID,
    phone_number: PHONE_NUMBER,
    modulations: {
      record: true,
      transcribe: true
    }
  }

  console.log('Request payload:')
  console.log(JSON.stringify(payload, null, 2))
  console.log('')

  try {
    const response = await fetch(`${API_URL}/api/calls/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log(`Response status: ${response.status} ${response.statusText}`)
    console.log('')

    const data = await response.json()
    console.log('Response body:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    if (data.success) {
      console.log('✅ Call initiated successfully!')
      console.log(`Call ID: ${data.call_id}`)
    } else {
      console.log('❌ Call failed!')
      if (data.error) {
        console.log(`Error code: ${data.error.code}`)
        console.log(`Error message: ${data.error.message}`)
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

makeTestCall()
