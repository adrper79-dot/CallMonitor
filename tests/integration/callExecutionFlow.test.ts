import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

/**
 * Integration Test: Call Execution Flow
 * 
 * Tests the end-to-end call execution:
 * 1. User initiates call via API
 * 2. Call created in database
 * 3. SignalWire call initiated
 * 4. LaML script generated
 * 5. Call status tracked
 */

// Mock external services
global.fetch = vi.fn()

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
      data: [{ id: 'test-id' }],
      error: null
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [{ id: 'test-id' }],
        error: null
      }))
    }))
  }))
}

vi.mock('@/lib/supabaseAdmin', () => ({
  default: mockSupabase
}))

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: { id: 'user-123' }
  }))
}))

describe('Call Execution Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock SignalWire API
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        sid: 'CA123',
        status: 'queued'
      })
    })

    // Mock organization lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'org-123',
              plan: 'pro',
              tool_id: 'tool-123'
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock system lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'system-123'
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock voice_configs lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              record: true,
              transcribe: true
            }],
            error: null
          }))
        }))
      }))
    })
  })

  it('should execute call end-to-end', async () => {
    const req = new Request('http://localhost/api/voice/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: 'org-123',
        phone_to: '+1234567890',
        modulations: {
          record: true,
          transcribe: true
        }
      })
    })

    const { POST } = await import('@/app/api/voice/call/route')
    const response = await POST(req)
    
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.call_id).toBeDefined()
  })

  it('should generate LaML with modulations', async () => {
    // Mock call lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              organization_id: 'org-123'
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock voice_configs with modulations
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              record: true,
              transcribe: true,
              translate: true,
              translate_from: 'en',
              translate_to: 'es',
              survey: true,
              synthetic_caller: true,
              shopper_script: 'Hello, I am calling to test your service.'
            }],
            error: null
          }))
        }))
      }))
    })

    const req = new Request('http://localhost/api/voice/laml/outbound?callSid=CA123', {
      method: 'GET'
    })

    const { GET } = await import('@/app/api/voice/laml/outbound/route')
    const response = await GET(req)
    
    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('<?xml')
    expect(xml).toContain('<Record')
    expect(xml).toContain('<Say')
  })
})
