import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkAndGenerateManifest } from '@/app/services/evidenceManifest'

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
        data: { id: 'manifest-123' },
        error: null
      }))
    }))
  }
  return { default: mockSupabase }
})

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

describe('Evidence Manifest', () => {
  let mockSupabase: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mock instance
    mockSupabase = (await import('@/lib/supabaseAdmin')).default
  })

  it('should generate manifest when all artifacts are complete', async () => {
    // Mock recording lookup (first call in checkAndGenerateManifest)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              status: 'completed',
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

    // Mock voice_configs lookup (checkAndGenerateManifest checks if transcription is enabled)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              transcribe: true
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock existing manifest check (in generateEvidenceManifest)
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

    // Mock recordings lookup for artifact gathering (in generateEvidenceManifest)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              id: 'recording-123',
              recording_url: 'https://example.com/recording.mp3',
              duration_seconds: 120,
              status: 'completed',
              created_at: new Date().toISOString()
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock recordings lookup for transcript (in generateEvidenceManifest)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              transcript_json: {
                text: 'Test transcript',
                confidence: 0.95,
                transcript_id: 'trans-123',
                completed_at: new Date().toISOString()
              }
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock AI runs lookup for translation (in generateEvidenceManifest)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      }))
    })

    // Mock AI runs lookup for survey (in generateEvidenceManifest)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          contains: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      }))
    })

    // Mock evidence_manifests insert
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn(() => ({
        data: null,
        error: null
      }))
    })

    await checkAndGenerateManifest('call-123', 'recording-123', 'org-123')

    // Should insert manifest - check that insert was called on evidence_manifests
    const insertCalls = mockSupabase.from.mock.calls.filter(
      (call: any[]) => call[0] === 'evidence_manifests'
    )
    expect(insertCalls.length).toBeGreaterThan(0)
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
