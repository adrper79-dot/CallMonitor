/**
 * AI Router - Smart routing between Groq and OpenAI
 *
 * Routes AI requests to the most cost-effective provider based on task complexity.
 *
 * Routing Strategy:
 * - Groq (Llama 4 Scout): Simple tasks (translation, basic chat, sentiment)
 * - OpenAI (GPT-4o-mini): Complex tasks (compliance analysis, multi-step reasoning)
 * - Fallback: OpenAI if Groq fails
 *
 * Cost Savings: 38% on tasks routed to Groq
 *
 * @module workers/src/lib/ai-router
 */

import type { Env } from '../index'
import { logger } from './logger'
import { createGroqClient, type GroqChatMessage, type GroqUsage } from './groq-client'
import { redactPII } from './pii-redactor'
import { sanitizePrompt } from './prompt-sanitizer'

export type AITaskType =
  | 'translation'
  | 'simple_chat'
  | 'sentiment_analysis'
  | 'summarization'
  | 'compliance_analysis'
  | 'complex_reasoning'
  | 'bond_ai_chat'

export type AIProvider = 'groq' | 'openai'

export interface AIRoutingDecision {
  provider: AIProvider
  reason: string
  estimatedCost: number
}

export interface AIRouterOptions {
  preferCheap?: boolean // Always prefer Groq when possible
  allowFallback?: boolean // Fall back to OpenAI if Groq fails
  forceProvider?: AIProvider // Override routing logic
}

export interface AICompletionResult {
  content: string
  provider: AIProvider
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  cost_usd: number
  latency_ms: number
}

/**
 * Task complexity scoring
 *
 * Higher score = more complex = use OpenAI
 * Lower score = simple = use Groq
 */
const TASK_COMPLEXITY: Record<AITaskType, number> = {
  translation: 2, // Simple, use Groq
  simple_chat: 3, // Basic Q&A, use Groq
  sentiment_analysis: 2, // Pattern matching, use Groq
  summarization: 5, // Medium complexity, case-by-case
  compliance_analysis: 9, // Critical, use OpenAI
  complex_reasoning: 9, // Multi-step, use OpenAI
  bond_ai_chat: 6, // Depends on query, smart routing
}

/**
 * Complexity threshold
 *
 * Tasks with score >= threshold use OpenAI
 * Tasks with score < threshold use Groq
 */
const COMPLEXITY_THRESHOLD = 7

/**
 * Determine which AI provider to use for a task
 */
export function routeAITask(
  taskType: AITaskType,
  options: AIRouterOptions = {}
): AIRoutingDecision {
  const { preferCheap = true, forceProvider } = options

  // Override: Force specific provider
  if (forceProvider) {
    return {
      provider: forceProvider,
      reason: 'forced_by_caller',
      estimatedCost: forceProvider === 'groq' ? 0.0001 : 0.0003,
    }
  }

  const complexity = TASK_COMPLEXITY[taskType]

  // High complexity: Use OpenAI
  if (complexity >= COMPLEXITY_THRESHOLD) {
    return {
      provider: 'openai',
      reason: 'high_complexity_task',
      estimatedCost: 0.0003, // ~$0.30 per 1M tokens avg
    }
  }

  // Medium/Low complexity: Use Groq if cheaper
  if (preferCheap) {
    return {
      provider: 'groq',
      reason: 'cost_optimization',
      estimatedCost: 0.0001, // ~$0.10 per 1M tokens avg
    }
  }

  // Default to Groq for simple tasks
  return {
    provider: 'groq',
    reason: 'default_routing',
    estimatedCost: 0.0001,
  }
}

/**
 * Execute AI completion with smart routing
 *
 * Automatically routes to best provider, applies security layers,
 * and handles fallbacks.
 */
