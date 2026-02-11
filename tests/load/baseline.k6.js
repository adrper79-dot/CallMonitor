/**
 * Baseline Load Test
 *
 * Purpose: Verify normal production traffic performance
 * Profile: 50 concurrent users for 10 minutes
 *
 * Success Criteria:
 * - p95 latency < 500ms
 * - Error rate < 0.1%
 * - No database connection errors
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Environment variables
const API_BASE = __ENV.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev';

// Custom metrics
const errorRate = new Rate('errors');
const authErrors = new Counter('auth_errors');
const dataErrors = new Counter('data_errors');
const responseTime = new Trend('custom_response_time');

// Test configuration
export const options = {
  vus: 50,                    // 50 concurrent users
  duration: '10m',            // Run for 10 minutes

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.001'],                  // Error rate < 0.1%
    errors: ['rate<0.001'],                           // Custom error rate < 0.1%
    checks: ['rate>0.99'],                            // 99% of checks pass
  },

  // Graceful ramp-up and ramp-down
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '9m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

// Setup: Authenticate once per VU
export function setup() {
  const loginRes = http.post(`${API_BASE}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_USER_EMAIL,
      password: __ENV.TEST_USER_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (loginRes.status !== 200) {
    console.error('Authentication failed:', loginRes.status, loginRes.body);
    throw new Error('Setup failed: Could not authenticate');
  }

  const body = loginRes.json();
  const token = body.session?.id || body.token;

  if (!token) {
    console.error('No token in response:', loginRes.body);
    throw new Error('Setup failed: No token received');
  }

  console.log('✅ Setup complete: Authenticated successfully');
  return { token };
}

// Main test scenario
export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Simulate realistic user behavior
  group('User Identity Flow', () => {
    const start = Date.now();

    // 1. Get current user
    let res = http.get(`${API_BASE}/api/users/me`, { headers });
    const duration = Date.now() - start;

    responseTime.add(duration);

    const ok = check(res, {
      'users/me status 200': (r) => r.status === 200,
      'users/me has data': (r) => {
        try {
          const json = r.json();
          return json.success && json.user && json.user.id;
        } catch (e) {
          return false;
        }
      },
      'users/me response time < 500ms': () => duration < 500,
    });

    if (!ok) {
      errorRate.add(1);
      authErrors.add(1);
    }
  });

  sleep(1); // Think time

  group('Organization Context', () => {
    // 2. Get organization
    let res = http.get(`${API_BASE}/api/organizations/current`, { headers });

    const ok = check(res, {
      'org status 200': (r) => r.status === 200,
      'org has data': (r) => {
        try {
          const json = r.json();
          return json.success && json.organization && json.organization.id;
        } catch (e) {
          return false;
        }
      },
    });

    if (!ok) {
      errorRate.add(1);
      authErrors.add(1);
    }
  });

  sleep(2);

  group('Voice Operations', () => {
    // 3. Get voice config
    let res = http.get(`${API_BASE}/api/voice/config`, { headers });

    check(res, {
      'config status 200': (r) => r.status === 200,
      'config has data': (r) => {
        try {
          const json = r.json();
          return json.success && json.config;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);

    sleep(1);

    // 4. Get calls list
    res = http.get(`${API_BASE}/api/calls?limit=10&page=1`, { headers });

    const ok = check(res, {
      'calls status 200': (r) => r.status === 200,
      'calls has array': (r) => {
        try {
          const json = r.json();
          return json.success && Array.isArray(json.calls);
        } catch (e) {
          return false;
        }
      },
    });

    if (!ok) {
      errorRate.add(1);
      dataErrors.add(1);
    }
  });

  sleep(2);

  group('Analytics', () => {
    // 5. Get KPIs
    let res = http.get(`${API_BASE}/api/analytics/kpis`, { headers });

    check(res, {
      'kpis status 200': (r) => r.status === 200,
      'kpis has data': (r) => {
        try {
          const json = r.json();
          return json.success && json.kpis;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(3);

  group('Billing', () => {
    // 6. Get billing info
    let res = http.get(`${API_BASE}/api/billing`, { headers });

    check(res, {
      'billing status 200': (r) => r.status === 200,
      'billing has data': (r) => {
        try {
          const json = r.json();
          return json.success && json.billing;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);
  });

  sleep(5); // Longer think time between iterations
}

// Teardown: Log summary
export function teardown(data) {
  console.log('\n✅ Baseline load test complete');
}
