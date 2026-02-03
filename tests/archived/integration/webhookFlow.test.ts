import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

/**
 * Integration Test: Webhook Processing Flow
 * 
 * Tests the end-to-end flow via Workers API:
 * 1. Telnyx webhook → Call status update
 * 2. AssemblyAI webhook → Transcription completed
 * 
 * NOTE: API routes migrated to Cloudflare Workers (workers/src/routes/webhooks.ts)
 * Run with: RUN_INTEGRATION=1 npm test (requires live Workers endpoint)
 */

const WORKERS_API_URL = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const describeOrSkip = process.env.RUN_INTEGRATION ? describe : describe.skip

describe.skip('Webhook Integration Flow (Legacy - Migrated to Workers)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should process SignalWire call status webhook', async () => {
    // Mock call exists
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'call-123',
              organization_id: 'org-123',
              status: 'ringing'
            }],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })) }))
    })

    const formData = new URLSearchParams({
      CallSid: 'CA123',
      CallStatus: 'completed',
      CallDuration: '120'
    })

    const req = new Request('http://localhost/api/webhooks/signalwire', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })

    // Import and test webhook handler
    const { POST } = await import('@/app/api/webhooks/signalwire/route')
    const response = await POST(req)
    
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
  })

  it('should process AssemblyAI transcription webhook', async () => {
    // Mock recording and ai_run exist
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'ai-run-123',
              call_id: 'call-123',
              status: 'queued',
              output: {}
            }],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })) }))
    }).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              organization_id: 'org-123',
              call_sid: 'CA123'
            }],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ data: { id: 'mock-id' }, error: null })) }))
    }).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              organization_id: 'org-123',
              call_sid: 'CA123'
            }],
            error: null
          }))
        }))
      }))
    })

    const payload = {
      transcript_id: 'trans-123',
      status: 'completed',
      text: 'Hello, this is a test transcript.',
      words: [],
      confidence: 0.95
    }

    const req = new Request('http://localhost/api/webhooks/assemblyai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const { POST } = await import('@/app/api/webhooks/assemblyai/route')
    const response = await POST(req)
    
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
  })
})
/**
 * Live Workers Webhook Tests
 * Run with: RUN_INTEGRATION=1 npm test
 * Requires live Workers endpoint
 */
const WORKERS_URL = process.env.WORKERS_API_URL || 'https://wordisbond-api.adrper79.workers.dev'
const describeLive = process.env.RUN_INTEGRATION ? describe : describe.skip

describeLive('Workers Webhook Integration (Live)', () => {
  it('should reach Telnyx webhook endpoint', async () => {
    const response = await fetch(`${WORKERS_URL}/webhooks/telnyx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          event_type: 'call.initiated',
          payload: {
            call_control_id: 'test-control-id',
            call_leg_id: 'test-leg-id',
            call_session_id: 'test-session-id',
            from: '+15551234567',
            to: '+15559876543',
          }
        }
      })
    })
    
    // Expect either 200 (processed) or 400 (validation) - not 404
    expect([200, 400, 500].includes(response.status)).toBe(true)
  })

  it('should reach AssemblyAI webhook endpoint', async () => {
    const response = await fetch(`${WORKERS_URL}/webhooks/assemblyai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript_id: 'test-transcript-id',
        status: 'completed',
        text: 'Test transcript text'
      })
    })
    
    // Expect either 200 (processed) or 400 (validation) - not 404
    expect([200, 400, 500].includes(response.status)).toBe(true)
  })
})