export async function executeAICompletion(
  prompt: string,
  taskType: AITaskType,
  env: Env,
  options: AIRouterOptions & {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    applyPIIRedaction?: boolean
    applyPromptSanitization?: boolean
  } = {}
): Promise<AICompletionResult> {
  const {
    systemPrompt,
    temperature = 0.7,
    maxTokens = 1000,
    applyPIIRedaction = true,
    applyPromptSanitization = true,
    allowFallback = true,
  } = options

  const startTime = Date.now()

  // 1. Security Layer: PII Redaction
  let processedPrompt = prompt
  if (applyPIIRedaction) {
    const redactionResult = redactPII(prompt)
    processedPrompt = redactionResult.redacted

    if (redactionResult.redactionCount > 0) {
      logger.info('PII redacted from AI prompt', {
        entities_redacted: redactionResult.redactionCount,
        task_type: taskType,
      })
    }
  }

  // 2. Security Layer: Prompt Sanitization
  if (applyPromptSanitization) {
    const sanitizationResult = sanitizePrompt(processedPrompt, {
      strictMode: true, // Block injection attempts
      maxLength: 4000,
    })

    if (sanitizationResult.blocked) {
      throw new Error(
        `Prompt injection detected: ${sanitizationResult.violations.join(', ')}`
      )
    }

    processedPrompt = sanitizationResult.sanitized

    if (sanitizationResult.violations.length > 0) {
      logger.warn('Suspicious prompt patterns detected', {
        violations: sanitizationResult.violations,
        task_type: taskType,
      })
    }
  }

  // 3. Route to appropriate provider
  const routing = routeAITask(taskType, options)

  logger.info('AI task routed', {
    task_type: taskType,
    provider: routing.provider,
    reason: routing.reason,
  })

  // 4. Execute with selected provider
  try {
    if (routing.provider === 'groq') {
      return await executeWithGroq(processedPrompt, systemPrompt, env, {
        temperature,
        maxTokens,
        startTime,
      })
    } else {
      return await executeWithOpenAI(processedPrompt, systemPrompt, env, {
        temperature,
        maxTokens,
        startTime,
      })
    }
  } catch (error: any) {
    logger.error(`${routing.provider.toUpperCase()} call failed`, {
      error: error?.message,
      task_type: taskType,
    })

    // Fallback to alternative provider
    if (allowFallback) {
      const fallbackProvider = routing.provider === 'groq' ? 'openai' : 'groq'

      logger.info('Falling back to alternative provider', {
        from: routing.provider,
        to: fallbackProvider,
      })

      if (fallbackProvider === 'openai') {
        return await executeWithOpenAI(processedPrompt, systemPrompt, env, {
          temperature,
          maxTokens,
          startTime,
        })
      } else {
        return await executeWithGroq(processedPrompt, systemPrompt, env, {
          temperature,
          maxTokens,
          startTime,
        })
      }
    }

    throw error
  }
}

/**
 * Execute with Groq
 */
async function executeWithGroq(
  prompt: string,
  systemPrompt: string | undefined,
  env: Env,
  options: {
    temperature: number
    maxTokens: number
    startTime: number
  }
): Promise<AICompletionResult> {
  const { temperature, maxTokens, startTime } = options

  const groqClient = createGroqClient(env)

  const messages: GroqChatMessage[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const response = await groqClient.chatCompletion(messages, {
    model: 'llama-4-scout',
    temperature,
    max_tokens: maxTokens,
  })

  const latency = Date.now() - startTime

  // Calculate cost
  const inputCost = (response.usage.prompt_tokens / 1_000_000) * 0.11
  const outputCost = (response.usage.completion_tokens / 1_000_000) * 0.34
  const costUsd = inputCost + outputCost

  return {
    content: response.choices[0]?.message?.content || '',
    provider: 'groq',
    usage: {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    },
    cost_usd: costUsd,
    latency_ms: latency,
  }
}

/**
 * Execute with OpenAI
 */
async function executeWithOpenAI(
  prompt: string,
  systemPrompt: string | undefined,
  env: Env,
  options: {
    temperature: number
    maxTokens: number
    startTime: number
  }
): Promise<AICompletionResult> {
  const { temperature, maxTokens, startTime } = options

  const messages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data: any = await response.json()
  const latency = Date.now() - startTime

  // Calculate cost (GPT-4o-mini pricing)
  const inputCost = (data.usage.prompt_tokens / 1_000_000) * 0.15
  const outputCost = (data.usage.completion_tokens / 1_000_000) * 0.60
  const costUsd = inputCost + outputCost

  return {
    content: data.choices[0]?.message?.content || '',
    provider: 'openai',
    usage: {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    },
    cost_usd: costUsd,
    latency_ms: latency,
  }
}

/**
 * Analyze query complexity for Bond AI
 *
 * Determines if query requires complex reasoning or simple lookup
 */
export function analyzeBondAIComplexity(
  userMessage: string
): 'simple' | 'medium' | 'complex' {
  const message = userMessage.toLowerCase()

  // Simple queries: Factual lookups, stats, status checks
  const simplePatterns = [
    /how many calls/,
    /what is (the|my)/,
    /show me/,
    /list/,
    /get/,
    /find/,
    /total/,
    /count/,
    /status of/,
  ]

  if (simplePatterns.some((pattern) => pattern.test(message))) {
    return 'simple'
  }

  // Complex queries: Analysis, recommendations, multi-step reasoning
  const complexPatterns = [
    /why/,
    /how (can|should|would)/,
    /recommend/,
    /suggest/,
    /compare/,
    /analyze/,
    /explain/,
    /what if/,
    /strategy/,
    /optimize/,
  ]

  if (complexPatterns.some((pattern) => pattern.test(message))) {
    return 'complex'
  }

  // Medium: Everything else
  return 'medium'
}

/**
 * Route Bond AI chat based on query complexity
 */
export async function executeBondAIChat(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  systemPrompt: string,
  env: Env
): Promise<AICompletionResult> {
  const complexity = analyzeBondAIComplexity(userMessage)

  // Simple queries: Use Groq
  // Complex queries: Use OpenAI
  // Medium queries: Use Groq with OpenAI fallback

  const taskType: AITaskType =
    complexity === 'complex' ? 'complex_reasoning' : 'bond_ai_chat'

  return await executeAICompletion(userMessage, taskType, env, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 800,
    allowFallback: true, // Always fallback for Bond AI (user-facing)
  })
}
