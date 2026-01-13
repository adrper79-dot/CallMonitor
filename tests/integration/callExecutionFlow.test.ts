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

// Mock Supabase - define inside factory to avoid hoisting issues
vi.mock('@/lib/supabaseAdmin', () => {
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
  return { default: mockSupabase }
})

// Get mock instance
let mockSupabase: any

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: { id: 'user-123' }
  }))
}))

describe('Call Execution Integration Flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Get mock instance
    mockSupabase = (await import('@/lib/supabaseAdmin')).default
    
    // Mock SignalWire API
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        sid: 'CA123',
        status: 'queued'
      })
    })

    // Use allowed organization ID
    const orgId = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'
    
    // Mock organization lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: orgId,
              plan: 'pro',
              tool_id: 'tool-123'
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock org_members lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{ id: 'm1', role: 'admin' }],
              error: null
            }))
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

    // Mock systems lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          data: [
            { id: 'sys-cpid', key: 'system-cpid' },
            { id: 'sys-ai', key: 'system-ai' }
          ],
          error: null
        }))
      }))
    })

    // Mock calls insert
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn(() => ({
        data: [{ id: 'call-123' }],
        error: null
      }))
    })

    // Mock calls update
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    })

    // Mock calls select (for final fetch)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{ id: 'call-123', organization_id: orgId, status: 'in-progress' }],
            error: null
          }))
        }))
      }))
    })

    // Mock audit_logs insert (may be called multiple times)
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn(() => ({
        data: null,
        error: null
      }))
    })
    
    // Mock ai_runs insert (if transcription enabled)
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn(() => ({
        data: null,
        error: null
      }))
    })
  })

  it('should execute call end-to-end', async () => {
    // Mock getServerSession
    const { getServerSession } = await import('next-auth/next')
    ;(getServerSession as any).mockResolvedValue({
      user: { id: 'user-123' }
    })

    // Use valid UUID format for organization_id
    const validOrgId = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'

    const req = new Request('http://localhost/api/voice/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: validOrgId,
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
    // Use the same orgId from beforeEach
    const testOrgId = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'
    
    // Mock call lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              organization_id: testOrgId
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
      method: 'POST',
      body: JSON.stringify({ CallSid: 'CA123', To: '+1234567890' })
    })

    const { POST } = await import('@/app/api/voice/laml/outbound/route')
    const response = await POST(req)
    
    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('<?xml')
    expect(xml).toContain('<Response')
  })
})
