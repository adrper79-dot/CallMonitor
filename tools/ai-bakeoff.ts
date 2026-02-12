/**
 * AI Bakeoff Harness: Groq+Grok vs OpenAI+ElevenLabs
 *
 * Scenarios:
 *  - LLM Translation (EN↔ES/FR/PT/AR/ZH)
 *  - TTS-only
 *  - Translation → TTS pipeline
 *
 * Concurrency: capped at 10 in-flight tasks.
 * Metrics: p50/p95 latency, per-step latency, cost tokens/audio-bytes, error rate.
 * Output: console table + JSON summary written to artifacts/ai-bakeoff-report.json.
 *
 * Env (expected):
 *  GROQ_API_KEY              - for Groq LLM (OpenAI compatible)
 *  OPENAI_API_KEY            - baseline LLM (optional if only testing Groq)
 *  GROK_VOICE_API_KEY        - for Grok voice/TTS (WebSocket realtime endpoint)
 *  GROK_VOICE_URL            - WS URL for Grok TTS (e.g., wss://api.x.ai/v1/realtime)
 *  GROK_VOICE_VOICE          - voice/model id for Grok TTS
 *  ELEVENLABS_API_KEY        - baseline TTS (optional if only testing Grok)
 *  ELEVENLABS_VOICE_ID       - voice id (e.g., Rachel)
 *  ARTIFACT_DIR              - optional, defaults to ./artifacts
 *
 * Note: Grok TTS endpoint details vary by account; adjust GROK_VOICE_URL/payload if needed.
 */

import fs from 'fs'
import path from 'path'
import WebSocket from 'ws'

// Simple semaphore for concurrency limiting
class Semaphore {
  private queue: Array<() => void> = []
  private active = 0
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active += 1
    try {
      return await fn()
    } finally {
      this.active -= 1
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

type ProviderLLM = 'groq' | 'openai'
type ProviderTTS = 'grok' | 'elevenlabs'

interface LatencySample {
  provider: string
  scenario: string
  language: string
  detail: string
  ms: number
  cost?: number
  bytes?: number
  ok: boolean
  error?: string
}

interface TranslationPair {
  source: string
  target: string
  text: string
}

const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(process.cwd(), 'artifacts')
const MAX_LLM_CONCURRENCY = 10
const MAX_TTS_CONCURRENCY = 20

const translationPairs: TranslationPair[] = [
  { source: 'es', target: 'en', text: 'Hola, necesito ayuda con mi factura. ¿Puedes verificar el saldo pendiente?' },
  { source: 'fr', target: 'en', text: "Bonjour, j'ai une question sur ma facture. Le paiement n'a pas été enregistré." },
  { source: 'pt', target: 'en', text: 'Olá, preciso de ajuda com minha fatura. Você pode verificar o valor em aberto?' },
  { source: 'ar', target: 'en', text: 'مرحبًا، أحتاج إلى المساعدة في فاتورتي. هل يمكنك التحقق من المبلغ المستحق؟' },
  { source: 'zh', target: 'en', text: '你好，我需要帮助处理我的账单。你能查一下未付余额吗？' },
  { source: 'en', target: 'es', text: 'Hello, I need help with my bill. Can you check the outstanding balance?' },
]

const ttsPrompts = [
  { lang: 'en', text: 'Thank you for calling. This is a performance benchmark of the voice system.' },
  { lang: 'es', text: 'Gracias por llamar. Esta es una prueba de rendimiento del sistema de voz.' },
  { lang: 'fr', text: "Merci d'avoir appelé. Ceci est un test de performance du système vocal." },
  { lang: 'pt', text: 'Obrigado por ligar. Este é um teste de desempenho do sistema de voz.' },
  { lang: 'ar', text: 'شكرًا لاتصالك. هذا اختبار أداء لنظام الصوت.' },
  { lang: 'zh', text: '感谢您的来电。这是语音系统的性能测试。' },
]

// Helpers
const now = () => performance.now()

function percentile(samples: number[], p: number): number {
  if (!samples.length) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function callGroqChat(pair: TranslationPair): Promise<{ text: string; cost?: number }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Missing GROQ_API_KEY')
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'Translate the user message. Return only the translation text.' },
      { role: 'user', content: `Translate from ${pair.source} to ${pair.target}: ${pair.text}` },
    ],
    temperature: 0.1,
  }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq chat failed: ${res.status} ${err}`)
  }
  const json: any = await res.json()
  const text = json.choices?.[0]?.message?.content?.trim() || ''
  const cost = json.usage?.total_tokens
  return { text, cost }
}

async function callOpenAIChat(pair: TranslationPair): Promise<{ text: string; cost?: number }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Translate the user message. Return only the translation text.' },
      { role: 'user', content: `Translate from ${pair.source} to ${pair.target}: ${pair.text}` },
    ],
    temperature: 0.1,
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI chat failed: ${res.status} ${err}`)
  }
  const json: any = await res.json()
  const text = json.choices?.[0]?.message?.content?.trim() || ''
  const cost = json.usage?.total_tokens
  return { text, cost }
}

