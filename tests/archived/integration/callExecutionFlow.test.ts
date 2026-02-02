import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * @legacy: API routes have been migrated to Workers (Hono)
 * @/app/api/voice/call/route and @/app/api/voice/swml/outbound-v2/route no longer exist
 * TODO: Create Workers integration tests instead
 */
const describeOrSkip = describe.skip

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

// Mock the startCallHandler to simplify integration testing
vi.mock('@/app/actions/calls/startCallHandler', () => ({
  default: vi.fn(() => Promise.resolve({
    success: true,
    call_id: 'test-call-123',
    call_sid: 'CA123'
  }))
}))

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

describeOrSkip('Call Execution Integration Flow', () => {
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
  })

  it('should execute call end-to-end', async () => {
    // The startCallHandler is mocked at the module level to return success
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

  it('should generate SWML with modulations', async () => {
    // Use the same orgId from beforeEach
    const testOrgId = '5f64d900-e212-42ab-bf41-7518f0bbcd4f'
    
    // Mock call lookup
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                organization_id: testOrgId
              },
              error: null
            }))
          }))
        }))
      }))
    })

    // Mock voice_configs with modulations
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                record: true,
                transcribe: true,
                translate: true,
                translate_from: 'en',
                translate_to: 'es',
                survey: true,
                synthetic_caller: true,
                shopper_script: 'Hello, I am calling to test your service.'
              },
              error: null
            }))
          }))
        }))
      }))
    })

    const req = new Request('http://localhost/api/voice/swml/outbound-v2?callSid=CA123', {
      method: 'POST',
      body: JSON.stringify({ CallSid: 'CA123', To: '+1234567890' })
    })

    const { POST } = await import('@/app/api/voice/swml/outbound-v2/route')
    const response = await POST(req)
    
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.version).toBe('1.0.0')
    expect(json.sections).toBeDefined()
    expect(json.sections.main).toBeInstanceOf(Array)
  })
})
