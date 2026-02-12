/**
 * Post-Transcription Processor — Unified Pipeline
 *
 * Runs after AssemblyAI webhook delivers a completed transcript.
 * Extracts and stores:
 *   1. Speaker utterances (diarization)
 *   2. Auto-highlights (key phrases)
 *   3. Sentiment analysis (per-sentence)
 *   4. AI-generated call summary (via Groq/OpenAI)
 *   5. Fan-out webhook event to subscribers
 *
 * Architecture:
 *   - Called from AssemblyAI webhook handler (fire-and-forget via waitUntil or inline)
 *   - Uses `calls` table columns: speaker_utterances, auto_highlights, assemblyai_sentiment,
 *     ai_summary, transcription_completed_at
 *   - Summary generation routed through ai-router (Groq for cost, OpenAI fallback)
 *   - Webhook fan-out via existing webhook-retry infrastructure
 *
 * AI Role Policy: This is "analysis" — AI summarizes and scores but does NOT
 * negotiate, persuade, or act as agent of intent.
 *
 * @module workers/src/lib/post-transcription-processor
 */

import type { Env } from '../index'
import type { DbClient } from './db'
import { logger } from './logger'
import { executeAICompletion } from './ai-router'
import { fanOutToSubscribers } from './webhook-retry'
import { writeAuditLog, AuditAction } from './audit'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AssemblyAITranscriptPayload {
  transcript_id: string
  status: string
  text: string
  utterances?: Array<{
    speaker: string
    text: string
    start: number
    end: number
    confidence: number
    words?: Array<{ text: string; start: number; end: number; confidence: number }>
  }>
  sentiment_analysis_results?: Array<{
    text: string
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
    confidence: number
    start: number
    end: number
    speaker?: string
  }>
  auto_highlights_result?: {
    status: string
    results: Array<{
      count: number
      rank: number
      text: string
      timestamps: Array<{ start: number; end: number }>
    }>
  }
  entities?: Array<{
    entity_type: string
    text: string
    start: number
    end: number
  }>
  content_safety_labels?: {
    status: string
    results: Array<{
      text: string
      labels: Array<{ label: string; confidence: number; severity: number }>
      timestamp: { start: number; end: number }
    }>
    summary: Record<string, number>
  }
}

interface PostTranscriptionContext {
  callId: string
  organizationId: string
  transcriptText: string
  payload: AssemblyAITranscriptPayload
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Process completed AssemblyAI transcript — extract enrichment data and generate summary.
 *
 * This function is designed to be called fire-and-forget from the webhook handler.
 * All errors are caught and logged; failures do NOT affect the webhook response.
 *
 * @param env - Workers environment bindings
 * @param db - Database client (caller manages connection lifecycle)
 * @param ctx - Post-transcription context with call/org IDs and full AssemblyAI payload
 */
export async function processCompletedTranscript(
  env: Env,
  db: DbClient,
  ctx: PostTranscriptionContext
): Promise<void> {
  const { callId, organizationId, transcriptText, payload } = ctx
  const startTime = Date.now()

  try {
    // 1. Extract and store speaker utterances
    const utterances = extractUtterances(payload)

    // 2. Extract and store auto-highlights
    const highlights = extractHighlights(payload)

    // 3. Extract and store sentiment analysis
    const sentiment = extractSentiment(payload)

    // 4. Extract entities (amounts, dates, names)
    const entities = extractEntities(payload)

    // 5. Extract content safety labels
    const contentSafety = extractContentSafety(payload)

    // 6. Store enrichment data in a single UPDATE
    await db.query(
      `UPDATE calls
       SET speaker_utterances = $1,
           auto_highlights = $2,
           assemblyai_sentiment = $3,
           detected_entities = $4,
           content_safety_labels = $5,
           transcription_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $6 AND organization_id = $7`,
      [
        utterances ? JSON.stringify(utterances) : null,
        highlights ? JSON.stringify(highlights) : null,
        sentiment ? JSON.stringify(sentiment) : null,
        entities ? JSON.stringify(entities) : null,
        contentSafety ? JSON.stringify(contentSafety) : null,
        callId,
        organizationId,
      ]
    )

    logger.info('Post-transcription enrichment stored', {
      callId,
      hasUtterances: !!utterances,
      utteranceCount: utterances?.length ?? 0,
      hasHighlights: !!highlights,
      highlightCount: highlights?.length ?? 0,
      hasSentiment: !!sentiment,
      sentimentCount: sentiment?.length ?? 0,
      hasEntities: !!entities,
      entityCount: entities?.length ?? 0,
      hasContentSafety: !!contentSafety,
    })

    // 7. Generate AI summary with full audio intelligence context
    await generateCallSummary(env, db, callId, organizationId, transcriptText, utterances, sentiment, highlights, entities)

    // 8. Auto-create follow-up tasks from AI analysis (non-blocking)
    autoCreateTasksFromAnalysis(db, callId, organizationId, entities, utterances, transcriptText).catch((err) => {
      logger.warn('Auto-task creation failed (non-fatal)', { callId, error: (err as Error)?.message })
    })

    // 9. Fan-out webhook event to subscribers
    fanOutToSubscribers({
      db,
      env: { waitUntil: undefined }, // Fire-and-forget within this context
      orgId: organizationId,
      event: 'call.transcription_completed',
      payload: {
        call_id: callId,
        transcript_length: transcriptText.length,
        speaker_count: utterances ? new Set(utterances.map((u) => u.speaker)).size : 0,
        has_sentiment: !!sentiment,
        highlight_count: highlights?.length ?? 0,
      },
    }).catch((err) => {
      logger.warn('Webhook fan-out failed (non-fatal)', {
        callId,
        error: (err as Error)?.message,
      })
    })

    const elapsed = Date.now() - startTime
    logger.info('Post-transcription processing complete', {
      callId,
      elapsed_ms: elapsed,
    })
  } catch (err) {
    logger.error('Post-transcription processing failed', {
      callId,
      error: (err as Error)?.message,
      stack: (err as Error)?.stack,
    })
    // Non-fatal — do not re-throw. The transcript text was already stored by the webhook handler.
  }
}

// ─── Extraction Helpers ─────────────────────────────────────────────────────

function extractUtterances(payload: AssemblyAITranscriptPayload) {
  if (!payload.utterances || payload.utterances.length === 0) return null

  return payload.utterances.map((u) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
    confidence: u.confidence,
  }))
}

