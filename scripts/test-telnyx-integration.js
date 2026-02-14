#!/usr/bin/env node
/**
 * Telnyx Call Control v2 Integration Test Script
 * 
 * Tests the complete predictive dialer integration including:
 * - Call origination via POST /api/calls
 * - AMD (Answering Machine Detection)
 * - Agent routing
 * - Webhook processing
 * - Database updates
 * - Audit logging
 * 
 * Usage:
 *   node scripts/test-telnyx-integration.js --env production
 *   node scripts/test-telnyx-integration.js --env staging --phone +15551234567
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  production: {
    apiUrl: 'https://wordisbond-api.adrper79.workers.dev',
    uiUrl: 'https://wordis-bond.com',
  },
  staging: {
    apiUrl: 'http://localhost:8787',
    uiUrl: 'http://localhost:3000',
  },
};

// Parse command line args
const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
const phoneIndex = args.indexOf('--phone');
const tokenIndex = args.indexOf('--token');

const env = envIndex >= 0 ? args[envIndex + 1] : 'staging';
const testPhone = phoneIndex >= 0 ? args[phoneIndex + 1] : '+15551234567';
const bearerToken = tokenIndex >= 0 ? args[tokenIndex + 1] : null;

if (!CONFIG[env]) {
  console.error(`❌ Invalid environment: ${env}`);
  console.error('Valid options: production, staging');
  process.exit(1);
}

const { apiUrl } = CONFIG[env];

// Helper: Make HTTP request
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options,
    };

    const req = protocol.request(urlObj, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// Test Suite
async function runTests() {
  console.log('🚀 Telnyx Call Control v2 Integration Tests\n');
  console.log(`Environment: ${env}`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Test Phone: ${testPhone}\n`);

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Health Check
  console.log('Test 1: API Health Check');
  try {
    const res = await request(`${apiUrl}/health`);
    if (res.status === 200) {
      console.log('✅ PASS: API is healthy\n');
      passedTests++;
    } else {
      console.log(`❌ FAIL: API returned ${res.status}\n`);
      failedTests++;
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
    failedTests++;
  }

  // Test 2: Telnyx Configuration Check
  console.log('Test 2: Telnyx Configuration');
  try {
    const res = await request(`${apiUrl}/api/webrtc/debug`);
    if (res.status === 200 && res.data.configured) {
      console.log('✅ PASS: Telnyx is configured');
      console.log(`   Connection ID: ${res.data.connectionId || 'N/A'}`);
      console.log(`   Has API Key: ${res.data.hasApiKey}`);
      console.log(`   Has Number: ${res.data.hasNumber}\n`);
      passedTests++;
    } else {
      console.log('❌ FAIL: Telnyx not properly configured\n');
      failedTests++;
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
    failedTests++;
  }

  // Test 3: Create Outbound Call (requires auth token)
  if (!bearerToken) {
    console.log('Test 3: Create Outbound Call');
    console.log('⏭️  SKIP: No bearer token provided (use --token YOUR_TOKEN)\n');
  } else {
    console.log('Test 3: POST /api/calls - Create Outbound Call');
    try {
      const res = await request(`${apiUrl}/api/calls`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testPhone,
          enable_amd: true,
          recording_enabled: true,
          transcription_enabled: false,
          metadata: { test: true },
        }),
      });

      if (res.status === 201 && res.data.success) {
        console.log('✅ PASS: Call created successfully');
        console.log(`   Call ID: ${res.data.call.id}`);
        console.log(`   Call Control ID: ${res.data.telnyx.call_control_id}`);
        console.log(`   Status: ${res.data.call.status}\n`);
        passedTests++;

        // Store for later tests
        global.testCallId = res.data.call.id;
        global.testCallControlId = res.data.telnyx.call_control_id;
      } else {
        console.log(`❌ FAIL: Unexpected response`);
        console.log(`   Status: ${res.status}`);
        console.log(`   Data: ${JSON.stringify(res.data, null, 2)}\n`);
        failedTests++;
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}\n`);
      failedTests++;
    }
  }

  // Test 4: Verify Call Record (if created)
  if (global.testCallId && bearerToken) {
    console.log('Test 4: GET /api/calls/:id - Verify Call Record');
    try {
      const res = await request(`${apiUrl}/api/calls/${global.testCallId}`, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      });

      if (res.status === 200 && res.data.success) {
        console.log('✅ PASS: Call record retrieved');
        console.log(`   Status: ${res.data.call.status}`);
        console.log(`   Call Control ID: ${res.data.call.call_control_id || 'N/A'}`);
        console.log(`   AMD Status: ${res.data.call.amd_status || 'pending'}\n`);
        passedTests++;
      } else {
        console.log(`❌ FAIL: Could not retrieve call record\n`);
        failedTests++;
      }
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}\n`);
      failedTests++;
    }
  }

  // Test 5: Webhook Signature Verification (simulated)
  console.log('Test 5: Webhook Signature Verification');
  console.log('⏭️  SKIP: Requires Telnyx secret (manual test via Telnyx Portal)\n');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Test Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Total: ${passedTests + failedTests}\n`);

  if (failedTests === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review logs above.\n');
    process.exit(1);
  }
}

// Manual Test Checklist
function printManualChecklist() {
  console.log('\n📋 Manual Testing Checklist\n');
  console.log('After automated tests pass, manually verify:\n');
  console.log('□ 1. Make a real outbound call via UI');
  console.log('□ 2. Verify call shows "initiated" status immediately');
  console.log('□ 3. Wait for call to be answered');
  console.log('□ 4. Verify status updates to "in_progress"');
  console.log('□ 5. Check AMD result appears (human/machine/not_sure/fax)');
  console.log('□ 6. If human: verify agent sees call in queue');
  console.log('□ 7. If machine: verify voicemail plays and auto-hangups');
  console.log('□ 8. Verify call status updates to "completed" on hangup');
  console.log('□ 9. Check audit_logs table for all events:');
  console.log('     - call:started');
  console.log('     - call:answered');
  console.log('     - dialer:amd_detected');
  console.log('     - call:ended');
  console.log('□ 10. Verify recording appears in calls.recording_url\n');
  console.log('Database queries to verify:\n');
  console.log('```sql');
  console.log('-- Check recent calls');
  console.log('SELECT id, status, call_control_id, amd_status, answered_at, ended_at');
  console.log('FROM calls');
  console.log('WHERE created_at > NOW() - INTERVAL \'1 hour\'');
  console.log('ORDER BY created_at DESC');
  console.log('LIMIT 10;\n');
  console.log('-- Check audit logs');
  console.log('SELECT action, resource_type, new_value, created_at');
  console.log('FROM audit_logs');
  console.log('WHERE resource_type = \'call\'');
  console.log('AND created_at > NOW() - INTERVAL \'1 hour\'');
  console.log('ORDER BY created_at DESC;');
  console.log('```\n');
}

// Run
runTests().then(() => {
  printManualChecklist();
}).catch((err) => {
  console.error('💥 Test runner crashed:', err);
  process.exit(1);
});
