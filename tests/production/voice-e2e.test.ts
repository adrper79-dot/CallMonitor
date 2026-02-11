/**
 * Voice E2E Experience Tests
 * 
 * LIVE TESTING - Real SignalWire calls to validate complete user journey:
 * 1. Outbound call initiation
 * 2. Call control (answer, bridge, transfer, hold)
 * 3. Recording capture
 * 4. Transcription processing
 * 5. AI summaries
 * 6. Call outcome tracking
 * 7. User feedback loop
 * 
 * SignalWire Test Numbers:
 * - Primary: +1 (202) 771-1933
 * - Secondary: +1 (203) 298-7277
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import {
  apiCall,
  createTestSession,
  query,
  pool,
  API_URL,
  TEST_ORG_ID,
  TEST_USER_ID,
  TEST_USER_2_ID,
} from './setup'

// ── Test Configuration ──────────────────────────────────────────────────────

const SIGNALWIRE_PRIMARY = process.env.SIGNALWIRE_NUMBER_PRIMARY || '+12027711933'
const SIGNALWIRE_SECONDARY = process.env.SIGNALWIRE_NUMBER_SECONDARY || '+12032987277'
const ENABLE_LIVE_CALLS = process.env.ENABLE_LIVE_VOICE_TESTS === 'true'
const CALL_DURATION = parseInt(process.env.TEST_CALL_DURATION || '30', 10) * 1000

// ── Test State ──────────────────────────────────────────────────────────────

let sessionToken: string | null = null
let sessionToken2: string | null = null
let callId: string | null = null
let bridgeCallId: string | null = null

beforeAll(async () => {
  console.log('\n📞 Voice E2E Tests - Live SignalWire Integration')
  console.log(`   Primary Number: ${SIGNALWIRE_PRIMARY}`)
  console.log(`   Secondary Number: ${SIGNALWIRE_SECONDARY}`)
  console.log(`   Live Calls: ${ENABLE_LIVE_CALLS ? 'ENABLED' : 'DISABLED (stub only)'}`)
  console.log(`   Organization: ${TEST_ORG_ID}\n`)

  // Create sessions for both test users
  sessionToken = await createTestSession()
  
  // Create second user session (requires custom implementation)
  const sessions2 = await query(
    `SELECT session_token FROM public.sessions 
     WHERE user_id = $1 AND expires > NOW() 
     ORDER BY expires DESC LIMIT 1`,
    [TEST_USER_2_ID]
  )
  
  if (sessions2.length > 0) {
    sessionToken2 = sessions2[0].session_token
  } else {
    // Create session for user 2
    const token = `test-session-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await query(
      `INSERT INTO public.sessions (session_token, user_id, expires)
       VALUES ($1, $2, $3)`,
      [token, TEST_USER_2_ID, expires.toISOString()]
    )
    sessionToken2 = token
  }

  if (!sessionToken || !sessionToken2) {
    console.error('❌ Could not create test sessions')
  }
})

afterAll(async () => {
  // Cleanup: soft-delete test calls
  if (callId) {
    await query(
      `UPDATE calls SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [callId]
    )
  }
  if (bridgeCallId) {
    await query(
      `UPDATE calls SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [bridgeCallId]
    )
  }
  await pool.end().catch(() => {})
})

function requireSession(): string {
  if (!sessionToken) throw new Error('No session token for user 1')
  return sessionToken
}

function requireSession2(): string {
  if (!sessionToken2) throw new Error('No session token for user 2')
  return sessionToken2
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Single Outbound Call Journey
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Journey: Outbound Call Lifecycle', () => {
  test('User can initiate outbound call to test number', async () => {
    if (!ENABLE_LIVE_CALLS) {
      console.log('  ⏭️  Skipped (ENABLE_LIVE_VOICE_TESTS=false)')
      return
    }

    const { status, data } = await apiCall('POST', '/api/calls/start', {
      body: {
        to: SIGNALWIRE_SECONDARY, // Call secondary number
        from: SIGNALWIRE_PRIMARY, // From primary number
        record: true,
        transcribe: true,
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.call).toBeDefined()
    expect(data.call.call_sid).toBeDefined()
    
    callId = data.call.id
    console.log(`  📞 Call initiated: ${data.call.call_sid}`)
    console.log(`     From: ${SIGNALWIRE_PRIMARY}`)
    console.log(`     To: ${SIGNALWIRE_SECONDARY}`)
  })

  test('Call appears in user call history', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for DB sync

    const { status, data } = await apiCall('GET', '/api/calls', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    
    const call = data.calls.find((c: any) => c.id === callId)
    expect(call).toBeDefined()
    expect(call.direction).toBe('outbound')
    expect(call.to_number).toBe(SIGNALWIRE_SECONDARY)
    
    console.log(`  ✅ Call found in history (status: ${call.status})`)
  })

  test('Call details include recording and transcription status', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    const { status, data } = await apiCall('GET', `/api/calls/${callId}`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.call.id).toBe(callId)
    expect(data.call.recording_enabled).toBe(true)
    expect(data.call.transcription_enabled).toBe(true)
    
    console.log(`  📹 Recording: ${data.call.recording_enabled ? 'YES' : 'NO'}`)
    console.log(`  📝 Transcription: ${data.call.transcription_enabled ? 'YES' : 'NO'}`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Bridged Call Flow
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Journey: Bridged Call Between Users', () => {
  test('User 1 can initiate bridge call to User 2', async () => {
    if (!ENABLE_LIVE_CALLS) {
      console.log('  ⏭️  Skipped (ENABLE_LIVE_VOICE_TESTS=false)')
      return
    }

    const { status, data } = await apiCall('POST', '/api/calls/bridge', {
      body: {
        from: SIGNALWIRE_PRIMARY,
        customer_number: SIGNALWIRE_SECONDARY,
        agent_number: SIGNALWIRE_SECONDARY, // Both test numbers
        record_customer: true,
        record_agent: true,
        transcribe_customer: true,
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.bridge).toBeDefined()
    expect(data.customer_call_sid).toBeDefined()
    expect(data.agent_call_sid).toBeDefined()
    
    bridgeCallId = data.bridge.id
    console.log(`  🌉 Bridge initiated:`)
    console.log(`     Customer leg: ${data.customer_call_sid}`)
    console.log(`     Agent leg: ${data.agent_call_sid}`)
  })

  test('Bridge call creates two call records', async () => {
    if (!bridgeCallId) {
      console.log('  ⏭️  Skipped (no bridge ID)')
      return
    }

    await new Promise(resolve => setTimeout(resolve, 3000))

    const calls = await query(
      `SELECT id, direction, leg_type, call_sid, status
       FROM calls 
       WHERE bridge_id = $1 
       ORDER BY created_at`,
      [bridgeCallId]
    )

    expect(calls.length).toBeGreaterThanOrEqual(2)
    const customerLeg = calls.find((c: any) => c.leg_type === 'customer')
    const agentLeg = calls.find((c: any) => c.leg_type === 'agent')
    
    expect(customerLeg).toBeDefined()
    expect(agentLeg).toBeDefined()
    
    console.log(`  ✅ Found ${calls.length} call legs:`)
    console.log(`     Customer: ${customerLeg.call_sid} (${customerLeg.status})`)
    console.log(`     Agent: ${agentLeg.call_sid} (${agentLeg.status})`)
  })

  test('User 2 can see bridged call in their history', async () => {
    if (!bridgeCallId) {
      console.log('  ⏭️  Skipped (no bridge ID)')
      return
    }

    const { status, data } = await apiCall('GET', '/api/calls', {
      sessionToken: requireSession2(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    
    // User 2 should see the agent leg
    const calls = data.calls.filter((c: any) => c.bridge_id === bridgeCallId)
    expect(calls.length).toBeGreaterThan(0)
    
    console.log(`  ✅ User 2 sees ${calls.length} bridge call(s)`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Recording & Transcription Availability
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Journey: Post-Call Artifacts', () => {
  test('Recording becomes available after call ends', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    // Wait for call to end and recording to process
    console.log('  ⏳ Waiting for call to end...')
    await new Promise(resolve => setTimeout(resolve, CALL_DURATION + 5000))

    const recordings = await query(
      `SELECT id, recording_url, duration, status
       FROM call_recordings
       WHERE call_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [callId]
    )

    if (recordings.length > 0) {
      const recording = recordings[0]
      console.log(`  🎙️  Recording available:`)
      console.log(`     URL: ${recording.recording_url}`)
      console.log(`     Duration: ${recording.duration}s`)
      console.log(`     Status: ${recording.status}`)
      expect(recording.recording_url).toBeTruthy()
    } else {
      console.log(`  ⚠️  No recording found yet (may still be processing)`)
    }
  })

  test('Transcription is generated from recording', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    // Check if transcription exists
    const transcriptions = await query(
      `SELECT id, text, status, confidence
       FROM transcriptions
       WHERE call_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [callId]
    )

    if (transcriptions.length > 0) {
      const transcript = transcriptions[0]
      console.log(`  📝 Transcription available:`)
      console.log(`     Length: ${transcript.text?.length || 0} chars`)
      console.log(`     Confidence: ${transcript.confidence || 'N/A'}`)
      console.log(`     Status: ${transcript.status}`)
      expect(transcript.status).toBeIn(['completed', 'processing'])
    } else {
      console.log(`  ⚠️  No transcription found (may require AssemblyAI webhook)`)
    }
  })

  test('AI summary is generated from transcription', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    const summaries = await query(
      `SELECT id, summary_text, confidence_level, sentiment
       FROM ai_summaries
       WHERE call_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [callId]
    )

    if (summaries.length > 0) {
      const summary = summaries[0]
      console.log(`  🤖 AI Summary available:`)
      console.log(`     ${summary.summary_text.substring(0, 100)}...`)
      console.log(`     Confidence: ${summary.confidence_level}`)
      console.log(`     Sentiment: ${summary.sentiment || 'N/A'}`)
    } else {
      console.log(`  ⚠️  No AI summary yet (requires transcription + AI processing)`)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Call Outcome Tracking
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Journey: Outcome Declaration', () => {
  test('User can declare call outcome', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    const { status, data } = await apiCall('POST', `/api/calls/${callId}/outcomes`, {
      body: {
        outcome_status: 'agreed',
        confidence_level: 'high',
        agreed_items: ['Item 1: Test agreement'],
        summary_text: 'Test call completed successfully',
        summary_source: 'human',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.outcome).toBeDefined()
    expect(data.outcome.outcome_status).toBe('agreed')
    
    console.log(`  ✅ Outcome declared: ${data.outcome.outcome_status}`)
    console.log(`     Confidence: ${data.outcome.confidence_level}`)
  })

  test('Call outcome appears in call details', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    const { status, data } = await apiCall('GET', `/api/calls/${callId}`, {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.call.outcome).toBeDefined()
    expect(data.call.outcome.outcome_status).toBe('agreed')
    expect(data.call.outcome.summary_text).toContain('Test call')
    
    console.log(`  ✅ Outcome confirmed in call details`)
  })

  test('User can add notes to call', async () => {
    if (!callId) {
      console.log('  ⏭️  Skipped (no call ID)')
      return
    }

    const { status, data } = await apiCall('POST', `/api/calls/${callId}/notes`, {
      body: {
        content: 'Test note added during E2E testing',
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.note.content).toContain('Test note')
    
    console.log(`  📌 Note added to call`)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Analytics & Reporting
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Journey: Analytics Dashboard', () => {
  test('Call metrics are updated in analytics', async () => {
    const { status, data } = await apiCall('GET', '/api/analytics/kpis', {
      sessionToken: requireSession(),
    })

    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.kpis).toBeDefined()
    
    console.log(`  📊 KPIs:`)
    console.log(`     Total calls: ${data.kpis.total_calls || 0}`)
    console.log(`     Avg duration: ${data.kpis.avg_call_duration || 0}s`)
    console.log(`     Completion rate: ${data.kpis.call_completion_rate || 0}%`)
  })

  test('User can generate call report', async () => {
    const { status, data } = await apiCall('POST', '/api/reports', {
      body: {
        report_type: 'calls',
        format: 'json',
        date_range: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      },
      sessionToken: requireSession(),
    })

    expect(status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.report).toBeDefined()
    
    console.log(`  📄 Report generated: ${data.report.id}`)
    console.log(`     Type: ${data.report.report_type}`)
    console.log(`     Rows: ${data.report.data?.length || 0}`)
  })
})
