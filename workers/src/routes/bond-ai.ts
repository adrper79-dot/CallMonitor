/**
 * Bond AI Routes — 3-Tier AI Assistant
 *
 * Tier 1: POST /chat — Conversational AI with org context
 * Tier 2: GET/POST /alerts — Proactive alert management
 * Tier 3: POST /copilot — Real-time call co-pilot
 *
 * All endpoints are org-scoped and rate-aware.
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import {
  AnalyzeCallSchema,
  ChatSchema,
  UpdateInsightSchema,
  BulkInsightSchema,
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  CopilotSchema,
} from '../lib/schemas'
import {
  buildSystemPrompt,
  chatCompletion,
  fetchOrgStats,
  fetchRecentAlerts,
  fetchKpiSummary,
  fetchCallContext,
  fetchTestResults,
} from '../lib/bond-ai'
import { requirePlan } from '../lib/plan-gating'
import { aiLlmRateLimit } from '../lib/rate-limit'

export const bondAiRoutes = new Hono<{ Bindings: Env }>()

// ════════════════════════════════════════════════════════════
// TIER 1: CHAT WIDGET
// ════════════════════════════════════════════════════════════

// List conversations
bondAiRoutes.get('/conversations', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const result = await db.query(
      `SELECT id, title, context_type, context_id, model, status, message_count, 
              last_message_at, created_at
       FROM bond_ai_conversations
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 50`,
      [session.organization_id, session.user_id]
    )

    return c.json({ success: true, conversations: result.rows })
  } catch (err: any) {
    return c.json({ error: 'Failed to list conversations' }, 500)
  } finally {
    await db.end()
  }
})

// Create conversation
bondAiRoutes.post('/conversations', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, AnalyzeCallSchema)
    if (!parsed.success) return parsed.response
    const { title, context_type, context_id, model } = parsed.data

    const result = await db.query(
      `INSERT INTO bond_ai_conversations 
        (organization_id, user_id, title, context_type, context_id, model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, context_type, context_id, model, status, created_at`,
      [
        session.organization_id,
        session.user_id,
        title || 'New conversation',
        context_type || null,
        context_id || null,
        model || 'gpt-4o-mini',
      ]
    )

    return c.json({ success: true, conversation: result.rows[0] }, 201)
  } catch (err: any) {
    return c.json({ error: 'Failed to create conversation' }, 500)
  } finally {
    await db.end()
  }
})

// Send chat message (the main Tier 1 endpoint)
bondAiRoutes.post('/chat', requirePlan('pro'), aiLlmRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    if (!c.env.OPENAI_API_KEY) {
      return c.json({ error: 'AI service not configured' }, 503)
    }

    const parsed = await validateBody(c, ChatSchema)
    if (!parsed.success) return parsed.response
    const { message, conversation_id, context_type, context_id } = parsed.data
    let convoId = conversation_id

    // Auto-create conversation if none provided
    if (!convoId) {
      const convo = await db.query(
        `INSERT INTO bond_ai_conversations 
          (organization_id, user_id, title, context_type, context_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          session.organization_id,
          session.user_id,
          message.slice(0, 60) + (message.length > 60 ? '...' : ''),
          context_type || null,
          context_id || null,
        ]
      )
      convoId = convo.rows[0].id
    } else {
      // Verify conversation belongs to user/org
      const verify = await db.query(
        `SELECT id FROM bond_ai_conversations 
         WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND status = 'active'`,
        [convoId, session.organization_id, session.user_id]
      )
      if (verify.rows.length === 0) {
        return c.json({ error: 'Conversation not found' }, 404)
      }
    }

    // Save user message
    await db.query(
      `INSERT INTO bond_ai_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)`,
      [convoId, message]
    )

    // Build context data for the AI
    const contextData: string[] = []

    // Always include org stats summary
    try {
      const stats = await fetchOrgStats(c.env, session.organization_id)
      contextData.push(`Organization stats: ${JSON.stringify(stats)}`)
    } catch {
      /* non-critical */
    }

    // Include call-specific context if viewing a call
    if (context_type === 'call' && context_id) {
      try {
        const callCtx = await fetchCallContext(c.env, session.organization_id, context_id)
        contextData.push(`Current call context: ${JSON.stringify(callCtx)}`)
      } catch {
        /* non-critical */
      }
    }

    // Include test results if asking about testing
    if (context_type === 'test' || message.toLowerCase().includes('test')) {
      try {
        const tests = await fetchTestResults(c.env, session.organization_id, 10)
        contextData.push(`Recent test results: ${JSON.stringify(tests)}`)
      } catch {
        /* non-critical */
      }
    }

    // Include KPI data if asking about performance
    if (message.toLowerCase().match(/kpi|metric|performance|score/)) {
      try {
        const kpis = await fetchKpiSummary(c.env, session.organization_id)
        contextData.push(`KPI data: ${JSON.stringify(kpis)}`)
      } catch {
        /* non-critical */
      }
    }

    // Include recent alerts if asking about alerts
    if (message.toLowerCase().match(/alert|warning|issue|problem/)) {
      try {
        const alerts = await fetchRecentAlerts(c.env, session.organization_id, 5)
        contextData.push(`Recent alerts: ${JSON.stringify(alerts)}`)
      } catch {
        /* non-critical */
      }
    }

    // Get conversation history (last 20 messages for context)
    const historyResult = await db.query(
      `SELECT role, content FROM bond_ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [convoId]
    )

    // Build messages array for OpenAI
    const systemPrompt = buildSystemPrompt(session, context_type || undefined)
    const contextBlock =
      contextData.length > 0
        ? `\n\n--- Available Data ---\n${contextData.join('\n\n')}\n--- End Data ---`
        : ''

    const messages = [
      { role: 'system' as const, content: systemPrompt + contextBlock },
      ...historyResult.rows.map((r: any) => ({
        role: r.role as 'user' | 'assistant',
        content: r.content,
      })),
    ]

    // Call OpenAI
    const aiResponse = await chatCompletion(c.env.OPENAI_API_KEY, messages, 'gpt-4o-mini', 1536)

    // Save assistant message
    await db.query(
      `INSERT INTO bond_ai_messages (conversation_id, role, content, token_usage, model, latency_ms)
       VALUES ($1, 'assistant', $2, $3, $4, $5)`,
      [
        convoId,
        aiResponse.content,
        JSON.stringify(aiResponse.usage),
        aiResponse.model,
        aiResponse.latencyMs,
      ]
    )

    // Update conversation metadata
    await db.query(
      `UPDATE bond_ai_conversations 
       SET message_count = message_count + 2, last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [convoId]
    )

    return c.json({
      success: true,
      conversation_id: convoId,
      response: {
        content: aiResponse.content,
        model: aiResponse.model,
        latency_ms: aiResponse.latencyMs,
      },
    })
  } catch (err: any) {
    return c.json({ error: 'AI chat failed: ' + (err.message || 'Unknown error') }, 500)
  } finally {
    await db.end()
  }
})

