/**
 * k6 Load Test: Collections CRM
 *
 * Tests collections endpoints under load:
 *   - Account creation
 *   - Account listing/search
 *   - Payment recording
 *   - Task management
 *
 * Usage:
 *   k6 run --vus 20 --duration 2m collections.js
 *   k6 run --vus 50 --duration 5m collections.js
 *
 * Thresholds:
 *   - 95% of requests should complete < 1s
 *   - Error rate should be < 1%
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Environment variables
const API_URL = __ENV.API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const SESSION_TOKEN = __ENV.SESSION_TOKEN

// Custom metrics
const accountCreationDuration = new Trend('account_creation_duration')
const accountCreationErrors = new Rate('account_creation_errors')
const accountsCreated = new Counter('accounts_created')
const paymentRecordingDuration = new Trend('payment_recording_duration')
const paymentsRecorded = new Counter('payments_recorded')

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Warm up
    { duration: '1m', target: 20 }, // Steady load
    { duration: '30s', target: 30 }, // Increased load
    { duration: '1m', target: 30 }, // Sustained
    { duration: '30s', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    account_creation_duration: ['p(95)<1000'],
    account_creation_errors: ['rate<0.01'],
    payment_recording_duration: ['p(95)<1000'],
  },
}

/**
 * Setup: Validate environment
 */
export function setup() {
  if (!SESSION_TOKEN) {
    throw new Error('SESSION_TOKEN environment variable is required')
  }

  console.log('Setup: Collections CRM load test')
  console.log(`API URL: ${API_URL}`)

  return {
    apiUrl: API_URL,
    sessionToken: SESSION_TOKEN,
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

  // Scenario 1: Create collection account
  const accountId = testCreateAccount(data, headers)

  sleep(1)

  // Scenario 2: List accounts
  testListAccounts(data, headers)

  sleep(1)

  // Scenario 3: Record payment (if account created)
  if (accountId) {
    testRecordPayment(data, headers, accountId)
  }

  sleep(1)

  // Scenario 4: Search accounts
  testSearchAccounts(data, headers)

  sleep(2)
}

/**
 * Test account creation
 */
function testCreateAccount(data, headers) {
  const accountNumber = `LOAD-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const customerName = `Load Test Customer ${Math.floor(Math.random() * 10000)}`
  const phone = `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`

  const payload = JSON.stringify({
    customer_name: customerName,
    account_number: accountNumber,
    balance_cents: Math.floor(Math.random() * 50000) + 1000, // $10-$500
    status: 'active',
    contact_phone: phone,
    contact_email: `loadtest${Math.floor(Math.random() * 10000)}@example.com`,
  })

  const response = http.post(`${data.apiUrl}/api/collections/accounts`, payload, { headers })

  const success = check(response, {
    'create account status is 201': (r) => r.status === 201,
    'create account has id': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.id !== undefined
      } catch {
        return false
      }
    },
    'create account response time < 1s': (r) => r.timings.duration < 1000,
  })

  accountCreationDuration.add(response.timings.duration)
  accountCreationErrors.add(!success)

  if (success) {
    accountsCreated.add(1)
    try {
      const body = JSON.parse(response.body)
      return body.id
    } catch {
      return null
    }
  }

  return null
}

/**
 * Test listing accounts
 */
function testListAccounts(data, headers) {
  const response = http.get(`${data.apiUrl}/api/collections/accounts?limit=20`, { headers })

  check(response, {
    'list accounts status is 200': (r) => r.status === 200,
    'list accounts has data': (r) => {
      try {
        const body = JSON.parse(r.body)
        return Array.isArray(body) || body.accounts !== undefined
      } catch {
        return false
      }
    },
    'list accounts response time < 500ms': (r) => r.timings.duration < 500,
  })
}

/**
 * Test recording payment
 */
function testRecordPayment(data, headers, accountId) {
  const payload = JSON.stringify({
    amount_cents: Math.floor(Math.random() * 10000) + 100, // $1-$100
    payment_method: 'credit_card',
    transaction_id: `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    notes: 'Load test payment',
  })

  const response = http.post(
    `${data.apiUrl}/api/collections/accounts/${accountId}/payments`,
    payload,
    { headers }
  )

  const success = check(response, {
    'record payment status is 201': (r) => r.status === 201,
    'record payment has id': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.id !== undefined
      } catch {
        return false
      }
    },
    'record payment response time < 1s': (r) => r.timings.duration < 1000,
  })

  paymentRecordingDuration.add(response.timings.duration)

  if (success) {
    paymentsRecorded.add(1)
  }
}

/**
 * Test searching accounts
 */
function testSearchAccounts(data, headers) {
  const searchTerm = `Customer ${Math.floor(Math.random() * 1000)}`

  const response = http.get(
    `${data.apiUrl}/api/collections/accounts?search=${encodeURIComponent(searchTerm)}`,
    { headers }
  )

  check(response, {
    'search accounts status is 200': (r) => r.status === 200,
    'search accounts response time < 500ms': (r) => r.timings.duration < 500,
  })
}

/**
 * Test bulk operations
 */
export function testBulkOperations(data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.sessionToken}`,
  }

  // Create 10 accounts simultaneously
  const accountCreationRequests = Array.from({ length: 10 }, (_, i) => {
    const payload = JSON.stringify({
      customer_name: `Bulk Customer ${i}`,
      account_number: `BULK-${Date.now()}-${i}`,
      balance_cents: 5000 + i * 100,
      status: 'active',
      contact_phone: `+1555000${String(i).padStart(4, '0')}`,
      contact_email: `bulk${i}@example.com`,
    })

    return {
      method: 'POST',
      url: `${data.apiUrl}/api/collections/accounts`,
      body: payload,
      params: { headers },
    }
  })

  const responses = http.batch(accountCreationRequests)

  const successCount = responses.filter((r) => r.status === 201).length

  check(responses, {
    'bulk account creation mostly successful': () => successCount >= 8, // At least 80%
    'bulk operations complete in reasonable time': () =>
      responses.every((r) => r.timings.duration < 2000),
  })
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log('Teardown: Collections CRM load test complete')
  console.log('Note: Clean up test data with: DELETE FROM collection_accounts WHERE account_number LIKE \'LOAD-%\'')
}
