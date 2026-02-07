/**
 * API Authentication Test Script
 *
 * Tests the Workers API authentication flow to diagnose 401 errors.
 * Run with: npx ts-node scripts/test-api-auth.ts
 *
 * Tests:
 * 1. Verify API is reachable
 * 2. Test without auth token (should get 401)
 * 3. Test with valid Bearer token (should succeed)
 * 4. Test specific endpoints that were failing
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(level: 'info' | 'success' | 'error' | 'warn', message: string, data?: any) {
  const colorMap = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  }
  console.log(`${colorMap[level]}[${level.toUpperCase()}]${colors.reset} ${message}`)
  if (data) {
    console.log(colors.cyan, JSON.stringify(data, null, 2), colors.reset)
  }
}

interface TestResult {
  name: string
  passed: boolean
  status?: number
  error?: string
  data?: any
}

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {},
  expectStatus: number = 200
): Promise<TestResult> {
  try {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
    log('info', `Testing: ${name}`)
    log('info', `  URL: ${fullUrl}`)
    log('info', `  Headers: ${JSON.stringify(options.headers || {})}`)

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const status = response.status
    let data: any = null

    try {
      const text = await response.text()
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: 'Could not parse response' }
    }

    const passed = status === expectStatus

    if (passed) {
      log('success', `  ✓ Status ${status} (expected ${expectStatus})`)
    } else {
      log('error', `  ✗ Status ${status} (expected ${expectStatus})`)
    }

    return { name, passed, status, data }
  } catch (error: any) {
    log('error', `  ✗ Network error: ${error.message}`)
    return { name, passed: false, error: error.message }
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60))
  log('info', 'Starting API Authentication Tests')
  console.log('='.repeat(60) + '\n')

  const results: TestResult[] = []

  // Test 1: Health check (no auth required)
  results.push(await testEndpoint('1. Health Check (no auth)', '/health', {}, 200))

  // Test 2: Calls endpoint without auth (should return 401)
  results.push(await testEndpoint('2. GET /api/calls WITHOUT auth', '/api/calls', {}, 401))

  // Test 3: Organizations/current without auth (should return 401)
  results.push(
    await testEndpoint(
      '3. GET /api/organizations/current WITHOUT auth',
      '/api/organizations/current',
      {},
      401
    )
  )

  // Test 4: Users endpoint without auth (should return 401)
  results.push(
    await testEndpoint(
      '4. GET /api/users/{userId}/organization WITHOUT auth',
      '/api/users/test-user-id/organization',
      {},
      401
    )
  )

  // Test 5: Verify CORS preflight works
  results.push(
    await testEndpoint(
      '5. OPTIONS /api/calls (CORS preflight)',
      '/api/calls',
      { method: 'OPTIONS' },
      204 // No Content for OPTIONS
    )
  )

  // Interactive test: Test with real token
  console.log('\n' + '-'.repeat(60))
  log('warn', 'To test with a real token:')
  console.log(`
  1. Sign in at https://voxsouth.online/signin
  2. Open browser DevTools → Application → Local Storage
  3. Copy the value of 'wb-session-token'
  4. Run this script with: 
     SESSION_TOKEN="your-token-here" npx ts-node scripts/test-api-auth.ts
  `)

  const token = process.env.SESSION_TOKEN
  if (token) {
    console.log('\n' + '-'.repeat(60))
    log('info', 'Testing with provided SESSION_TOKEN...')

    const authHeaders = { Authorization: `Bearer ${token}` }

    // Test 6: Calls with auth
    results.push(
      await testEndpoint(
        '6. GET /api/calls WITH Bearer token',
        '/api/calls',
        { headers: authHeaders },
        200
      )
    )

    // Test 7: Organizations with auth
    results.push(
      await testEndpoint(
        '7. GET /api/organizations/current WITH Bearer token',
        '/api/organizations/current',
        { headers: authHeaders },
        200
      )
    )
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  log('info', 'Test Summary')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  results.forEach((r) => {
    const icon = r.passed ? '✓' : '✗'
    const color = r.passed ? colors.green : colors.red
    console.log(`${color}${icon}${colors.reset} ${r.name}: ${r.status || 'ERROR'}`)
    if (!r.passed && r.data) {
      console.log(`   Response: ${JSON.stringify(r.data).slice(0, 100)}...`)
    }
  })

  console.log(
    `\n${colors.green}Passed: ${passed}${colors.reset} | ${colors.red}Failed: ${failed}${colors.reset}`
  )

  // Diagnose issues
  console.log('\n' + '-'.repeat(60))
  log('info', 'Diagnosis:')

  const healthFailed = results.find((r) => r.name.includes('Health Check') && !r.passed)
  const authFailed = results.find((r) => r.name.includes('WITH Bearer token') && !r.passed)
  const noAuthWrong = results.find((r) => r.name.includes('WITHOUT auth') && r.status !== 401)

  if (healthFailed) {
    log('error', '• API is not reachable - check Workers deployment')
  }

  if (noAuthWrong) {
    log('error', '• Auth middleware not returning 401 for unauthenticated requests')
    log('error', '  → Check workers/src/lib/auth.ts requireAuth function')
  }

  if (authFailed) {
    log('error', '• Bearer token authentication failed')
    log('error', '  → Check if token is being stored in localStorage as "wb-session-token"')
    log('error', '  → Check if Workers auth.ts parseSessionToken reads Authorization header')
    log('error', '  → Check if sessions table has valid session for this token')
  }

  if (!healthFailed && !authFailed && !noAuthWrong) {
    log('success', '• API authentication appears to be working correctly')
    log('warn', '• If still getting 401 in browser, check:')
    log('warn', '  1. apiClient.ts getStoredToken() is reading from correct key')
    log('warn', '  2. AuthProvider is storing token correctly after login')
    log('warn', '  3. Browser localStorage actually has the token')
  }
}

// Run if executed directly
runTests().catch(console.error)