function extractHighlights(payload: AssemblyAITranscriptPayload) {
  if (
    !payload.auto_highlights_result?.results ||
    payload.auto_highlights_result.results.length === 0
  ) {
    return null
  }

  return payload.auto_highlights_result.results.map((h) => ({
    text: h.text,
    count: h.count,
    rank: h.rank,
    timestamps: h.timestamps,
  }))
}

function extractSentiment(payload: AssemblyAITranscriptPayload) {
  if (!payload.sentiment_analysis_results || payload.sentiment_analysis_results.length === 0) {
    return null
  }

  return payload.sentiment_analysis_results.map((s) => ({
    text: s.text,
    sentiment: s.sentiment,
    confidence: s.confidence,
    start: s.start,
    end: s.end,
    speaker: s.speaker ?? null,
  }))
}

function extractEntities(payload: AssemblyAITranscriptPayload) {
  if (!payload.entities || payload.entities.length === 0) return null

  return payload.entities.map((e) => ({
    entity_type: e.entity_type,
    text: e.text,
    start: e.start,
    end: e.end,
  }))
}

function extractContentSafety(payload: AssemblyAITranscriptPayload) {
  if (!payload.content_safety_labels?.results || payload.content_safety_labels.results.length === 0) {
    return null
  }

  return {
    results: payload.content_safety_labels.results.map((r) => ({
      text: r.text,
      labels: r.labels,
      timestamp: r.timestamp,
    })),
    summary: payload.content_safety_labels.summary ?? {},
  }
}

// ─── AI Summary Generation ──────────────────────────────────────────────────

/**
 * Generate a concise call summary using the AI Router (Groq preferred, OpenAI fallback).
 * Now includes full audio intelligence context: utterances, sentiment, highlights, entities.
 *
 * AI Role Policy: Summary is observational/analytical only.
 * AI does NOT evaluate agent performance or make compliance determinations here.
 */