// Get conversation messages
bondAiRoutes.get('/conversations/:id/messages', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const conversationId = c.req.param('id')

    // Verify ownership
    const convo = await db.query(
      `SELECT id, title, context_type, context_id, model, message_count
       FROM bond_ai_conversations
       WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
      [conversationId, session.organization_id, session.user_id]
    )

    if (convo.rows.length === 0) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    const messages = await db.query(
      `SELECT id, role, content, model, latency_ms, created_at
       FROM bond_ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    )

    return c.json({
      success: true,
      conversation: convo.rows[0],
      messages: messages.rows,
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to get messages' }, 500)
  } finally {
    await db.end()
  }
})

// Delete/archive conversation
bondAiRoutes.delete('/conversations/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const conversationId = c.req.param('id')

    await db.query(
      `UPDATE bond_ai_conversations SET status = 'deleted', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND user_id = $3`,
      [conversationId, session.organization_id, session.user_id]
    )

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete conversation' }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// TIER 2: PROACTIVE ALERTS
// ════════════════════════════════════════════════════════════

// Get alerts feed
bondAiRoutes.get('/alerts', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const status = c.req.query('status') || 'unread'
    const severity = c.req.query('severity')
    const limit = Math.min(parseInt(c.req.query('limit') || '25'), 100)
    let query = `SELECT a.id, a.alert_type, a.severity, a.title, a.message, 
                        a.context_data, a.status, a.created_at,
                        ar.name as rule_name
                 FROM bond_ai_alerts a
                 LEFT JOIN bond_ai_alert_rules ar ON ar.id = a.rule_id
                 WHERE a.organization_id = $1`
    const params: any[] = [session.organization_id]
    let paramIdx = 2

    if (status !== 'all') {
      query += ` AND a.status = $${paramIdx++}`
      params.push(status)
    }

    if (severity) {
      query += ` AND a.severity = $${paramIdx++}`
      params.push(severity)
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIdx}`
    params.push(limit)

    const result = await db.query(query, params)

    // Get unread count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM bond_ai_alerts
       WHERE organization_id = $1 AND status = 'unread'`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      alerts: result.rows,
      unread_count: parseInt(countResult.rows[0]?.count || '0'),
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to get alerts' }, 500)
  } finally {
    await db.end()
  }
})

