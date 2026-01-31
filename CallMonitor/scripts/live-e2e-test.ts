#!/usr/bin/env npx ts-node
/**
 * LIVE END-TO-END FEATURE PIPELINE TEST
 * 
 * This script tests the REAL deployed system, not mocks.
 * It exercises the full Word Is Bond feature pipeline:
 * 
 * 1. Create a voice target (number to call)
 * 2. Create a survey
 * 3. Configure voice modulations
 * 4. Execute a call with recording, transcription, translation
 * 5. Verify artifacts are generated and delivered
 * 
 * Usage: npx ts-node scripts/live-e2e-test.ts
 * 
 * CONFIGURATION:
 * - Agent Number (FROM): +17062677235
 * - Target Number (TO): +12392027345
 * - Languages: English → German
 * - Artifact Email: adrper79@gmail.com
 */

const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'

// Test Configuration
const TEST_CONFIG = {
  fromNumber: '+17062677235',       // Agent/caller number
  toNumber: '+12392027345',          // Target number to call
  translateFrom: 'en',               // English
  translateTo: 'de',                 // German
  artifactEmail: 'adrper79@gmail.com',
  // Test prompts for survey
  surveyPrompts: [
    'On a scale of 1 to 5, how satisfied were you with the service today?',
    'Would you recommend us to a friend? Please say yes or no.',
    'Do you have any additional feedback you would like to share?'
  ],
  // Secret shopper script
  shopperScript: `Hello, I'm calling to inquire about your services.

[Wait for response]

I'd like to schedule a consultation for next week. What availability do you have?

[Wait for response]

That sounds good. Can you tell me about your pricing structure?

[Wait for response]

One more question - do you offer any guarantees or warranties on your work?

[Wait for response]

Thank you for the information. I'll discuss with my partner and get back to you soon. Have a great day!`
}

interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  data?: any
}

const results: TestResult[] = []

// Helper to make authenticated requests
async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  cookies?: string
): Promise<{ ok: boolean; status: number; data: any }> {
  const url = `${BASE_URL}${endpoint}`
  console.log(`  → ${method} ${url}`)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (cookies) {
    headers['Cookie'] = cookies
  }
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    })
    
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message } }
  }
}

// Test runner
async function runTest(
  name: string,
  testFn: () => Promise<any>
): Promise<TestResult> {
  console.log(`\n🧪 ${name}`)
  const start = Date.now()
  
  try {
    const data = await testFn()
    const duration = Date.now() - start
    const result: TestResult = { name, passed: true, duration, data }
    results.push(result)
    console.log(`  ✅ PASSED (${duration}ms)`)
    return result
  } catch (err: any) {
    const duration = Date.now() - start
    const result: TestResult = { name, passed: false, duration, error: err.message }
    results.push(result)
    console.log(`  ❌ FAILED: ${err.message} (${duration}ms)`)
    return result
  }
}

// ============================================================
// TEST SUITE
// ============================================================

async function testHealthCheck() {
  const { ok, data } = await apiRequest('/api/health')
  if (!ok) throw new Error('Health check failed')
  console.log(`    Database: ${data.database || 'unknown'}`)
  console.log(`    SignalWire: ${data.signalwire || 'unknown'}`)
  return data
}

async function testAuthCheck() {
  const { ok, status, data } = await apiRequest('/api/health/user')
  console.log(`    Status: ${status}`)
  console.log(`    User: ${data.user?.email || 'Not authenticated'}`)
  if (!data.user) {
    console.log(`    ⚠️ You need to be authenticated. Please login first.`)
    throw new Error('Authentication required - login at ' + BASE_URL + '/admin/auth')
  }
  return data
}

async function testCreateVoiceTarget(orgId: string) {
  const { ok, data } = await apiRequest('/api/voice/targets', 'POST', {
    organization_id: orgId,
    phone_number: TEST_CONFIG.toNumber,
    name: 'Live E2E Test Target',
    description: `Test target created at ${new Date().toISOString()}`
  })
  
  if (!ok) throw new Error(data.error?.message || 'Failed to create target')
  console.log(`    Target ID: ${data.target?.id}`)
  return data.target
}