async function generateCallSummary(
  env: Env,
  db: DbClient,
  callId: string,
  organizationId: string,
  transcriptText: string,
  utterances: Array<{ speaker: string; text: string; start: number; end: number }> | null,
  sentiment: Array<{ text: string; sentiment: string; confidence: number; speaker: string | null }> | null,
  highlights: Array<{ text: string; count: number; rank: number }> | null,
  entities: Array<{ entity_type: string; text: string }> | null
): Promise<void> {
  try {
    // Skip summary generation if transcript is too short
    if (transcriptText.length < 50) {
      logger.info('Transcript too short for summary generation', { callId, length: transcriptText.length })
      return
    }

    // Build rich audio intelligence context for the LLM
    const contextParts: string[] = []

    if (utterances && utterances.length > 0) {
      const speakers = new Set(utterances.map((u) => u.speaker))
      const totalDuration = utterances.reduce((sum, u) => sum + (u.end - u.start), 0)
      const talkBySpkr: Record<string, number> = {}
      for (const u of utterances) {
        talkBySpkr[u.speaker] = (talkBySpkr[u.speaker] || 0) + (u.end - u.start)
      }
      const talkRatio = Object.entries(talkBySpkr)
        .map(([s, t]) => `Speaker ${s}: ${totalDuration > 0 ? Math.round((t / totalDuration) * 100) : 0}%`)
        .join(', ')
      contextParts.push(`Speakers: ${speakers.size}. Talk ratio: ${talkRatio}.`)
    }

    if (sentiment && sentiment.length > 0) {
      const positive = sentiment.filter((s) => s.sentiment === 'POSITIVE').length
      const negative = sentiment.filter((s) => s.sentiment === 'NEGATIVE').length
      const neutral = sentiment.filter((s) => s.sentiment === 'NEUTRAL').length
      contextParts.push(`Sentiment breakdown: ${positive} positive, ${neutral} neutral, ${negative} negative segments.`)
    }

    if (highlights && highlights.length > 0) {
      const topHighlights = highlights.slice(0, 5).map((h) => h.text).join(', ')
      contextParts.push(`Key phrases: ${topHighlights}.`)
    }

    if (entities && entities.length > 0) {
      const amounts = entities.filter((e) => e.entity_type === 'money_amount').map((e) => e.text)
      const dates = entities.filter((e) => e.entity_type === 'date' || e.entity_type === 'date_of_birth').map((e) => e.text)
      if (amounts.length > 0) contextParts.push(`Mentioned amounts: ${amounts.join(', ')}.`)
      if (dates.length > 0) contextParts.push(`Mentioned dates: ${dates.join(', ')}.`)
    }

    const audioContext = contextParts.length > 0 ? `\n\nAudio Intelligence:\n${contextParts.join('\n')}` : ''

    // Truncate very long transcripts to stay within token limits
    const maxTranscriptLength = 6000
    const truncatedTranscript =
      transcriptText.length > maxTranscriptLength
        ? transcriptText.substring(0, maxTranscriptLength) + '\n\n[Transcript truncated for summary]'
        : transcriptText

    const result = await executeAICompletion(
      truncatedTranscript + audioContext,
      'summarization',
      env,
      {
        systemPrompt: `You are a call analysis assistant for a compliance-focused debt collection call center platform.

You have the full transcript PLUS structured audio intelligence data (speaker diarization, sentiment analysis, key phrases, and extracted entities like dollar amounts and dates).

Summarize this call in 2-4 sentences. Include:
- The main topic/purpose of the call
- Key outcomes or decisions made (include specific dollar amounts and dates if detected)
- Any follow-up actions mentioned
- Overall tone/sentiment trajectory if notable

Do NOT evaluate agent performance or make compliance judgments. Report facts only.
Respond with ONLY the summary text, no labels or prefixes.`,
        temperature: 0.3,
        maxTokens: 400,
        applyPIIRedaction: true,
        applyPromptSanitization: true,
      }
    )

    if (result.content) {
      await db.query(
        `UPDATE calls
         SET ai_summary = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [result.content.trim(), callId, organizationId]
      )

      logger.info('AI summary generated (enriched)', {
        callId,
        provider: result.provider,
        cost_usd: result.cost_usd,
        latency_ms: result.latency_ms,
        audioContextItems: contextParts.length,
      })
    }
  } catch (err) {
    logger.warn('AI summary generation failed (non-fatal)', {
      callId,
      error: (err as Error)?.message,
    })
    // Non-fatal — summary is supplementary enrichment
  }
}

// ─── Auto-Task Creation from Analysis ───────────────────────────────────────

/**
 * Automatically create collection_tasks when AI detects:
 * - Payment promises (entity_type: money_amount + date mentions)
 * - Follow-up needs (based on call content analysis)
 *
 * Links calls → collection_accounts via phone number matching.
 * AI Role Policy: Creates tasks for human review, does NOT execute actions.
 */
async function autoCreateTasksFromAnalysis(
  db: DbClient,
  callId: string,
  organizationId: string,
  entities: Array<{ entity_type: string; text: string }> | null,
  utterances: Array<{ speaker: string; text: string }> | null,
  transcriptText: string
): Promise<void> {
  try {
    // Find linked collection account via call's to_number or from_number
    const callResult = await db.query(
      `SELECT c.to_number, c.from_number, c.user_id
       FROM calls c WHERE c.id = $1 AND c.organization_id = $2`,
      [callId, organizationId]
    )
    if (callResult.rows.length === 0) return

    const { to_number, from_number, user_id } = callResult.rows[0]

    // Match to a collection account by phone number
    const accountResult = await db.query(
      `SELECT id FROM collection_accounts
       WHERE organization_id = $1
         AND is_deleted = false
         AND (primary_phone = $2 OR primary_phone = $3
              OR secondary_phone = $2 OR secondary_phone = $3)
       LIMIT 1`,
      [organizationId, to_number, from_number]
    )
    if (accountResult.rows.length === 0) return // No linked collection account

    const accountId = accountResult.rows[0].id
    const createdBy = user_id || 'system'

    // 1. Detect payment promises: money amounts + date mentions
    const amounts = entities?.filter((e) => e.entity_type === 'money_amount') || []
    const dates = entities?.filter((e) => e.entity_type === 'date') || []

    if (amounts.length > 0) {
      const amountText = amounts.map((a) => a.text).join(', ')
      const dateText = dates.length > 0 ? ` by ${dates[0].text}` : ''

      // Check for existing recent promise task to avoid duplicates
      const existingTask = await db.query(
        `SELECT id FROM collection_tasks
         WHERE account_id = $1 AND organization_id = $2
           AND type = 'promise' AND status = 'pending'
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [accountId, organizationId]
      )

      if (existingTask.rows.length === 0) {
        const taskResult = await db.query(
          `INSERT INTO collection_tasks
            (organization_id, account_id, type, title, notes, due_date, assigned_to, created_by)
           VALUES ($1, $2, 'promise', $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            organizationId,
            accountId,
            `Payment promise: ${amountText}${dateText}`,
            `Auto-detected from call ${callId}. Amounts mentioned: ${amountText}. Dates: ${dates.map((d) => d.text).join(', ') || 'none specified'}.`,
            dates.length > 0 ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days if no date
            createdBy !== 'system' ? createdBy : null,
            createdBy,
          ]
        )

        writeAuditLog(db, {
          organizationId,
          userId: createdBy,
          resourceType: 'collection_tasks',
          resourceId: taskResult.rows[0].id,
          action: AuditAction.COLLECTION_TASK_CREATED,
          oldValue: null,
          newValue: { auto_created: true, source: 'post_transcription', call_id: callId },
        })

        logger.info('Auto-created promise task from transcription', {
          callId,
          accountId,
          taskId: taskResult.rows[0].id,
          amounts: amountText,
        })
      }
    }

    // 2. Detect callback/follow-up requests in transcript
    const followUpPatterns = /\b(call (me |you )?back|follow[- ]?up|next (week|month|time)|schedule|appointment|callback)\b/i
    if (followUpPatterns.test(transcriptText)) {
      const existingFollowup = await db.query(
        `SELECT id FROM collection_tasks
         WHERE account_id = $1 AND organization_id = $2
           AND type = 'followup' AND status = 'pending'
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [accountId, organizationId]
      )

      if (existingFollowup.rows.length === 0) {
        await db.query(
          `INSERT INTO collection_tasks
            (organization_id, account_id, type, title, notes, due_date, assigned_to, created_by)
           VALUES ($1, $2, 'followup', $3, $4, $5, $6, $7)`,
          [
            organizationId,
            accountId,
            'Follow-up requested during call',
            `Auto-detected follow-up request from call ${callId}.`,
            new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
            createdBy !== 'system' ? createdBy : null,
            createdBy,
          ]
        )

        logger.info('Auto-created follow-up task from transcription', { callId, accountId })
      }
    }
  } catch (err) {
    // Re-throw to let the caller's .catch() handle it
    throw err
  }
}