// Acknowledge/dismiss alert
bondAiRoutes.patch('/alerts/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const alertId = c.req.param('id')
    const parsed = await validateBody(c, UpdateInsightSchema)
    if (!parsed.success) return parsed.response
    const { status } = parsed.data

    await db.query(
      `UPDATE bond_ai_alerts SET status = $1, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id = $3 AND organization_id = $4`,
      [status, session.user_id, alertId, session.organization_id]
    )

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to update alert' }, 500)
  } finally {
    await db.end()
  }
})

// Bulk acknowledge alerts
bondAiRoutes.post('/alerts/bulk-action', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const parsed = await validateBody(c, BulkInsightSchema)
    if (!parsed.success) return parsed.response
    const { alert_ids, action } = parsed.data

    // Build parameterized IN clause
    const placeholders = alert_ids.map((_, i) => `$${i + 3}`).join(',')
    await db.query(
      `UPDATE bond_ai_alerts SET status = $1, acknowledged_by = $2, acknowledged_at = NOW()
       WHERE id IN (${placeholders}) AND organization_id = $${alert_ids.length + 3}`,
      [action, session.user_id, ...alert_ids, session.organization_id]
    )

    return c.json({ success: true, updated: alert_ids.length })
  } catch (err: any) {
    return c.json({ error: 'Failed to bulk update alerts' }, 500)
  } finally {
    await db.end()
  }
})

// CRUD for alert rules (admin/manager only)
bondAiRoutes.get('/alert-rules', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const result = await db.query(
      `SELECT id, name, description, rule_type, rule_config, severity,
              notification_channels, is_enabled, cooldown_minutes,
              last_triggered_at, created_at
       FROM bond_ai_alert_rules
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, rules: result.rows })
  } catch (err: any) {
    return c.json({ error: 'Failed to get alert rules' }, 500)
  } finally {
    await db.end()
  }
})

bondAiRoutes.post('/alert-rules', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    // Require manager+ role
    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required' }, 403)
    }

    const parsed = await validateBody(c, CreateAlertRuleSchema)
    if (!parsed.success) return parsed.response
    const {
      name,
      description,
      rule_type,
      rule_config,
      severity,
      notification_channels,
      cooldown_minutes,
    } = parsed.data
    const result = await db.query(
      `INSERT INTO bond_ai_alert_rules 
        (organization_id, name, description, rule_type, rule_config, severity, 
         notification_channels, cooldown_minutes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        session.organization_id,
        name,
        description || null,
        rule_type,
        JSON.stringify(rule_config || {}),
        severity || 'info',
        JSON.stringify(notification_channels || ['in_app']),
        cooldown_minutes || 60,
        session.user_id,
      ]
    )

    return c.json({ success: true, rule: result.rows[0] }, 201)
  } catch (err: any) {
    return c.json({ error: 'Failed to create alert rule' }, 500)
  } finally {
    await db.end()
  }
})

bondAiRoutes.put('/alert-rules/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 3) {
      return c.json({ error: 'Manager role required' }, 403)
    }

    const ruleId = c.req.param('id')
    const parsed = await validateBody(c, UpdateAlertRuleSchema)
    if (!parsed.success) return parsed.response
    const {
      name,
      description,
      rule_config,
      severity,
      is_enabled,
      notification_channels,
      cooldown_minutes,
    } = parsed.data
    await db.query(
      `UPDATE bond_ai_alert_rules
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           rule_config = COALESCE($3, rule_config),
           severity = COALESCE($4, severity),
           is_enabled = COALESCE($5, is_enabled),
           notification_channels = COALESCE($6, notification_channels),
           cooldown_minutes = COALESCE($7, cooldown_minutes),
           updated_at = NOW()
       WHERE id = $8 AND organization_id = $9`,
      [
        name || null,
        description,
        rule_config ? JSON.stringify(rule_config) : null,
        severity || null,
        is_enabled ?? null,
        notification_channels ? JSON.stringify(notification_channels) : null,
        cooldown_minutes || null,
        ruleId,
        session.organization_id,
      ]
    )

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to update alert rule' }, 500)
  } finally {
    await db.end()
  }
})