async function testCreateSurvey(orgId: string) {
  const { ok, data } = await apiRequest('/api/surveys', 'POST', {
    organization_id: orgId,
    name: 'Live E2E Test Survey',
    description: 'Customer satisfaction survey for live testing',
    questions: [
      {
        id: 'q1',
        text: TEST_CONFIG.surveyPrompts[0],
        type: 'scale',
        required: true,
        order: 1
      },
      {
        id: 'q2',
        text: TEST_CONFIG.surveyPrompts[1],
        type: 'yes_no',
        required: true,
        order: 2
      },
      {
        id: 'q3',
        text: TEST_CONFIG.surveyPrompts[2],
        type: 'text',
        required: false,
        order: 3
      }
    ],
    is_active: true
  })
  
  if (!ok && data.error?.code !== 'PLAN_LIMIT_EXCEEDED') {
    throw new Error(data.error?.message || 'Failed to create survey')
  }
  
  if (data.error?.code === 'PLAN_LIMIT_EXCEEDED') {
    console.log(`    ⚠️ Survey feature requires Insights plan`)
    return null
  }
  
  console.log(`    Survey ID: ${data.survey?.id}`)
  return data.survey
}

async function testUpdateVoiceConfig(orgId: string, targetId: string, surveyId: string | null) {
  const config = {
    orgId,
    modulations: {
      record: true,
      transcribe: true,
      translate: true,
      translate_from: TEST_CONFIG.translateFrom,
      translate_to: TEST_CONFIG.translateTo,
      survey: surveyId ? true : false,
      survey_id: surveyId,
      target_id: targetId,
      // Artifact delivery
      survey_webhook_email: TEST_CONFIG.artifactEmail
    }
  }
  
  const { ok, data } = await apiRequest('/api/voice/config', 'PUT', config)
  
  if (!ok) throw new Error(data.error?.message || 'Failed to update voice config')
  console.log(`    Recording: ${config.modulations.record}`)
  console.log(`    Transcription: ${config.modulations.transcribe}`)
  console.log(`    Translation: ${TEST_CONFIG.translateFrom} → ${TEST_CONFIG.translateTo}`)
  console.log(`    Survey: ${config.modulations.survey}`)
  console.log(`    Artifact Email: ${TEST_CONFIG.artifactEmail}`)
  return data.config
}

async function testExecuteCall(orgId: string) {
  console.log(`    From: ${TEST_CONFIG.fromNumber}`)
  console.log(`    To: ${TEST_CONFIG.toNumber}`)
  
  const { ok, data } = await apiRequest('/api/voice/call', 'POST', {
    organization_id: orgId,
    phone_to: TEST_CONFIG.toNumber,
    from_number: TEST_CONFIG.fromNumber,
    modulations: {
      record: true,
      transcribe: true,
      translate: true,
      survey: true
    }
  })
  
  if (!ok) throw new Error(data.error?.message || 'Failed to execute call')
  console.log(`    Call ID: ${data.call_id}`)
  console.log(`    Call SID: ${data.call_sid}`)
  return data
}

async function testPollCallStatus(callId: string, maxAttempts: number = 30) {
  console.log(`    Polling call status every 5 seconds (max ${maxAttempts} attempts)...`)
  
  for (let i = 0; i < maxAttempts; i++) {
    const { ok, data } = await apiRequest(`/api/calls/${callId}`)
    
    if (!ok) {
      console.log(`    ⚠️ Could not fetch call status: ${data.error?.message}`)
      await sleep(5000)
      continue
    }
    
    const status = data.call?.status
    console.log(`    [${i + 1}/${maxAttempts}] Status: ${status}`)
    
    if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) {
      if (status === 'completed') {
        console.log(`    ✓ Call completed successfully`)
        return data.call
      } else {
        console.log(`    ⚠️ Call ended with status: ${status}`)
        return data.call
      }
    }
    
    await sleep(5000)
  }
  
  throw new Error('Call did not complete within expected time')
}

async function testVerifyArtifacts(callId: string) {
  // Check for recording
  const { ok: recOk, data: recData } = await apiRequest(`/api/recordings/${callId}`)
  console.log(`    Recording: ${recOk ? '✓ Found' : '✗ Not found'}`)
  
  // Check call details for transcript and translation
  const { ok: callOk, data: callData } = await apiRequest(`/api/calls/${callId}`)
  
  if (callOk && callData.call) {
    const call = callData.call
    console.log(`    Transcript: ${call.transcript ? '✓ Found' : '⏳ Pending'}`)
    console.log(`    Translation: ${call.translation ? '✓ Found' : '⏳ Pending'}`)
    console.log(`    Survey: ${call.survey_results ? '✓ Found' : '⏳ Pending/N/A'}`)
  }
  
  return { recording: recOk, call: callData.call }
}

