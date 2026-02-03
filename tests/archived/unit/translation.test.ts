import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock uuid to generate valid UUIDs
vi.mock('uuid', () => ({
  v4: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
}))

// Mock pgClient - this is what translation.ts actually uses
const mockQuery = vi.fn()
vi.mock('@/lib/pgClient', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ plan: 'global' }] })
}))

// Mock storage
vi.mock('@/lib/storage', () => ({
  default: {
    uploadFile: vi.fn().mockResolvedValue('https://storage.example.com/audio.mp3')
  }
}))

// Mock elevenlabs
vi.mock('@/app/services/elevenlabs', () => ({
  generateSpeech: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
  cloneVoice: vi.fn().mockResolvedValue('cloned-voice-id'),
  deleteClonedVoice: vi.fn().mockResolvedValue(undefined)
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Properly mock fetch using vi.stubGlobal
const mockFetch = vi.fn()

describe('Translation Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    process.env.OPENAI_API_KEY = 'test-key'
    
    // Reset query mock
    const { query } = await import('@/lib/pgClient')
    vi.mocked(query).mockResolvedValue({ rows: [{ plan: 'global' }] } as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should translate text when OpenAI is available', async () => {
    const { query } = await import('@/lib/pgClient')
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: 'global' }] } as any) // org lookup
      .mockResolvedValueOnce({ rows: [] } as any) // ai_runs update

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Hola, esta es una prueba.'
          }
        }]
      })
    })

    const { translateText } = await import('@/app/services/translation')

    await translateText({
      callId: 'call-123',
      translationRunId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      text: 'Hello, this is a test.',
      fromLanguage: 'en',
      toLanguage: 'es',
      organizationId: 'org-123'
    })

    expect(mockFetch).toHaveBeenCalledWith(
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
    const { query } = await import('@/lib/pgClient')
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: 'global' }] } as any)
      .mockResolvedValue({ rows: [] } as any)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    })

    const { translateText } = await import('@/app/services/translation')

    await expect(
      translateText({
        callId: 'call-123',
        translationRunId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        text: 'Hello',
        fromLanguage: 'en',
        toLanguage: 'es',
        organizationId: 'org-123'
      })
    ).resolves.not.toThrow()
  })

  it('should skip translation for non-global plans', async () => {
    const { query } = await import('@/lib/pgClient')
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ plan: 'base' }] } as any) // org lookup - non-allowed plan
      .mockResolvedValue({ rows: [] } as any) // ai_runs update

    const { translateText } = await import('@/app/services/translation')

    await translateText({
      callId: 'call-123',
      translationRunId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      text: 'Hello',
      fromLanguage: 'en',
      toLanguage: 'es',
      organizationId: 'org-123'
    })

    // Should NOT have called OpenAI since plan doesn't support translation
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
