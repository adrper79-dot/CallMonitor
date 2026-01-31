import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateText } from '@/app/services/translation'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

// Mock Supabase - define inside factory to avoid hoisting issues
vi.mock('@/lib/supabaseAdmin', () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              plan: 'global'
            }],
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }
  return { default: mockSupabase }
})

// Mock OpenAI
global.fetch = vi.fn()

describe('Translation Service', () => {
  let mockSupabase: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mock instance
    mockSupabase = (await import('@/lib/supabaseAdmin')).default
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('should translate text when OpenAI is available', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Hola, esta es una prueba.'
          }
        }]
      })
    })

    await translateText({
      callId: 'call-123',
      translationRunId: 'trans-123',
      text: 'Hello, this is a test.',
      fromLanguage: 'en',
      toLanguage: 'es',
      organizationId: 'org-123'
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.openai.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('test-key')
        })
      })
    )
  })

  it('should handle translation failure gracefully', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    })

    await expect(
      translateText({
        callId: 'call-123',
        translationRunId: 'trans-123',
        text: 'Hello',
        fromLanguage: 'en',
        toLanguage: 'es',
        organizationId: 'org-123'
      })
    ).resolves.not.toThrow()
  })

  it('should skip translation for non-global plans', async () => {
    // Mock organization lookup to return 'base' plan which doesn't support translation
    // (The allowed plans are: global, enterprise, business, pro, standard, active)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              plan: 'base' // Not in translation-allowed plans
            }],
            error: null
          }))
        }))
      }))
    })

    // Mock the ai_runs update that happens when plan doesn't support translation
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    })

    await translateText({
      callId: 'call-123',
      translationRunId: 'trans-123',
      text: 'Hello',
      fromLanguage: 'en',
      toLanguage: 'es',
      organizationId: 'org-123'
    })

    // Should not call OpenAI since base plan doesn't support translation
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
