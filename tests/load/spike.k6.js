/**
 * Spike Test
 *
 * Purpose: Verify graceful handling of sudden traffic spikes
 * Profile: 10 → 500 → 10 users over 8 minutes
 *
 * Success Criteria:
 * - p95 latency < 2s during spike
 * - Error rate < 1% during spike
 * - System recovers within 30s after spike
 * - No cascading failures
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const API_BASE = __ENV.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev';
const errorRate = new Rate('errors');
const spikeErrors = new Rate('spike_errors');
const recoveryTime = new Trend('recovery_time');

export const options = {
  stages: [
    { duration: '2m', target: 10 },     // Baseline: 10 users
    { duration: '30s', target: 500 },   // SPIKE: Ramp to 500 users
    { duration: '2m', target: 500 },    // Hold spike
    { duration: '30s', target: 10 },    // Ramp down to 10
    { duration: '3m', target: 10 },     // Recovery period
  ],

  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% < 2s (relaxed during spike)
    http_req_failed: ['rate<0.01'],      // Error rate < 1%
    errors: ['rate<0.01'],
  },
};

export function setup() {
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

  return {
    token: loginRes.json().session?.id || loginRes.json().token,
    spikeStarted: false,
    recoveryStarted: false,
  };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Track if we're in spike phase
  const currentVUs = __VU;
  const inSpike = currentVUs > 100;

  const start = Date.now();

  // Test high-traffic endpoints
  const res = http.get(`${API_BASE}/api/calls?limit=10`, { headers });

  const duration = Date.now() - start;

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has data': (r) => {
      try {
        return r.json().success === true;
      } catch (e) {
        return false;
      }
    },
    'latency acceptable': () => duration < 2000,
  });

  if (!ok) {
    errorRate.add(1);
    if (inSpike) {
      spikeErrors.add(1);
    }
  }

  // Shorter sleep during spike (more aggressive)
  sleep(inSpike ? 0.5 : 2);
}

export function teardown(data) {
  console.log('✅ Spike test complete');
  console.log('   Check for:');
  console.log('   - No cascading failures');
  console.log('   - System recovered after spike');
  console.log('   - Error rate remained acceptable');
}
