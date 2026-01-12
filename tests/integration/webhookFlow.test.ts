import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

/**
 * Integration Test: Webhook Processing Flow
 * 
 * Tests the end-to-end flow:
 * 1. SignalWire webhook → Call status update
 * 2. SignalWire webhook → Recording created
 * 3. AssemblyAI webhook → Transcription completed
 * 4. Evidence manifest generated
 */

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })),
    insert: vi.fn(() => ({
      data: { id: 'test-id' },
      error: null
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: { id: 'test-id' },
        error: null
      }))
    }))
  }))
}

vi.mock('@/lib/supabaseAdmin', () => ({
  default: mockSupabase
}))

describe('Webhook Integration Flow', () => {
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
