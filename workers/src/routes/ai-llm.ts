/**
 * AI LLM Routes — OpenAI Edge Proxy with KV Rate Limiting
 *
 * Proxies OpenAI API requests through Cloudflare Workers to:
 * 1. Authenticate via session (requireAuth)
 * 2. Gate by plan tier (requirePlan 'pro'+)
 * 3. Rate limit per IP (aiLlmRateLimit — 30/5min)
 * 4. Prevent API key exposure to client
 * 5. Log usage for cost tracking
 *
 * Endpoints:
 *   POST /chat          - Chat completion (GPT-4o-mini default)
 *   POST /summarize     - Summarize text (call transcripts, notes)
 *   POST /analyze       - Analyze call for compliance/quality
 *
 * @see ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md — AI operates as notary/stenographer
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, authMiddleware } from '../lib/auth'
import { getDb } from '../lib/db'
import { aiLlmRateLimit } from '../lib/rate-limit'
import { requirePlan } from '../lib/plan-gating'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { validateBody } from '../lib/validate'
import { AiLlmChatSchema, AiLlmSummarizeSchema, AiLlmAnalyzeSchema } from '../lib/schemas'

export const aiLlmRoutes = new Hono<AppEnv>()

const OPENAI_BASE = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_TOKENS = 4096

// POST /chat — Proxied chat completion
aiLlmRoutes.post('/chat', aiLlmRateLimit, authMiddleware, requirePlan('pro'), async (c) => {
  const session = c.get('session') as any
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const apiKey = c.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'LLM service not configured' }, 503)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, AiLlmChatSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const totalChars = body.messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
    if (totalChars > 50000) {
      return c.json({ error: 'Total message content exceeds 50,000 characters' }, 400)
    }

    const oaiResponse = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || DEFAULT_MODEL,
        messages: body.messages,
        max_tokens: Math.min(body.max_tokens || MAX_TOKENS, MAX_TOKENS),
        temperature: body.temperature ?? 0.3,
      }),
    })

    if (!oaiResponse.ok) {
      const errText = await oaiResponse.text()
      logger.error('OpenAI API error', { status: oaiResponse.status, error: errText })
      return c.json({ error: 'LLM service error' }, 502)
    }

    const oaiResult = await oaiResponse.json<{
      id: string
      choices: Array<{ message: { role: string; content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }>()

    // Log token usage for cost tracking
    logger.info('OpenAI usage', {
      orgId: session.organization_id,
      model: body.model || DEFAULT_MODEL,
      promptTokens: oaiResult.usage?.prompt_tokens,
      completionTokens: oaiResult.usage?.completion_tokens,
      totalTokens: oaiResult.usage?.total_tokens,
    })

    // Audit log AI chat usage (BL-093)
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'ai_llm',
      resourceId: session.organization_id,
      action: AuditAction.AI_CHAT_COMPLETED,
      oldValue: null,
      newValue: { model: body.model || DEFAULT_MODEL, total_tokens: oaiResult.usage?.total_tokens },
    })

    return c.json({
      content: oaiResult.choices?.[0]?.message?.content || '',
      usage: oaiResult.usage,
      model: body.model || DEFAULT_MODEL,
    })
  } catch (err: any) {
    logger.error('POST /api/ai/llm/chat error', { error: err?.message })
    return c.json({ error: 'LLM request failed' }, 500)
  } finally {
    await db.end()
  }
})

// POST /summarize — Summarize call transcript
aiLlmRoutes.post('/summarize', aiLlmRateLimit, authMiddleware, requirePlan('starter'), async (c) => {
  const session = c.get('session') as any
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const apiKey = c.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'LLM service not configured' }, 503)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, AiLlmSummarizeSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const oaiResponse = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional call center analyst. Summarize the following call transcript concisely, highlighting key points, action items, and any compliance concerns. Be factual and objective.',
          },
          { role: 'user', content: body.text.substring(0, 100000) },
        ],
        max_tokens: Math.min(body.max_length || 1000, 2000),
        temperature: 0.2,
      }),
    })

    if (!oaiResponse.ok) {
      const errText = await oaiResponse.text()
      logger.error('OpenAI summarize error', { status: oaiResponse.status, error: errText })
      return c.json({ error: 'Summarization failed' }, 502)
    }

    const oaiResult = await oaiResponse.json<{
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }>()

    const summary = oaiResult.choices?.[0]?.message?.content || ''

    // Store summary if call_id provided
    if (body.call_id) {
      await db.query(
        `INSERT INTO ai_summaries (org_id, call_id, provider, summary_text, status, created_at)
         VALUES ($1, $2, 'openai', $3, 'completed', NOW())
         ON CONFLICT DO NOTHING`,
        [session.organization_id, body.call_id, summary.substring(0, 5000)]
      )

      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'ai_summaries',
        resourceId: body.call_id,
        action: AuditAction.AI_SUMMARIZE_COMPLETED,
        oldValue: null,
        newValue: { call_id: body.call_id, provider: 'openai', status: 'completed' },
      })
    }

    return c.json({
      summary,
      usage: oaiResult.usage,
      call_id: body.call_id || null,
    })
  } catch (err: any) {
    logger.error('POST /api/ai/llm/summarize error', { error: err?.message })
    return c.json({ error: 'Summarization failed' }, 500)
  } finally {
    await db.end()
  }
})

// POST /analyze — Analyze call for compliance and quality
aiLlmRoutes.post('/analyze', aiLlmRateLimit, authMiddleware, requirePlan('pro'), async (c) => {
  const session = c.get('session') as any
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const apiKey = c.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'LLM service not configured' }, 503)
  }

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, AiLlmAnalyzeSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const analysisPrompts: Record<string, string> = {
      compliance:
        'Analyze this call transcript for regulatory compliance issues. Check for: proper disclosures, consent violations, prohibited language, TCPA/HIPAA/SOC2 concerns. Return a structured assessment with severity levels.',
      quality:
        'Analyze this call transcript for quality metrics. Assess: professionalism, issue resolution, customer satisfaction signals, adherence to script, and communication effectiveness. Provide a score out of 100 with breakdown.',
      sentiment:
        'Analyze the sentiment of this call transcript. Track sentiment changes throughout the conversation. Identify positive/negative peaks, overall tone, and customer satisfaction level.',
      full: 'Provide a comprehensive analysis of this call transcript covering: 1) Compliance check (disclosures, consent, prohibited language), 2) Quality score with breakdown, 3) Sentiment analysis, 4) Key action items, 5) Risk flags.',
    }

    const analysisType = body.analysis_type || 'full'

    const oaiResponse = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a call center compliance and quality analyst for the Word Is Bond platform. ${analysisPrompts[analysisType]}. Return your analysis in JSON format.`,
          },
          { role: 'user', content: body.text.substring(0, 100000) },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!oaiResponse.ok) {
      const errText = await oaiResponse.text()
      logger.error('OpenAI analyze error', { status: oaiResponse.status, error: errText })
      return c.json({ error: 'Analysis failed' }, 502)
    }

    const oaiResult = await oaiResponse.json<{
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }>()

    let analysis: any
    try {
      analysis = JSON.parse(oaiResult.choices?.[0]?.message?.content || '{}')
    } catch {
      analysis = { raw: oaiResult.choices?.[0]?.message?.content }
    }

    // Audit log AI analysis usage (BL-093)
    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'ai_llm',
      resourceId: session.organization_id,
      action: AuditAction.AI_ANALYZE_COMPLETED,
      oldValue: null,
      newValue: { analysis_type: analysisType, total_tokens: oaiResult.usage?.total_tokens },
    })

    return c.json({
      analysis,
      analysis_type: analysisType,
      usage: oaiResult.usage,
    })
  } catch (err: any) {
    logger.error('POST /api/ai/llm/analyze error', { error: err?.message })
    return c.json({ error: 'Analysis failed' }, 500)
  } finally {
    await db.end()
  }
})

