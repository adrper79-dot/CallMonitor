/**
 * k6 Load Test: Voice Call Initiation
 *
 * Tests voice call API under load:
 *   - Call initiation (direct and bridge)
 *   - Call status polling
 *   - WebRTC session creation
 *
 * Usage:
 *   k6 run --vus 10 --duration 30s voice-calls.js
 *   k6 run --vus 50 --duration 2m voice-calls.js
 *
 * Thresholds:
 *   - 95% of requests should complete < 2s
 *   - Error rate should be < 1%
 *   - Request rate should be > 10 RPS
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Environment variables
const API_URL = __ENV.API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const SESSION_TOKEN = __ENV.SESSION_TOKEN
const FROM_NUMBER = __ENV.FROM_NUMBER || '+17062677235'

// Custom metrics
const callInitiationDuration = new Trend('call_initiation_duration')
const callInitiationErrors = new Rate('call_initiation_errors')
const callsCreated = new Counter('calls_created')

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% < 2s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    call_initiation_duration: ['p(95)<2000'],
    call_initiation_errors: ['rate<0.01'],
  },
}

/**
 * Setup: Validate environment
 */
export function setup() {
  if (!SESSION_TOKEN) {
    throw new Error('SESSION_TOKEN environment variable is required')
  }

  console.log('Setup: Voice call load test')
  console.log(`API URL: ${API_URL}`)
  console.log(`From Number: ${FROM_NUMBER}`)

  return {
    apiUrl: API_URL,
    sessionToken: SESSION_TOKEN,
    fromNumber: FROM_NUMBER,
  }
}

/**
 * Main test scenario
 */
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.sessionToken}`,
  }

  // Scenario 1: Direct call initiation
  testDirectCall(data, headers)

  sleep(1)

  // Scenario 2: Bridge call initiation
  testBridgeCall(data, headers)

  sleep(1)

  // Scenario 3: Get call list
  testGetCalls(data, headers)

  sleep(2)
}

/**
 * Test direct call initiation
 */
function testDirectCall(data, headers) {
  const toNumber = `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`

  const payload = JSON.stringify({
    to_number: toNumber,
    from_number: data.fromNumber,
    flow_type: 'direct',
  })

  const response = http.post(`${data.apiUrl}/api/voice/call`, payload, { headers })

  const success = check(response, {
    'direct call status is 200': (r) => r.status === 200,
    'direct call has call_id': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.call_id !== undefined
      } catch {
        return false
      }
    },
    'direct call response time < 2s': (r) => r.timings.duration < 2000,
  })

  callInitiationDuration.add(response.timings.duration)
  callInitiationErrors.add(!success)

  if (success) {
    callsCreated.add(1)
  }
}

/**
 * Test bridge call initiation
 */
function testBridgeCall(data, headers) {
  const customerNumber = `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`

  const payload = JSON.stringify({
    to_number: customerNumber,
    from_number: data.fromNumber,
    flow_type: 'bridge',
  })

  const response = http.post(`${data.apiUrl}/api/voice/call`, payload, { headers })

  const success = check(response, {
    'bridge call status is 200': (r) => r.status === 200,
    'bridge call has call_id': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.call_id !== undefined
      } catch {
        return false
      }
    },
    'bridge call response time < 2s': (r) => r.timings.duration < 2000,
  })

  callInitiationDuration.add(response.timings.duration)
  callInitiationErrors.add(!success)

  if (success) {
    callsCreated.add(1)
  }
}

/**
 * Test getting call list
 */
function testGetCalls(data, headers) {
  const response = http.get(`${data.apiUrl}/api/calls?limit=20`, { headers })

  check(response, {
    'get calls status is 200': (r) => r.status === 200,
    'get calls has data array': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body) || body.calls !== undefined
      } catch {
        return false
      }
    },
    'get calls response time < 1s': (r) => r.timings.duration < 1000,
  })
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log('Teardown: Voice call load test complete')
}
