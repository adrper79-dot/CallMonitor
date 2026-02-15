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
    integration: `\n\nContext: The user is setting up or managing integrations (CRM, Slack, Teams, QuickBooks, Google Workspace, Zendesk, webhooks). Help them connect services, troubleshoot sync issues, configure field mappings, and understand data flow between systems. Offer step-by-step guidance. If they mention a specific provider, tailor your advice to that provider's capabilities and limitations.`,
    onboarding: `\n\nContext: The user is going through initial setup. Guide them step-by-step through connecting their tools and configuring their workspace. Be encouraging and proactive — suggest next steps after each completed configuration.`,
  }

  return base + (contextPrompts[contextType || ''] || '')
}

// ── Data Fetchers (tools Bond AI can use) ──────────────────

export async function fetchOrgStats(env: Env, orgId: string) {
  const db = getDb(env)
  try {
    const [calls, tests, scorecards] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') as last_7d,
                COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '24 hours') as last_24h
         FROM calls WHERE organization_id = $1 AND is_deleted = false`,
        [orgId]
      ),
      db.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE tr.status = 'passed') as passed,
                COUNT(*) FILTER (WHERE tr.status = 'failed') as failed
         FROM test_results tr
         JOIN test_configs tc ON tc.id = tr.test_config_id
         WHERE tc.organization_id = $1 AND tr.created_at > NOW() - INTERVAL '30 days'`,
        [orgId]
      ),
      db.query(
        `SELECT COUNT(*) as total
         FROM scorecards WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [orgId]
      ),
    ])

    return {
      calls: calls.rows[0] || { total: 0, last_7d: 0, last_24h: 0 },
      tests: tests.rows[0] || { total: 0, passed: 0, failed: 0 },
      scorecards: scorecards.rows[0] || { total: 0 },
    }
  } finally {
    await db.end()
  }
}

export async function fetchRecentAlerts(env: Env, _orgId: string, _limit = 10) {
  // bond_ai_alerts table does not exist yet — return empty gracefully
  try {
    return [] as Array<Record<string, unknown>>
  } catch {
    return []
  }
}

export async function fetchKpiSummary(env: Env, orgId: string) {
  const db = getDb(env)
  try {
    const [settings, recentPerformance] = await Promise.all([
      db.query(
        `SELECT id, response_time_threshold_ms, response_time_warning_ms,
                consecutive_failures_before_alert, alert_sensitivity,
                default_test_frequency, send_email_alerts, send_sms_alerts,
                alert_on_recovery
         FROM kpi_settings
         WHERE organization_id = $1`,
        [orgId]
      ),
      db.query(
        `SELECT COUNT(*) as total_runs,
                COUNT(*) FILTER (WHERE tr.status = 'passed') as passed,
                COUNT(*) FILTER (WHERE tr.status = 'failed') as failed,
                ROUND(AVG(tr.duration_ms)::numeric, 0) as avg_duration_ms
         FROM test_results tr
         JOIN test_configs tc ON tc.id = tr.test_config_id
         WHERE tc.organization_id = $1 AND tr.created_at > NOW() - INTERVAL '7 days'`,
        [orgId]
      ),
    ])

    return {
      settings: settings.rows[0] || null,
      recentPerformance: recentPerformance.rows[0] || {
        total_runs: 0,
        passed: 0,
        failed: 0,
        avg_duration_ms: null,
      },
    }
  } finally {
    await db.end()
  }
}

export async function fetchCallContext(env: Env, orgId: string, callId: string) {
  const db = getDb(env)
  try {
    const [call, scorecards] = await Promise.all([
      db.query(
        `SELECT id, caller_id_used, status, started_at, ended_at,
                call_sid, disposition, system_id, created_by
         FROM calls WHERE id = $1 AND organization_id = $2 AND is_deleted = false`,
        [callId, orgId]
      ),
      db.query(
        `SELECT id, name, description, structure, created_at
         FROM scorecards WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [orgId]
      ),
    ])

    return {
      call: call.rows[0] || null,
      scorecards: scorecards.rows,
    }
  } finally {
    await db.end()
  }
}

export async function fetchTestResults(env: Env, orgId: string, limit = 20) {
  const db = getDb(env)
  try {
    const result = await db.query(
      `SELECT tr.id, tr.test_config_id, tr.status, tr.duration_ms, tr.meta, tr.created_at,
              tc.name as test_name, tc.test_type
       FROM test_results tr
       JOIN test_configs tc ON tc.id = tr.test_config_id
       WHERE tc.organization_id = $1
       ORDER BY tr.created_at DESC
       LIMIT $2`,
      [orgId, limit]
    )
    return result.rows
  } finally {
    await db.end()
  }
}

export async function fetchIntegrationContext(env: Env, orgId: string) {
  const db = getDb(env)
  try {
    const [integrations, syncLog, channels] = await Promise.all([
      db.query(
        `SELECT id, provider, status, error_message, last_sync_at, config,
                created_at, updated_at
         FROM integrations WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [orgId]
      ),
      db.query(
        `SELECT sl.id, sl.integration_id, sl.direction, sl.records_synced,
                sl.records_failed, sl.status, sl.error_detail, sl.started_at, sl.completed_at,
                i.provider
         FROM crm_sync_log sl
         JOIN integrations i ON i.id = sl.integration_id
         WHERE sl.organization_id = $1
         ORDER BY sl.started_at DESC LIMIT 10`,
        [orgId]
      ),
      db.query(
        `SELECT id, provider, name, is_active, created_at
         FROM notification_channels WHERE organization_id = $1`,
        [orgId]
      ).catch(() => ({ rows: [] })),
    ])

    return {
      integrations: integrations.rows,
      recentSyncs: syncLog.rows,
      notificationChannels: channels.rows,
      summary: {
        totalIntegrations: integrations.rows.length,
        activeIntegrations: integrations.rows.filter((i: any) => i.status === 'active').length,
        errorIntegrations: integrations.rows.filter((i: any) => i.status === 'error').length,
        lastSyncAt: syncLog.rows[0]?.started_at || null,
      },
    }
  } finally {
    await db.end()
  }
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
  maxTokens = 1024
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

  const data = (await response.json()) as any
  const latencyMs = Date.now() - start

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage || {},
    model: data.model || model,
    latencyMs,
  }
}

