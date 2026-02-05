/**
 * Bond AI — Core intelligence layer
 * System prompt builder + tool definitions for the 3-tier AI assistant
 * 
 * Tier 1: Chat widget (contextual help, data queries)
 * Tier 2: Proactive alerts (KPI monitoring, anomaly detection)
 * Tier 3: Call co-pilot (real-time guidance during calls)
 */

import type { Env } from '../index'
import { getDb } from './db'
import type { Session } from './auth'

// ── System Prompts ──────────────────────────────────────────

export function buildSystemPrompt(session: Session, contextType?: string): string {
  const base = `You are Bond AI, the intelligent assistant for Wordis Bond — the system of record for business conversations.

You work for ${session.name || session.email}'s organization. Your role is to help them understand call data, test results, campaign performance, scorecards, and compliance metrics.

Guidelines:
- Be concise and data-driven. Reference specific numbers when available.
- When asked about calls, use the context data provided. Don't make up statistics.
- For compliance questions, always err on the side of caution and recommend review.
- You have access to: call records, test configs, scorecards, KPI data, campaign results, and alert history.
- Format responses with markdown. Use tables for comparisons.
- Never expose raw SQL, internal IDs, or system architecture details.
- If you don't have enough data to answer, say so clearly.`

  const contextPrompts: Record<string, string> = {
    call: `\n\nContext: The user is viewing a specific call record. Help them understand the call details, transcript highlights, scorecard results, and any flags.`,
    campaign: `\n\nContext: The user is reviewing a campaign. Help them analyze campaign performance, completion rates, and agent scores.`,
    scorecard: `\n\nContext: The user is working with scorecards. Help them understand scoring criteria, agent performance trends, and compliance metrics.`,
    test: `\n\nContext: The user is reviewing test/QA results. Help them understand test pass rates, frequency configs, and KPI performance.`,
    report: `\n\nContext: The user is looking at reports. Help them interpret analytics, identify trends, and suggest improvements.`,
    copilot: `\n\nContext: You are acting as a real-time call co-pilot. Provide brief, actionable guidance. Keep responses under 2 sentences. Focus on: compliance reminders, script adherence, and objection handling tips.`,
  }

  return base + (contextPrompts[contextType || ''] || '')
}

// ── Data Fetchers (tools Bond AI can use) ──────────────────

export async function fetchOrgStats(env: Env, orgId: string) {
  const db = getDb(env)
  const [calls, tests, scorecards] = await Promise.all([
    db.query(
      `SELECT COUNT(*) as total, 
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
       FROM calls WHERE organization_id = $1`,
      [orgId]
    ),
    db.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'passed') as passed,
              COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM test_results WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [orgId]
    ),
    db.query(
      `SELECT COUNT(*) as total,
              ROUND(AVG(total_score)::numeric, 1) as avg_score
       FROM scorecards WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [orgId]
    ),
  ])

  return {
    calls: calls.rows[0] || { total: 0, last_7d: 0, last_24h: 0 },
    tests: tests.rows[0] || { total: 0, passed: 0, failed: 0 },
    scorecards: scorecards.rows[0] || { total: 0, avg_score: null },
  }
}

export async function fetchRecentAlerts(env: Env, orgId: string, limit = 10) {
  const db = getDb(env)
  const result = await db.query(
    `SELECT id, alert_type, severity, title, message, status, created_at
     FROM bond_ai_alerts
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [orgId, limit]
  )
  return result.rows
}

export async function fetchKpiSummary(env: Env, orgId: string) {
  const db = getDb(env)
  const result = await db.query(
    `SELECT ks.metric_name, ks.target_value, ks.warning_threshold,
            kl.metric_value as latest_value, kl.recorded_at
     FROM kpi_settings ks
     LEFT JOIN LATERAL (
       SELECT metric_value, recorded_at FROM kpi_logs
       WHERE organization_id = ks.organization_id AND metric_name = ks.metric_name
       ORDER BY recorded_at DESC LIMIT 1
     ) kl ON true
     WHERE ks.organization_id = $1`,
    [orgId]
  )
  return result.rows
}

export async function fetchCallContext(env: Env, orgId: string, callId: string) {
  const db = getDb(env)
  const [call, summary, scorecard] = await Promise.all([
    db.query(
      `SELECT id, phone_number, direction, status, duration_seconds, 
              recording_url, created_at
       FROM calls WHERE id = $1 AND organization_id = $2`,
      [callId, orgId]
    ),
    db.query(
      `SELECT summary_text, topics_discussed, potential_concerns, 
              recommended_followup, confidence_score
       FROM ai_summaries WHERE call_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [callId, orgId]
    ),
    db.query(
      `SELECT total_score, section_scores, notes
       FROM scorecards WHERE call_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [callId, orgId]
    ),
  ])

  return {
    call: call.rows[0] || null,
    summary: summary.rows[0] || null,
    scorecard: scorecard.rows[0] || null,
  }
}

export async function fetchTestResults(env: Env, orgId: string, limit = 20) {
  const db = getDb(env)
  const result = await db.query(
    `SELECT tr.id, tr.test_config_id, tr.status, tr.score, tr.details, tr.created_at,
            tc.name as test_name, tc.test_type
     FROM test_results tr
     JOIN test_configs tc ON tc.id = tr.test_config_id
     WHERE tr.organization_id = $1
     ORDER BY tr.created_at DESC
     LIMIT $2`,
    [orgId, limit]
  )
  return result.rows
}

// ── OpenAI Chat Completion ──────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function chatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  model = 'gpt-4o-mini',
  maxTokens = 1024,
): Promise<{ content: string; usage: any; model: string; latencyMs: number }> {
  const start = Date.now()

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  const latencyMs = Date.now() - start

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage || {},
    model: data.model || model,
    latencyMs,
  }
}
