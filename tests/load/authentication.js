/**
 * k6 Load Test: Authentication & Session Management
 *
 * Tests authentication endpoints under load:
 *   - Login requests
 *   - Session validation
 *   - Token refresh
 *
 * Usage:
 *   k6 run --vus 20 --duration 1m authentication.js
 *   k6 run --vus 100 --duration 5m authentication.js
 *
 * Thresholds:
 *   - 95% of auth requests should complete < 1s
 *   - Error rate should be < 0.5%
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Environment variables
const API_URL = __ENV.API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const TEST_EMAIL = __ENV.TEST_EMAIL
const TEST_PASSWORD = __ENV.TEST_PASSWORD

// Custom metrics
const loginDuration = new Trend('login_duration')
const loginErrors = new Rate('login_errors')
const sessionValidations = new Counter('session_validations')
const validSessionRate = new Rate('valid_session_rate')

// Test configuration
export const options = {
  stages: [
    { duration: '20s', target: 10 }, // Warm up
    { duration: '1m', target: 20 }, // Steady load
    { duration: '30s', target: 50 }, // Peak load
    { duration: '1m', target: 50 }, // Sustained peak
    { duration: '30s', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% < 1s
    http_req_failed: ['rate<0.005'], // Error rate < 0.5%
    login_duration: ['p(95)<1000'],
    login_errors: ['rate<0.01'],
    valid_session_rate: ['rate>0.95'], // 95% valid sessions
  },
}

/**
 * Setup: Validate environment
 */
export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD environment variables are required')
  }

  console.log('Setup: Authentication load test')
  console.log(`API URL: ${API_URL}`)
  console.log(`Test Email: ${TEST_EMAIL}`)

  return {
    apiUrl: API_URL,
    testEmail: TEST_EMAIL,
    testPassword: TEST_PASSWORD,
  }
}

/**
 * Main test scenario
 */
export default function (data) {
  // Scenario 1: Login and get session
  const sessionToken = testLogin(data)

  sleep(1)

  // Scenario 2: Validate session with authenticated request
  if (sessionToken) {
    testAuthenticatedRequest(data, sessionToken)
    sleep(1)
  }

  // Scenario 3: Multiple authenticated requests with same session
  if (sessionToken) {
    testSessionReuse(data, sessionToken)
  }

  sleep(2)
}

/**
 * Test login endpoint
 */
function testLogin(data) {
  const payload = JSON.stringify({
    email: data.testEmail,
    password: data.testPassword,
  })

  const headers = {
    'Content-Type': 'application/json',
  }

  const response = http.post(`${data.apiUrl}/api/auth/login`, payload, { headers })

  const success = check(response, {
    'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login response has token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.session_token !== undefined || body.token !== undefined
      } catch {
        return false
      }
    },
    'login response time < 1s': (r) => r.timings.duration < 1000,
  })

  loginDuration.add(response.timings.duration)
  loginErrors.add(!success)

  // Extract session token
  if (success) {
    try {
      const body = JSON.parse(response.body)
      return body.session_token || body.token
    } catch {
      return null
    }
  }

  return null
}

/**
 * Test authenticated request
 */
function testAuthenticatedRequest(data, sessionToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  }

  const response = http.get(`${data.apiUrl}/api/calls?limit=10`, { headers })

  const success = check(response, {
    'authenticated request status is 200': (r) => r.status === 200,
    'authenticated request not 401': (r) => r.status !== 401,
    'authenticated request response time < 500ms': (r) => r.timings.duration < 500,
  })

  sessionValidations.add(1)
  validSessionRate.add(success)
}

/**
 * Test session reuse (multiple requests with same token)
 */
function testSessionReuse(data, sessionToken) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionToken}`,
  }

  // Make 3 rapid requests with same session
  for (let i = 0; i < 3; i++) {
    const endpoints = [
      '/api/calls?limit=5',
      '/api/analytics/sentiment',
      '/api/voice/targets',
    ]

    const endpoint = endpoints[i % endpoints.length]
    const response = http.get(`${data.apiUrl}${endpoint}`, { headers })

    check(response, {
      'session reuse status is 200': (r) => r.status === 200,
      'session reuse not 401': (r) => r.status !== 401,
    })

    sleep(0.5)
  }
}

/**
 * Test concurrent logins (different users)
 */
export function testConcurrentLogins() {
  // Simulate multiple users logging in simultaneously
  const users = Array.from({ length: 10 }, (_, i) => ({
    email: `loadtest${i}@example.com`,
    password: 'LoadTest123!',
  }))

  const requests = users.map((user) => {
    const payload = JSON.stringify(user)
    const headers = { 'Content-Type': 'application/json' }
    return {
      method: 'POST',
      url: `${API_URL}/api/auth/login`,
      body: payload,
      params: { headers },
    }
  })

  const responses = http.batch(requests)

  const successCount = responses.filter((r) => r.status === 200 || r.status === 201).length

  check(responses, {
    'concurrent logins mostly successful': () => successCount >= users.length * 0.8,
  })
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log('Teardown: Authentication load test complete')
}
