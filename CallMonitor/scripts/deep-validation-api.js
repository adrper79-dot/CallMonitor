#!/usr/bin/env node
/**
 * DEEP VALIDATION: API Endpoint Test Script
 * Tests all critical API endpoints for connectivity and response
 * 
 * Usage: node scripts/deep-validation-api.js [BASE_URL]
 * Default URL: https://voxsouth.online
 */

const BASE_URL = process.argv[2] || 'https://voxsouth.online';

const ENDPOINTS = [
  // Health checks (no auth required)
  { method: 'GET', path: '/api/health', requiresAuth: false, description: 'System health' },
  { method: 'GET', path: '/api/health/env', requiresAuth: false, description: 'Environment check' },
  { method: 'GET', path: '/api/health/auth-providers', requiresAuth: false, description: 'Auth providers' },
  
  // Auth endpoints
  { method: 'GET', path: '/api/auth/session', requiresAuth: false, description: 'Session check' },
  
  // Voice endpoints (require auth)
  { method: 'GET', path: '/api/voice/config?orgId=test', requiresAuth: true, description: 'Voice config' },
  { method: 'GET', path: '/api/voice/targets?orgId=test', requiresAuth: true, description: 'Voice targets' },
  
  // Call endpoints (require auth)
  { method: 'GET', path: '/api/calls?limit=1', requiresAuth: true, description: 'Calls list' },
  { method: 'GET', path: '/api/call-capabilities', requiresAuth: true, description: 'Call capabilities' },
  
  // Bookings (require auth)
  { method: 'GET', path: '/api/bookings?limit=1', requiresAuth: true, description: 'Bookings list' },
  
  // Surveys (require auth)
  { method: 'GET', path: '/api/surveys?limit=1', requiresAuth: true, description: 'Surveys list' },
  
  // Campaigns (require auth)
  { method: 'GET', path: '/api/campaigns?limit=1', requiresAuth: true, description: 'Campaigns list' },
  
  // Audit logs (require auth)
  { method: 'GET', path: '/api/audit-logs?limit=1', requiresAuth: true, description: 'Audit logs' },
  
  // RBAC (require auth)
  { method: 'GET', path: '/api/rbac/context', requiresAuth: true, description: 'RBAC context' },
  
  // Shopper scripts (require auth)
  { method: 'GET', path: '/api/shopper/scripts', requiresAuth: true, description: 'Shopper scripts' },
  
  // SignalWire numbers (require auth)
  { method: 'GET', path: '/api/signalwire/numbers', requiresAuth: true, description: 'SignalWire numbers' },
];

const results = {
  passed: [],
  failed: [],
  authRequired: [],
  errors: []
};

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const startTime = Date.now();
  
  try {
    const res = await fetch(url, {
      method: endpoint.method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Don't follow redirects
      redirect: 'manual'
    });
    
    const duration = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || '';
    
    // Check if it's a redirect (auth required)
    if (res.status === 307 || res.status === 302 || res.status === 303) {
      return {
        ...endpoint,
        status: res.status,
        duration,
        result: 'REDIRECT',
        message: 'Auth redirect'
      };
    }
    
    // Try to parse JSON
    let body = null;
    if (contentType.includes('application/json')) {
      try {
        body = await res.json();
      } catch (e) {
        body = { parseError: true };
      }
    }
    
    // Determine result
    if (res.ok || res.status === 200) {
      return {
        ...endpoint,
        status: res.status,
        duration,
        result: 'PASS',
        message: body?.success !== false ? 'OK' : (body?.error?.message || 'Response indicates failure')
      };
    } else if (res.status === 401 || res.status === 403) {
      return {
        ...endpoint,
        status: res.status,
        duration,
        result: 'AUTH_REQUIRED',
        message: endpoint.requiresAuth ? 'Expected (needs auth)' : 'Unexpected auth error'
      };
    } else {
      return {
        ...endpoint,
        status: res.status,
        duration,
        result: 'FAIL',
        message: body?.error?.message || body?.error || `HTTP ${res.status}`
      };
    }
  } catch (err) {
    return {
      ...endpoint,
      status: 0,
      duration: Date.now() - startTime,
      result: 'ERROR',
      message: err.message
    };
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEEP VALIDATION: API ENDPOINT TESTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Total Endpoints: ${ENDPOINTS.length}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    
    const icon = 
      result.result === 'PASS' ? '✅' :
      result.result === 'AUTH_REQUIRED' ? '🔐' :
      result.result === 'REDIRECT' ? '↪️' :
      result.result === 'FAIL' ? '❌' : '⚠️';
    
    console.log(`${icon} ${result.method.padEnd(6)} ${result.path.padEnd(45)} ${result.status} ${result.duration}ms`);
    if (result.result !== 'PASS' && result.result !== 'AUTH_REQUIRED') {
      console.log(`   └── ${result.message}`);
    }
    
    // Categorize result
    if (result.result === 'PASS') {
      results.passed.push(result);
    } else if (result.result === 'AUTH_REQUIRED' || result.result === 'REDIRECT') {
      results.authRequired.push(result);
    } else if (result.result === 'FAIL') {
      results.failed.push(result);
    } else {
      results.errors.push(result);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Passed:        ${results.passed.length}`);
  console.log(`  🔐 Auth Required: ${results.authRequired.length}`);
  console.log(`  ❌ Failed:        ${results.failed.length}`);
  console.log(`  ⚠️  Errors:        ${results.errors.length}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED ENDPOINTS:');
    results.failed.forEach(r => {
      console.log(`   - ${r.method} ${r.path}: ${r.message}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  ERROR ENDPOINTS:');
    results.errors.forEach(r => {
      console.log(`   - ${r.method} ${r.path}: ${r.message}`);
    });
  }

  console.log('\n✅ Validation complete!');
  
  // Exit code based on results
  const hasRealFailures = results.failed.filter(r => !r.requiresAuth).length > 0;
  process.exit(hasRealFailures || results.errors.length > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
