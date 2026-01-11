import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateText } from '@/app/services/translation'

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

vi.mock('@/lib/supabaseAdmin', () => ({
  default: mockSupabase
}))

// Mock OpenAI
global.fetch = vi.fn()

describe('Translation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [{
              plan: 'pro' // Not global
            }],
            error: null
          }))
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

    // Should not call OpenAI
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
