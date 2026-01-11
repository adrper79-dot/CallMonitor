import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreRecording } from '@/app/services/scoring'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

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
      data: null,
      error: null
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null
      }))
    }))
  }))
}

vi.mock('@/lib/supabaseAdmin', () => ({
  default: mockSupabase
}))

describe('Scoring Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should score recording based on scorecard', async () => {
    // Mock scorecard
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{
                id: 'scorecard-123',
                structure: {
                  criteria: [
                    {
                      id: 'crit-1',
                      name: 'duration',
                      weight: 1,
                      type: 'numeric',
                      min: 30,
                      max: 300
                    },
                    {
                      id: 'crit-2',
                      name: 'greeting',
                      weight: 1,
                      type: 'boolean'
                    }
                  ]
                }
              }],
              error: null
            }))
          }))
        }))
      }))
    })

    // Mock recording
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              transcript_json: {
                text: 'Hello, thank you for calling.'
              },
              duration_seconds: 120
            }],
            error: null
          }))
        }))
      }))
    })

    const result = await scoreRecording(
      'recording-123',
      'scorecard-123',
      'org-123'
    )

    expect(result).not.toBeNull()
    expect(result?.total_score).toBeGreaterThanOrEqual(0)
    expect(result?.total_score).toBeLessThanOrEqual(100)
  })

  it('should return null for missing scorecard', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    })

    const result = await scoreRecording(
      'recording-123',
      'missing-scorecard',
      'org-123'
    )

    expect(result).toBeNull()
  })
})