async function callGrokTTS(text: string, lang: string): Promise<{ audio: Uint8Array; cost?: number }> {
  const apiKey = process.env.GROK_VOICE_API_KEY
  const url = process.env.GROK_VOICE_URL?.includes('?')
    ? process.env.GROK_VOICE_URL
    : `${process.env.GROK_VOICE_URL}?model=grok-2-latest`
  const voice = process.env.GROK_VOICE_VOICE || 'Ara'
  if (!apiKey || !url) throw new Error('Missing GROK_VOICE_API_KEY or GROK_VOICE_URL')

  if (!url.startsWith('wss://')) {
    throw new Error('Grok voice URL must be WebSocket (wss://) for realtime voice')
  }

  return new Promise<{ audio: Uint8Array }>((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    const chunks: Uint8Array[] = []
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      ws.terminate()
      reject(new Error('Grok TTS timed out'))
    }, 25000)

    ws.on('open', () => {
      // Initialize session for audio output
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice,
            audio: {
              output: {
                format: {
                  type: 'audio/pcm',
                  rate: 24000,
                },
              },
            },
          },
        })
      )
      // Create a conversation item with text content
      ws.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }],
          },
        })
      )
      // Ask for a response with audio modality
      ws.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['audio'],
            voice,
          },
        })
      )
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if ((msg.type === 'response.output_audio.delta' || msg.type === 'response.audio.delta') && msg.delta) {
          chunks.push(Buffer.from(msg.delta, 'base64'))
        }
        if (
          msg.type === 'response.output_audio.done' ||
          msg.type === 'response.audio.delta.playback_completed' ||
          msg.type === 'response.audio.done'
        ) {
          if (!settled) {
            settled = true
            clearTimeout(timeout)
            ws.close()
            resolve({ audio: concatChunks(chunks) })
          }
        }
        if (msg.type === 'error' && msg.error) {
          const errMsg = typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)
          throw new Error(errMsg)
        }
      } catch (err: any) {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          ws.close()
          reject(new Error(`Grok WS parse error: ${err.message || err}`))
        }
      }
    })

    ws.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(new Error(`Grok WS error: ${err.message}`))
      }
    })

    ws.on('close', () => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(new Error('Grok WS closed before completion'))
      }
    })
  })
}