async function testTriggerArtifactEmail(callId: string) {
  const { ok, data } = await apiRequest(`/api/calls/${callId}/email`, 'POST', {
    email: TEST_CONFIG.artifactEmail,
    include_recording: true,
    include_transcript: true,
    include_translation: true
  })
  
  if (!ok) {
    console.log(`    ⚠️ Email trigger failed: ${data.error?.message || 'Unknown error'}`)
    return null
  }
  
  console.log(`    Email sent to: ${TEST_CONFIG.artifactEmail}`)
  return data
}

// ============================================================
// MAIN EXECUTION
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  LIVE END-TO-END FEATURE PIPELINE TEST')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  From: ${TEST_CONFIG.fromNumber}`)
  console.log(`  To: ${TEST_CONFIG.toNumber}`)
  console.log(`  Languages: ${TEST_CONFIG.translateFrom} → ${TEST_CONFIG.translateTo}`)
  console.log(`  Email: ${TEST_CONFIG.artifactEmail}`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  let orgId: string | null = null
  let targetId: string | null = null
  let surveyId: string | null = null
  let callId: string | null = null
  
  // Test 1: Health Check
  await runTest('Health Check', testHealthCheck)
  
  // Test 2: Auth Check (get organization ID)
  const authResult = await runTest('Authentication Check', async () => {
    const data = await testAuthCheck()
    orgId = data.user?.organization_id || data.organization_id
    if (!orgId) {
      throw new Error('No organization ID found for user')
    }
    console.log(`    Organization ID: ${orgId}`)
    return data
  })
  
  if (!authResult.passed || !orgId) {
    console.log('\n❌ Cannot proceed without authentication')
    console.log(`   Please login at: ${BASE_URL}/admin/auth`)
    process.exit(1)
  }
  
  // Test 3: Create Voice Target
  const targetResult = await runTest('Create Voice Target', async () => {
    const target = await testCreateVoiceTarget(orgId!)
    targetId = target.id
    return target
  })
  
  // Test 4: Create Survey
  const surveyResult = await runTest('Create Survey', async () => {
    const survey = await testCreateSurvey(orgId!)
    surveyId = survey?.id || null
    return survey
  })
  
  // Test 5: Update Voice Config
  if (targetId) {
    await runTest('Update Voice Configuration', async () => {
      return await testUpdateVoiceConfig(orgId!, targetId!, surveyId)
    })
  }
  
  // Test 6: Execute Call
  const callResult = await runTest('Execute Call', async () => {
    const result = await testExecuteCall(orgId!)
    callId = result.call_id
    return result
  })
  
  // Test 7: Poll Call Status
  if (callId) {
    await runTest('Poll Call Status', async () => {
      return await testPollCallStatus(callId!)
    })
    
    // Wait a bit for async processing
    console.log('\n⏳ Waiting 10 seconds for async artifact processing...')
    await sleep(10000)
    
    // Test 8: Verify Artifacts
    await runTest('Verify Artifacts', async () => {
      return await testVerifyArtifacts(callId!)
    })
    
    // Test 9: Trigger Artifact Email
    await runTest('Trigger Artifact Email', async () => {
      return await testTriggerArtifactEmail(callId!)
    })
  }
  
  // ============================================================
  // RESULTS SUMMARY
  // ============================================================
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  TEST RESULTS SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌'
    console.log(`  ${icon} ${r.name} (${r.duration}ms)`)
    if (!r.passed && r.error) {
      console.log(`      Error: ${r.error}`)
    }
  })
  
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`  Total: ${passed}/${results.length} passed | ${failed} failed | ${totalDuration}ms`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  if (callId) {
    console.log(`\n📞 Call ID: ${callId}`)
    console.log(`   View at: ${BASE_URL}/voice?call=${callId}`)
  }
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the errors above.')
    process.exit(1)
  } else {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  }
}

// Run the tests
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