bondAiRoutes.delete('/alert-rules/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const roleLevel = { viewer: 1, agent: 2, manager: 3, admin: 4, owner: 5 }
    if ((roleLevel[session.role as keyof typeof roleLevel] || 0) < 4) {
      return c.json({ error: 'Admin role required' }, 403)
    }

    const ruleId = c.req.param('id')

    await db.query(`DELETE FROM bond_ai_alert_rules WHERE id = $1 AND organization_id = $2`, [
      ruleId,
      session.organization_id,
    ])

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Failed to delete alert rule' }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// TIER 3: CALL CO-PILOT
// ════════════════════════════════════════════════════════════

// Real-time co-pilot assistance during a call
bondAiRoutes.post('/copilot', aiLlmRateLimit, async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    if (!c.env.OPENAI_API_KEY) {
      return c.json({ error: 'AI service not configured' }, 503)
    }

    const parsed = await validateBody(c, CopilotSchema)
    if (!parsed.success) return parsed.response
    const { call_id, transcript_segment, agent_question, scorecard_id } = parsed.data

    // Build co-pilot context
    const contextParts: string[] = []

    // If there's a scorecard, include the scoring criteria
    if (scorecard_id) {
      try {
        const sc = await db.query(
          `SELECT name, sections FROM scorecard_templates 
           WHERE id = $1 AND organization_id = $2`,
          [scorecard_id, session.organization_id]
        )
        if (sc.rows[0]) {
          contextParts.push(
            `Active scorecard: ${sc.rows[0].name}\nSections: ${JSON.stringify(sc.rows[0].sections)}`
          )
        }
      } catch {
        /* non-critical */
      }
    }

    if (transcript_segment) {
      contextParts.push(`Recent transcript:\n"${transcript_segment}"`)
    }

    const userMessage = agent_question
      ? `Agent asks: ${agent_question}`
      : `Analyze this transcript segment and provide guidance:\n"${transcript_segment}"`

    const systemPrompt = buildSystemPrompt(session, 'copilot')
    const contextBlock =
      contextParts.length > 0
        ? `\n\n--- Context ---\n${contextParts.join('\n\n')}\n--- End ---`
        : ''

    const aiResponse = await chatCompletion(
      c.env.OPENAI_API_KEY,
      [
        { role: 'system', content: systemPrompt + contextBlock },
        { role: 'user', content: userMessage },
      ],
      'gpt-4o-mini',
      256 // Short responses for real-time use
    )

    // Log co-pilot usage for audit
    await db.query(
      `INSERT INTO ai_agent_audit_log (id, organization_id, action, details, performed_by, created_at)
       VALUES (gen_random_uuid(), $1, 'copilot_assist', $2, $3, NOW())`,
      [
        session.organization_id,
        JSON.stringify({ call_id, model: aiResponse.model, latency_ms: aiResponse.latencyMs }),
        session.user_id,
      ]
    )

    return c.json({
      success: true,
      guidance: aiResponse.content,
      latency_ms: aiResponse.latencyMs,
    })
  } catch (err: any) {
    return c.json({ error: 'Co-pilot failed: ' + (err.message || 'Unknown error') }, 500)
  } finally {
    await db.end()
  }
})

// ════════════════════════════════════════════════════════════
// AI INSIGHTS (cross-tier analytics)
// ════════════════════════════════════════════════════════════

bondAiRoutes.get('/insights', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const [stats, alerts, kpis] = await Promise.all([
      fetchOrgStats(c.env, session.organization_id),
      fetchRecentAlerts(c.env, session.organization_id, 5),
      fetchKpiSummary(c.env, session.organization_id),
    ])

    // KPI breach detection
    const kpiBreaches = kpis.filter(
      (k: any) =>
        k.latest_value !== null &&
        k.warning_threshold !== null &&
        parseFloat(k.latest_value) < parseFloat(k.warning_threshold)
    )

    return c.json({
      success: true,
      insights: {
        summary: stats,
        recent_alerts: alerts,
        kpi_status: {
          total: kpis.length,
          breached: kpiBreaches.length,
          breaches: kpiBreaches,
        },
      },
    })
  } catch (err: any) {
    return c.json({ error: 'Failed to get insights' }, 500)
  } finally {
    await db.end()
  }
})
