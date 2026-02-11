/**
 * Groq LLM Client - Ultra-fast inference with Llama models
 *
 * Groq provides 4x faster inference than traditional providers at 1/10th the cost.
 * Compatible with OpenAI API format for easy migration.
 *
 * Pricing: Llama 4 Scout - $0.11/M input, $0.34/M output
 *
 * @module workers/src/lib/groq-client
 */

import type { Env } from '../index'
import { logger } from './logger'

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqChatCompletionOptions {
  model?: 'llama-4-scout' | 'llama-3.3-70b' | 'llama-3.1-8b'
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
}

export interface GroqUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface GroqChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage: GroqUsage
}

/**
 * Groq API Client
 */
export class GroqClient {
  private apiKey: string
  private baseURL = 'https://api.groq.com/openai/v1'

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'placeholder-groq-key') {
      logger.warn('Groq API key not configured - using placeholder')
    }
    this.apiKey = apiKey
  }

  /**
   * Create chat completion using Groq
   */
  async chatCompletion(
    messages: GroqChatMessage[],
    options: GroqChatCompletionOptions = {}
  ): Promise<GroqChatCompletionResponse> {
    const {
      model = 'llama-4-scout', // Cheapest, fastest
      temperature = 0.7,
      max_tokens = 1000,
      top_p = 1,
      stream = false,
    } = options

    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          top_p,
          stream,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Groq API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = (await response.json()) as GroqChatCompletionResponse

      const latency = Date.now() - startTime

      logger.info('Groq chat completion successful', {
        model,
        tokens: data.usage.total_tokens,
        latency_ms: latency,
        cost_usd: calculateGroqCost(data.usage, model),
      })

      return data
    } catch (error: any) {
      logger.error('Groq API call failed', {
        error: error?.message,
        model,
        latency_ms: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Simple text completion (single message)
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    options?: GroqChatCompletionOptions
  ): Promise<string> {
    const messages: GroqChatMessage[] = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const response = await this.chatCompletion(messages, options)
    return response.choices[0]?.message?.content || ''
  }
}

/**
 * Calculate Groq API cost based on usage
 */
export function calculateGroqCost(usage: GroqUsage, model: string): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'llama-4-scout': { input: 0.11, output: 0.34 }, // per 1M tokens
    'llama-3.3-70b': { input: 0.59, output: 0.79 },
    'llama-3.1-8b': { input: 0.05, output: 0.08 },
  }

  const modelPricing = pricing[model] || pricing['llama-4-scout']

  const inputCost = (usage.prompt_tokens / 1_000_000) * modelPricing.input
  const outputCost = (usage.completion_tokens / 1_000_000) * modelPricing.output

  return inputCost + outputCost
}

/**
 * Create Groq client instance
 */
export function createGroqClient(env: Env): GroqClient {
  const apiKey = env.GROQ_API_KEY || 'placeholder-groq-key'
  return new GroqClient(apiKey)
}

/**
 * Helper: Translate text using Groq
 *
 * Optimized for translation tasks with lower temperature.
 */
export async function translateWithGroq(
  text: string,
  sourceLang: string,
  targetLang: string,
  env: Env
): Promise<string> {
  const client = createGroqClient(env)

  const systemPrompt = `You are a real-time call translator. Translate the following ${sourceLang} text to ${targetLang}.
Output ONLY the translated text with no explanation. Preserve the speaker's tone and intent.`

  const response = await client.complete(text, systemPrompt, {
    model: 'llama-4-scout',
    temperature: 0.3, // Lower temp for translation accuracy
    max_tokens: 500,
  })

  return response.trim()
}

/**
 * Helper: Sentiment analysis using Groq
 *
 * Returns JSON: { score: -1.0 to 1.0, objections: string[], escalation: boolean }
 */
export async function analyzeSentimentWithGroq(
  transcript: string,
  env: Env
): Promise<{ score: number; objections: string[]; escalation: boolean }> {
  const client = createGroqClient(env)

  const systemPrompt = `You are a call center sentiment analyzer. Analyze the sentiment of the following transcript and return ONLY valid JSON with no markdown formatting:

{
  "score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "objections": [<array of detected objection phrases>],
  "escalation": <boolean: true if customer is distressed/angry>
}

Be concise. Focus on emotional tone.`

  const response = await client.complete(transcript, systemPrompt, {
    model: 'llama-4-scout',
    temperature: 0.2,
    max_tokens: 200,
  })

  try {
    // Remove markdown code fences if present
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch (error) {
    logger.error('Failed to parse Groq sentiment response', {
      response,
      error: (error as Error)?.message,
    })
    // Return neutral sentiment on parse error
    return { score: 0, objections: [], escalation: false }
  }
}

/**
 * Helper: Simple chat completion using Groq
 *
 * For basic chatbot queries, Q&A, etc.
 */
export async function chatWithGroq(
  userMessage: string,
  conversationHistory: GroqChatMessage[],
  systemPrompt: string,
  env: Env
): Promise<{ reply: string; usage: GroqUsage }> {
  const client = createGroqClient(env)

  const messages: GroqChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  const response = await client.chatCompletion(messages, {
    model: 'llama-4-scout',
    temperature: 0.7,
    max_tokens: 800,
  })

  return {
    reply: response.choices[0]?.message?.content || '',
    usage: response.usage,
  }
}
