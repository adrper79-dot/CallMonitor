/**
 * Sentiment Processor — Real-time sentiment scoring pipeline
 *
 * Runs in parallel with translation-processor.ts on each call.transcription webhook.
 * Scores every 3rd transcription segment to control OpenAI costs.
 *
 * Pipeline:
 *   Telnyx call.transcription → handleSentimentAnalysis() → OpenAI GPT-4o-mini
 *   → INSERT call_sentiment_scores → Update call_sentiment_summary
 *   → Check alert threshold → Trigger alert if needed
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 2
 */

import type { DbClient } from './db'
import { logger } from './logger'

const OPENAI_BASE = 'https://api.openai.com/v1'
const SENTIMENT_MODEL = 'gpt-4o-mini'

/** Only score every Nth segment to control OpenAI spend (~1 score per 9s) */
const SCORE_EVERY_N_SEGMENTS = 3

/** Default objection keywords if org hasn't configured custom ones */
const DEFAULT_OBJECTION_KEYWORDS = [
  'cancel',
  'lawsuit',
  'attorney',
  'complaint',
  'supervisor',
  'manager',
  'refuse',
  'dispute',
  'unfair',
  'illegal',
]

export interface SentimentInput {
  callId: string
  organizationId: string
  transcript: string
  segmentIndex: number
}

export interface SentimentResult {
  score: number
  objections: string[]
  escalation: boolean
}

/**
 * Analyze sentiment of a transcription segment.
 * Runs as non-blocking fire-and-forget from the webhook handler.
 *
 * Rate control: Only processes every 3rd segment.
 */
export async function handleSentimentAnalysis(
  db: DbClient,
  openaiKey: string,
  input: SentimentInput
): Promise<void> {
  const { callId, organizationId, transcript, segmentIndex } = input

  // Rate control: only score every Nth segment
  if (segmentIndex % SCORE_EVERY_N_SEGMENTS !== 0) {
    return
  }

  // Check if sentiment analysis is enabled for this org
  const configResult = await db.query(
    `SELECT enabled, alert_threshold, objection_keywords, alert_channels, webhook_url
     FROM sentiment_alert_configs
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId]
  )

  // If no config or not enabled, skip
  const config = configResult.rows[0]
  if (!config || !config.enabled) {
    return
  }

  const startTime = Date.now()

  try {
    // Score sentiment via OpenAI
    const result = await scoreSentiment(openaiKey, transcript)
    const latencyMs = Date.now() - startTime

    // Detect objections from keyword list
    const keywords: string[] = config.objection_keywords || DEFAULT_OBJECTION_KEYWORDS
    const keywordMatches = detectObjections(transcript, keywords)
    const allObjections = [...new Set([...result.objections, ...keywordMatches])]

    // Determine escalation
    const shouldEscalate =
      result.escalation ||
      (result.score < (config.alert_threshold ?? -0.5) && allObjections.length > 0)

    // INSERT into call_sentiment_scores
    await db.query(
      `INSERT INTO call_sentiment_scores
        (organization_id, call_id, segment_index, transcript_text, score, objections,
         escalation_recommended, model_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING`,
      [
        organizationId,
        callId,
        segmentIndex,
        transcript,
        result.score,
        JSON.stringify(allObjections),
        shouldEscalate,
        SENTIMENT_MODEL,
        latencyMs,
      ]
    )

    // UPDATE or INSERT call_sentiment_summary (aggregate)
    await db.query(
      `INSERT INTO call_sentiment_summary
        (call_id, organization_id, avg_score, min_score, max_score,
         total_segments, objection_count, escalation_triggered, updated_at)
       VALUES ($1, $2, $3, $3, $3, 1, $4, $5, NOW())
       ON CONFLICT (call_id) DO UPDATE SET
         avg_score = (
           (call_sentiment_summary.avg_score * call_sentiment_summary.total_segments + $3)
           / (call_sentiment_summary.total_segments + 1)
         ),
         min_score = LEAST(call_sentiment_summary.min_score, $3),
         max_score = GREATEST(call_sentiment_summary.max_score, $3),
         total_segments = call_sentiment_summary.total_segments + 1,
         objection_count = call_sentiment_summary.objection_count + $4,
         escalation_triggered = call_sentiment_summary.escalation_triggered OR $5,
         escalation_triggered_at = CASE
           WHEN $5 AND NOT call_sentiment_summary.escalation_triggered THEN NOW()
           ELSE call_sentiment_summary.escalation_triggered_at
         END,
         updated_at = NOW()`,
      [callId, organizationId, result.score, allObjections.length, shouldEscalate]
    )

    // Check if alert should be triggered
    if (shouldEscalate) {
      await triggerSentimentAlert(db, config, {
        callId,
        organizationId,
        score: result.score,
        objections: allObjections,
        segmentIndex,
        transcript,
      })
    }

    logger.info('Sentiment scored', {
      callId,
      segmentIndex,
      score: result.score,
      objections: allObjections.length,
      escalation: shouldEscalate,
      latencyMs,
    })
  } catch (err: any) {
    logger.warn('Sentiment analysis error (non-fatal)', {
      callId,
      segmentIndex,
      error: err?.message,
    })
  }
}

/**
 * Call OpenAI to score sentiment of text.
 * Returns score (-1.0 to 1.0), detected objections, and escalation recommendation.
 */
async function scoreSentiment(openaiKey: string, text: string): Promise<SentimentResult> {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SENTIMENT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a call center sentiment analyzer. Analyze the sentiment of the caller's speech.
Return ONLY a JSON object with these fields:
- "score": a number from -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
- "objections": an array of detected objection phrases (empty if none).
- "escalation": boolean — true if the caller seems distressed, angry, or requesting a supervisor.

Example: {"score": -0.7, "objections": ["want to cancel", "speak to manager"], "escalation": true}
Example: {"score": 0.3, "objections": [], "escalation": false}`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(5000), // 5s timeout
  })

  if (!response.ok) {
    throw new Error(`OpenAI sentiment API error: ${response.status}`)
  }

  const data = await response.json<{
    choices: Array<{ message: { content: string } }>
  }>()

  const content = data.choices?.[0]?.message?.content?.trim() || ''

  try {
    const parsed = JSON.parse(content)
    return {
      score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      escalation: Boolean(parsed.escalation),
    }
  } catch {
    // If JSON parsing fails, try to extract a score from the text
    logger.warn('Sentiment JSON parse failed, using default', {
      content: content.substring(0, 100),
    })
    return { score: 0, objections: [], escalation: false }
  }
}

/**
 * Detect objection keywords in transcript text (case-insensitive).
 */
function detectObjections(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()))
}

/**
 * Trigger a sentiment alert — dashboard push + optional webhook.
 */
async function triggerSentimentAlert(
  db: DbClient,
  config: any,
  data: {
    callId: string
    organizationId: string
    score: number
    objections: string[]
    segmentIndex: number
    transcript: string
  }
): Promise<void> {
  const { callId, organizationId, score, objections, segmentIndex } = data
  const channels: string[] = config.alert_channels || ['dashboard']

  // Webhook delivery (if configured)
  if (channels.includes('webhook') && config.webhook_url) {
    fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'sentiment.alert',
        call_id: callId,
        organization_id: organizationId,
        score,
        objections,
        segment_index: segmentIndex,
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => {
      logger.warn('Sentiment alert webhook delivery failed', { error: (err as Error)?.message })
    })
  }

  logger.info('Sentiment alert triggered', {
    callId,
    organizationId,
    score,
    objections: objections.length,
    channels,
  })
}

