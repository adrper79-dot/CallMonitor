import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAndGenerateManifest } from '@/app/services/evidenceManifest'

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
      data: { id: 'manifest-123' },
      error: null
    }))
  }))
}

vi.mock('@/lib/supabaseAdmin', () => ({
  default: mockSupabase
}))

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Evidence Manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate manifest when all artifacts are complete', async () => {
    // Mock recording with transcript
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              transcript_json: {
                text: 'Test transcript',
                words: []
              }
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock AI runs (transcription complete)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{
                id: 'ai-run-123',
                model: 'assemblyai-v1',
                status: 'completed',
                output: {
                  transcript: {
                    text: 'Test transcript'
                  }
                }
              }],
              error: null
            }))
          }))
        }))
      }))
    })

    // Mock existing manifest check
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    })

    await checkAndGenerateManifest('call-123', 'recording-123', 'org-123')

    // Should insert manifest
    expect(mockSupabase.from).toHaveBeenCalledWith('evidence_manifests')
  })

  it('should not generate manifest if artifacts incomplete', async () => {
    // Mock recording without transcript
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              transcript_json: null
            }],
            error: null
          }))
        }))
      }))
    })

    await checkAndGenerateManifest('call-123', 'recording-123', 'org-123')

    // Should not insert manifest
    const insertCalls = mockSupabase.from.mock.calls.filter(
      (call: any[]) => call[0] === 'evidence_manifests'
    )
    expect(insertCalls.length).toBe(0)
  })
})