async function callElevenLabsTTS(text: string, lang: string): Promise<{ audio: Uint8Array; cost?: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  if (!apiKey || !voiceId) throw new Error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID')

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.5 },
    output_format: 'mp3_64k',
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${err}`)
  }
  const buffer = new Uint8Array(await res.arrayBuffer())
  return { audio: buffer }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = now()
  const value = await fn()
  return { ms: now() - start, value }
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

async function runLLMBenchmarks(): Promise<LatencySample[]> {
  const sem = new Semaphore(MAX_LLM_CONCURRENCY)
  const tasks = translationPairs.map((pair) =>
    sem.run(async () => {
      const samples: LatencySample[] = []
      // Groq
      try {
        const { ms, value } = await timed(() => callGroqChat(pair))
        samples.push({ provider: 'groq', scenario: 'translation', language: `${pair.source}->${pair.target}`, detail: 'groq', ms, cost: value.cost, ok: true })
      } catch (err: any) {
        samples.push({ provider: 'groq', scenario: 'translation', language: `${pair.source}->${pair.target}`, detail: 'groq', ms: 0, ok: false, error: err?.message })
      }
      // OpenAI baseline (optional)
      if (process.env.OPENAI_API_KEY) {
        try {
          const { ms, value } = await timed(() => callOpenAIChat(pair))
          samples.push({ provider: 'openai', scenario: 'translation', language: `${pair.source}->${pair.target}`, detail: 'openai', ms, cost: value.cost, ok: true })
        } catch (err: any) {
          samples.push({ provider: 'openai', scenario: 'translation', language: `${pair.source}->${pair.target}`, detail: 'openai', ms: 0, ok: false, error: err?.message })
        }
      }
      return samples
    })
  )
  const nested = await Promise.all(tasks)
  return nested.flat()
}

async function runTTSBenchmarks(): Promise<LatencySample[]> {
  const sem = new Semaphore(MAX_TTS_CONCURRENCY)
  const elevenSem = new Semaphore(5)
  const tasks = ttsPrompts.map((prompt) =>
    sem.run(async () => {
      const samples: LatencySample[] = []
      // Grok voice
      try {
        const { ms, value } = await timed(() => callGrokTTS(prompt.text, prompt.lang))
        samples.push({ provider: 'grok', scenario: 'tts', language: prompt.lang, detail: 'grok', ms, bytes: value.audio.byteLength, ok: true })
      } catch (err: any) {
        samples.push({ provider: 'grok', scenario: 'tts', language: prompt.lang, detail: 'grok', ms: 0, ok: false, error: err?.message })
      }
      // ElevenLabs baseline (optional, throttled to 5 concurrent)
      if (process.env.ELEVENLABS_API_KEY) {
        await elevenSem.run(async () => {
          try {
            const { ms, value } = await timed(() => callElevenLabsTTS(prompt.text, prompt.lang))
            samples.push({ provider: 'elevenlabs', scenario: 'tts', language: prompt.lang, detail: 'elevenlabs', ms, bytes: value.audio.byteLength, ok: true })
          } catch (err: any) {
            samples.push({ provider: 'elevenlabs', scenario: 'tts', language: prompt.lang, detail: 'elevenlabs', ms: 0, ok: false, error: err?.message })
          }
        })
      }
      return samples
    })
  )
  const nested = await Promise.all(tasks)
  return nested.flat()
}

async function runPipelineBenchmarks(): Promise<LatencySample[]> {
  const sem = new Semaphore(MAX_TTS_CONCURRENCY)
  const elevenSem = new Semaphore(5)
  const tasks = translationPairs.map((pair) =>
    sem.run(async () => {
      const samples: LatencySample[] = []
      // Groq + Grok pipeline
      try {
        const { ms: llmMs, value: llm } = await timed(() => callGroqChat(pair))
        const { ms: ttsMs, value: tts } = await timed(() => callGrokTTS(llm.text, pair.target))
        samples.push({ provider: 'groq+grok', scenario: 'translation+tts', language: `${pair.source}->${pair.target}`, detail: 'groq+grok', ms: llmMs + ttsMs, bytes: tts.audio.byteLength, cost: llm.cost, ok: true })
      } catch (err: any) {
        samples.push({ provider: 'groq+grok', scenario: 'translation+tts', language: `${pair.source}->${pair.target}`, detail: 'groq+grok', ms: 0, ok: false, error: err?.message })
      }
      // Baseline OpenAI + ElevenLabs (optional)
      if (process.env.OPENAI_API_KEY && process.env.ELEVENLABS_API_KEY) {
        try {
          const { ms: llmMs, value: llm } = await timed(() => callOpenAIChat(pair))
          const { ms: ttsMs, value: tts } = await elevenSem.run(() => timed(() => callElevenLabsTTS(llm.text, pair.target)))
          samples.push({ provider: 'openai+elevenlabs', scenario: 'translation+tts', language: `${pair.source}->${pair.target}`, detail: 'openai+elevenlabs', ms: llmMs + ttsMs, bytes: tts.audio.byteLength, cost: llm.cost, ok: true })
        } catch (err: any) {
          samples.push({ provider: 'openai+elevenlabs', scenario: 'translation+tts', language: `${pair.source}->${pair.target}`, detail: 'openai+elevenlabs', ms: 0, ok: false, error: err?.message })
        }
      }
      return samples
    })
  )
  const nested = await Promise.all(tasks)
  return nested.flat()
}

function summarize(samples: LatencySample[]) {
  const byKey = new Map<string, LatencySample[]>()
  for (const s of samples) {
    const key = `${s.provider}|${s.scenario}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(s)
  }
  const summary = [] as Array<{ provider: string; scenario: string; p50: number; p95: number; okRate: number; avgBytes?: number }>
  for (const [key, list] of byKey.entries()) {
    const [provider, scenario] = key.split('|')
    const ok = list.filter((l) => l.ok)
    const latencies = ok.map((l) => l.ms)
    const p50 = percentile(latencies, 50)
    const p95 = percentile(latencies, 95)
    const okRate = list.length ? ok.length / list.length : 0
    const avgBytes = ok.length ? ok.reduce((sum, l) => sum + (l.bytes || 0), 0) / ok.length : undefined
    summary.push({ provider, scenario, p50, p95, okRate, avgBytes })
  }
  return summary
}

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  }

  console.log('▶️  Running AI bakeoff (Groq/Grok vs OpenAI/ElevenLabs)...')
  console.log(`   Concurrency: LLM ${MAX_LLM_CONCURRENCY} / TTS ${MAX_TTS_CONCURRENCY}`)

  const llm = await runLLMBenchmarks()
  const tts = await runTTSBenchmarks()
  const pipeline = await runPipelineBenchmarks()

  const all = [...llm, ...tts, ...pipeline]
  const summary = summarize(all)

  const artifactPath = path.join(ARTIFACT_DIR, 'ai-bakeoff-report.json')
  fs.writeFileSync(artifactPath, JSON.stringify({ summary, samples: all }, null, 2), 'utf8')

  console.log('\nSummary (p50/p95 ms, ok rate):')
  for (const row of summary) {
    const p50 = row.p50.toFixed(0).padStart(5)
    const p95 = row.p95.toFixed(0).padStart(5)
    const okRate = `${(row.okRate * 100).toFixed(1)}%`.padStart(6)
    const bytes = row.avgBytes ? `${Math.round(row.avgBytes)} bytes` : '-'
    console.log(`  ${row.scenario.padEnd(18)} ${row.provider.padEnd(18)} p50=${p50} p95=${p95} ok=${okRate} avgBytes=${bytes}`)
  }

  const errors = all.filter((s) => !s.ok)
  if (errors.length) {
    console.log('\nErrors:')
    for (const e of errors) {
      console.log(`  [${e.provider}][${e.scenario}][${e.language}] ${e.error}`)
    }
  }

  console.log(`\nReport saved to: ${artifactPath}`)
}

main().catch((err) => {
  console.error('Bakeoff failed:', err)
  process.exit(1)
})