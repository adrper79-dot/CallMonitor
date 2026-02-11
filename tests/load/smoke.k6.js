/**
 * Smoke Test
 *
 * Purpose: Quick sanity check before full load tests
 * Profile: 10 concurrent users for 1 minute
 *
 * Success Criteria:
 * - All critical endpoints reachable
 * - No auth errors
 * - p95 latency < 1s
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const API_BASE = __ENV.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev';
const errorRate = new Rate('errors');

export const options = {
  vus: 10,
  duration: '1m',

  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% < 1s
    http_req_failed: ['rate<0.01'],      // Error rate < 1%
    errors: ['rate<0.01'],
    checks: ['rate>0.95'],               // 95% of checks pass
  },
};

export function setup() {
  // Test health endpoint first
  const healthRes = http.get(`${API_BASE}/health`);
  if (healthRes.status !== 200) {
    throw new Error('Health check failed - system may be down');
  }

  // Authenticate
  const loginRes = http.post(`${API_BASE}/api/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_USER_EMAIL,
      password: __ENV.TEST_USER_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    throw new Error('Authentication failed');
  }

  const token = loginRes.json().session?.id || loginRes.json().token;
  return { token };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test critical endpoints only
  const endpoints = [
    '/api/users/me',
    '/api/organizations/current',
    '/api/voice/config',
    '/api/calls?limit=5',
  ];

  for (const endpoint of endpoints) {
    const res = http.get(`${API_BASE}${endpoint}`, { headers });

    const ok = check(res, {
      [`${endpoint} status 200`]: (r) => r.status === 200,
      [`${endpoint} has data`]: (r) => {
        try {
          return r.json().success === true;
        } catch (e) {
          return false;
        }
      },
    });

    if (!ok) errorRate.add(1);

    sleep(0.5);
  }
}

export function teardown(data) {
  console.log('✅ Smoke test complete');
}
