import { describe, test, expect, vi, beforeEach } from 'vitest'
import { translateAndStore, type TranslationSegment } from '../../workers/src/lib/translation-processor'
import { synthesizeSpeech } from '../../workers/src/lib/tts-processor'
import { queueAudioInjection } from '../../workers/src/lib/audio-injector'

const loggerSpy = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

vi.mock('../../workers/src/lib/logger', () => ({
  logger: loggerSpy,
}))

vi.mock('../../workers/src/lib/tts-processor', () => ({
  synthesizeSpeech: vi.fn(),
}))

vi.mock('../../workers/src/lib/audio-injector', () => ({
  queueAudioInjection: vi.fn(),
}))

type MockFetchResponse = {
  ok: boolean
  status: number
  json: () => Promise<any>
  text: () => Promise<string>
}

describe('Translation Processor - OSI layers', () => {
  let mockDb: { query: ReturnType<typeof vi.fn> }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as any
  })

  const createSegment = (overrides: Partial<TranslationSegment> = {}): TranslationSegment => ({
    callId: 'call-123',
    organizationId: 'org-789',
    originalText: 'hello world',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    segmentIndex: 1,
    confidence: 0.97,
    ...overrides,
  })
	})

  const createFetchResponse = (overrides: Partial<MockFetchResponse> = {}): MockFetchResponse => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: 'hola mundo' } }],
      usage: { total_tokens: 42 },
    }),
    text: async () => '',
    ...overrides,
  })

  test('L3 - Logic: same-language pass-through skips OpenAI', async () => {
    const segment = createSegment({ targetLanguage: 'en' })

    const result = await translateAndStore(mockDb as any, 'openai-key', segment)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockDb.query).toHaveBeenCalledTimes(1)
    const [, params] = mockDb.query.mock.calls[0]
    expect(params[2]).toBe('hello world') // original_text
    expect(params[3]).toBe('hello world') // translated_text
    expect(result).toEqual({ success: true, translatedText: 'hello world', segmentIndex: 1 })
  })

  test('L4 - OpenAI 500 stores fallback translation', async () => {
    fetchMock.mockResolvedValue(
      createFetchResponse({
        ok: false,
        status: 500,
        text: async () => 'upstream failed',
      })
    )

    const result = await translateAndStore(mockDb as any, 'openai-key', createSegment())

    expect(result.success).toBe(false)
    const [, params] = mockDb.query.mock.calls[0]
    expect(params[3]).toBe('[Translation unavailable] hello world')
    expect(loggerSpy.error).toHaveBeenCalledWith(
      'OpenAI translation failed',
      expect.objectContaining({ status: 500, segmentIndex: 1 })
    )
  })

  test('L4 - Network failure captures and stores degraded message', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await translateAndStore(mockDb as any, 'openai-key', createSegment())

    expect(result.success).toBe(false)
    const [, params] = mockDb.query.mock.calls[0]
    expect(params[3]).toBe('[Translation error] hello world')
    expect(loggerSpy.error).toHaveBeenCalledWith(
      'Translation processor error',
      expect.objectContaining({ segmentIndex: 1 })
    )
  })

  test('L6 - Voice pipeline degrades gracefully when TTS fails', async () => {
    fetchMock.mockResolvedValue(createFetchResponse())
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      success: false,
      error: 'tts failed',
      segmentIndex: 1,
    })

    const segment = createSegment({
      voiceToVoice: true,
      elevenlabsKey: '11-key',
      telnyxKey: 'telnyx-key',
      targetCallControlId: 'call-control',
      r2Client: {} as any,
      r2PublicUrl: 'https://audio.example.com',
    })

    const result = await translateAndStore(mockDb as any, 'openai-key', segment)

    expect(result.success).toBe(true)
    expect(queueAudioInjection).not.toHaveBeenCalled()
    expect(loggerSpy.warn).toHaveBeenCalledWith(
      'TTS synthesis failed, falling back to text-only',
      expect.objectContaining({ callId: 'call-123', segmentIndex: 1 })
    )
  })

  test('L6 - Audio injection failure logs warning but preserves translation', async () => {
    fetchMock.mockResolvedValue(createFetchResponse())
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      success: true,
      audioUrl: 'https://audio.example.com/segment.mp3',
      durationMs: 1800,
      segmentIndex: 1,
    })
    vi.mocked(queueAudioInjection).mockResolvedValue({ success: false, error: 'queue full' })

    const segment = createSegment({
      voiceToVoice: true,
      elevenlabsKey: '11-key',
      telnyxKey: 'telnyx-key',
      targetCallControlId: 'call-control',
      r2Client: {} as any,
      r2PublicUrl: 'https://audio.example.com',
    })

    const result = await translateAndStore(mockDb as any, 'openai-key', segment)

    expect(result.success).toBe(true)
    expect(queueAudioInjection).toHaveBeenCalledTimes(1)
    expect(loggerSpy.warn).toHaveBeenCalledWith(
      'Audio injection failed, text-only translation available',
      expect.objectContaining({ callId: 'call-123', segmentIndex: 1 })
    )
  })

  test('L7 - Successful voice-to-voice path injects audio', async () => {
    fetchMock.mockResolvedValue(createFetchResponse())
    vi.mocked(synthesizeSpeech).mockResolvedValue({
      success: true,
      audioUrl: 'https://audio.example.com/segment.mp3',
      durationMs: 1500,
      segmentIndex: 1,
    })
    vi.mocked(queueAudioInjection).mockResolvedValue({ success: true, injectionId: 'inj-123' })

    const segment = createSegment({
      voiceToVoice: true,
      elevenlabsKey: '11-key',
      telnyxKey: 'telnyx-key',
      targetCallControlId: 'call-control',
      r2Client: {} as any,
      r2PublicUrl: 'https://audio.example.com',
    })

    const result = await translateAndStore(mockDb as any, 'openai-key', segment)

    expect(result.success).toBe(true)
    expect(queueAudioInjection).toHaveBeenCalledWith(mockDb, 'telnyx-key', expect.any(Object))
    expect(loggerSpy.info).toHaveBeenCalledWith(
      'Voice-to-voice translation completed',
      expect.objectContaining({ callId: 'call-123', segmentIndex: 1, injectionId: 'inj-123' })
    )
  })
})
