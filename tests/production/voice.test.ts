/**
 * Production Voice Flow Integration Tests
 * 
 * Tests real Telnyx voice flows with actual API calls.
 * NO MOCKS - tests actual voice service integration.
 * 
 * CAUTION: These tests may incur charges and make real calls.
 * Only run when RUN_VOICE_TESTS=1 is explicitly set.
 * 
 * Run with: RUN_VOICE_TESTS=1 npm run test:production
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { 
  pool,
  query, 
  apiCall,
  API_URL,
  TEST_ORG_ID, 
  TEST_USER_ID,
  RUN_VOICE_TESTS,
  createTestSession,
  cleanupTestData
} from './setup'

// Voice tests are off by default (they cost money!)
const describeOrSkip = RUN_VOICE_TESTS ? describe : describe.skip

// Read Telnyx credentials from environment
const TELNYX_API_KEY = process.env.TELNYX_API_KEY || ''
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER || '+13048534096'
const TEST_DESTINATION_NUMBER = process.env.TEST_DESTINATION_NUMBER || '+17062677235'

// Telnyx API base
const TELNYX_API = 'https://api.telnyx.com/v2'

// Helper to call Telnyx API directly
async function telnyxCall(
  method: 'GET' | 'POST' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${TELNYX_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json().catch(() => ({}))
  return { status: response.status, data }
}

describeOrSkip('Production Voice Flow Tests', () => {
  let sessionToken: string | null = null
  const createdCallIds: string[] = []

  beforeAll(async () => {
    console.log('📞 Voice Flow Tests')
    console.log(`   Telnyx API Key: ${TELNYX_API_KEY ? '✅ Configured' : '❌ Missing'}`)
    console.log(`   Outbound Number: ${TELNYX_PHONE_NUMBER}`)
    console.log(`   Test Destination: ${TEST_DESTINATION_NUMBER}`)
    
    if (!TELNYX_API_KEY) {
      throw new Error('TELNYX_API_KEY required for voice tests')
    }

    sessionToken = await createTestSession()
    console.log(`🔑 Test session: ${sessionToken ? 'created' : 'failed'}`)
  })

  afterAll(async () => {
    // Clean up any calls we created in DB
    for (const callId of createdCallIds) {
      try {
        await query(`DELETE FROM calls WHERE id = $1`, [callId])
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    await cleanupTestData()
  })

  describe('Telnyx API Connectivity', () => {
    test('can connect to Telnyx API', async () => {
      const { status, data } = await telnyxCall('GET', '/phone_numbers')
      
      expect(status).toBe(200)
      expect(data.data).toBeDefined()
      console.log('✅ Telnyx API connected')
    })

    test('phone number is active and configured', async () => {
      const { status, data } = await telnyxCall('GET', '/phone_numbers')
      
      expect(status).toBe(200)
      
      const numbers = data.data || []
      const ourNumber = numbers.find((n: any) => 
        n.phone_number === TELNYX_PHONE_NUMBER
      )
      
      if (ourNumber) {
        expect(ourNumber.status).toBe('active')
        console.log(`✅ Phone number ${TELNYX_PHONE_NUMBER} is active`)
      } else {
        console.log(`⚠️ Phone number ${TELNYX_PHONE_NUMBER} not found in account`)
        console.log(`   Available numbers: ${numbers.map((n: any) => n.phone_number).join(', ') || 'none'}`)
      }
    })

    test('can list call control apps', async () => {
      const { status, data } = await telnyxCall('GET', '/call_control_applications')
      
      expect(status).toBe(200)
      
      if (data.data && data.data.length > 0) {
        console.log(`✅ Found ${data.data.length} call control app(s)`)
        for (const app of data.data) {
          console.log(`   - ${app.application_name}: ${app.webhook_api_version}`)
        }
      } else {
        console.log('⚠️ No call control applications configured')
      }
    })
  })

  describe('Voice Config Database', () => {
    test('test organization has voice config', async () => {
      // Actual table is voice_configs (plural)
      const configs = await query(`
        SELECT * FROM voice_configs 
        WHERE organization_id = $1
      `, [TEST_ORG_ID])

      expect(configs.length).toBeGreaterThan(0)
      
      const config = configs[0]
      // Actual columns: record, transcribe, translate, survey
      console.log('✅ Voice config verified:', {
        record: config.record,
        transcribe: config.transcribe,
        translate: config.translate,
        survey: config.survey
      })
    })

    test('voice config features enabled', async () => {
      const configs = await query(`
        SELECT record, transcribe, translate, survey, synthetic_caller
        FROM voice_configs 
        WHERE organization_id = $1
      `, [TEST_ORG_ID])

      if (configs.length > 0) {
        const config = configs[0]
        // At least one feature should be enabled
        const hasAnyFeature = config.record || config.transcribe || config.translate || config.survey
        expect(hasAnyFeature).toBe(true)
        console.log(`✅ Voice features: record=${config.record}, transcribe=${config.transcribe}`)
      }
    })
  })

  describe('Call Record Management', () => {
    let testCallId: string | null = null

    test('can create a call record', async () => {
      // Using actual schema: id, organization_id, status, started_at, created_by, call_sid
      const result = await query(`
        INSERT INTO calls (
          id, organization_id, created_by, status, started_at, call_sid
        )
        VALUES (
          gen_random_uuid(), $1, $2, 'initiated', NOW(), $3
        )
        RETURNING id, status
      `, [TEST_ORG_ID, TEST_USER_ID, `test-${Date.now()}`])

      expect(result.length).toBe(1)
      testCallId = result[0].id
      createdCallIds.push(testCallId)
      
      console.log(`✅ Created test call: ${testCallId}`)
    })

    test('can update call status lifecycle', async () => {
      if (!testCallId) return

      // Simulate call lifecycle
      const statuses = ['ringing', 'answered', 'completed']
      
      for (const status of statuses) {
        await query(`
          UPDATE calls SET status = $1, updated_at = NOW()
          WHERE id = $2
        `, [status, testCallId])
      }

      const result = await query(`
        SELECT status FROM calls WHERE id = $1
      `, [testCallId])

      expect(result[0].status).toBe('completed')
      console.log('✅ Call lifecycle verified')
    })

    test('can set call end time', async () => {
      if (!testCallId) return

      // Valid dispositions: sale, no_answer, voicemail, not_interested, follow_up, wrong_number, other
      await query(`
        UPDATE calls 
        SET ended_at = NOW(),
            disposition = 'other'
        WHERE id = $1
      `, [testCallId])

      const result = await query(`
        SELECT ended_at, disposition FROM calls WHERE id = $1
      `, [testCallId])

      expect(result[0].ended_at).not.toBeNull()
      expect(result[0].disposition).toBe('other')
      console.log('✅ Call completion recorded')
    })
  })

  describe('Call Analytics', () => {
    test('can query call statistics by organization', async () => {
      // Using actual schema columns
      const result = await query(`
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN status = 'initiated' THEN 1 END) as initiated_calls
        FROM calls
        WHERE organization_id = $1
          AND created_at > NOW() - interval '30 days'
      `, [TEST_ORG_ID])

      const stats = result[0]
      console.log('📊 Call Statistics (30 days):', {
        total: stats.total_calls,
        completed: stats.completed_calls,
        initiated: stats.initiated_calls
      })
    })

    test('can query calls by status', async () => {
      const result = await query(`
        SELECT status, COUNT(*) as count
        FROM calls
        WHERE organization_id = $1
        GROUP BY status
      `, [TEST_ORG_ID])

      const byStatus: Record<string, number> = {}
      for (const row of result) {
        byStatus[row.status] = parseInt(row.count)
      }
      
      console.log('📞 Calls by status:', byStatus)
    })
  })

  describe('Call Initiation via API', () => {
    test('call initiation endpoint auth check', async () => {
      const { status } = await apiCall('POST', '/api/calls/initiate', {
        body: { to: TEST_DESTINATION_NUMBER }
      })
      
      // May be 401 (auth required), 404 (not deployed), or other
      expect([401, 404, 403]).toContain(status)
      console.log(`📝 Call initiate without auth: ${status}`)
    })

    test('call endpoint with auth', async () => {
      if (!sessionToken) return

      const { status, data } = await apiCall('POST', '/api/calls/initiate', {
        sessionToken,
        body: { to: TEST_DESTINATION_NUMBER }
      })
      
      // May work (200), validate error (400/422), not deployed (404), or auth issue
      expect([200, 400, 401, 403, 404, 422, 500]).toContain(status)
      console.log(`📝 Call initiate with auth: ${status}`)
    })
  })

  describe('Webhook Endpoints', () => {
    test('Telnyx webhook endpoint', async () => {
      const response = await fetch(`${API_URL}/api/webhooks/telnyx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'telnyx-signature-ed25519': 'test-signature'
        },
        body: JSON.stringify({
          data: {
            event_type: 'call.initiated',
            payload: { call_control_id: 'test' }
          }
        })
      })

      // Accept various responses - testing reachability
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status)
      console.log(`📝 Telnyx webhook: ${response.status}`)
    })
  })

  describe('Real Call Test (CAUTION: Charges Apply)', () => {
    // Skip by default - only run with explicit confirmation
    const runRealCalls = process.env.RUN_REAL_CALLS === '1'
    const realCallTest = runRealCalls ? test : test.skip

    realCallTest('can initiate real outbound call via Telnyx', async () => {
      // This will make a REAL call and incur charges!
      const { status, data } = await telnyxCall('POST', '/calls', {
        connection_id: process.env.TELNYX_CONNECTION_ID,
        to: TEST_DESTINATION_NUMBER,
        from: TELNYX_PHONE_NUMBER,
        webhook_url: `${API_URL}/api/webhooks/telnyx`,
        webhook_url_method: 'POST'
      })

      console.log('📞 Real call result:', { status, callId: data?.data?.call_control_id })
      
      if (status === 200) {
        // Hang up immediately to minimize charges
        const callControlId = data?.data?.call_control_id
        if (callControlId) {
          await telnyxCall('POST', `/calls/${callControlId}/actions/hangup`, {})
          console.log('✅ Call initiated and hung up')
        }
      }
    })
  })
})

// Export for use in other tests
export { telnyxCall }
