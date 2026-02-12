/**
 * Productivity Routes — Note Templates, Objection Rebuttals, Daily Planner, Likelihood Scoring
 *
 * Endpoints:
 *   GET    /note-templates              - List note templates
 *   POST   /note-templates              - Create note template
 *   PUT    /note-templates/:id          - Update note template
 *   DELETE /note-templates/:id          - Delete note template
 *
 *   GET    /objection-rebuttals              - List objection rebuttals
 *   POST   /objection-rebuttals              - Create objection rebuttal
 *   PUT    /objection-rebuttals/:id          - Update objection rebuttal
 *   DELETE /objection-rebuttals/:id          - Delete objection rebuttal
 *
 *   GET    /daily-planner               - Cross-campaign daily planner
 *   GET    /likelihood/:accountId       - Get/compute likelihood score
 *   POST   /likelihood/batch            - Batch compute likelihood scores
 *
 * @see ARCH_DOCS/01-CORE/COMPREHENSIVE_ARCHITECTURE_WITH_VISUALS.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { collectionsRateLimit } from '../lib/rate-limit'
import { computeLikelihoodScore } from '../lib/likelihood-scorer'
import { validateBody } from '../lib/validate'
import {
  CreateNoteTemplateSchema,
  UpdateNoteTemplateSchema,
  CreateObjectionRebuttalSchema,
  UpdateObjectionRebuttalSchema,
} from '../lib/schemas'

export const productivityRoutes = new Hono<AppEnv>()

// ═══════════════════════════════════════════════════════════
// NOTE TEMPLATES
// ═══════════════════════════════════════════════════════════

productivityRoutes.get('/note-templates', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT id, shortcode, title, content, tags, usage_count, created_at, updated_at
       FROM note_templates
       WHERE organization_id = $1 AND is_active = true
       ORDER BY usage_count DESC, shortcode ASC`,
      [session.organization_id]
    )

    return c.json({ success: true, templates: result.rows })
  } catch (err: any) {
    logger.error('GET /api/productivity/note-templates error', { error: err?.message })
    return c.json({ error: 'Failed to get note templates' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.post('/note-templates', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, CreateNoteTemplateSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    // Validate shortcode format: lowercase, no spaces, starts with /
    const shortcode = body.shortcode.startsWith('/') ? body.shortcode : `/${body.shortcode}`
    if (!/^\/[a-z0-9_-]+$/.test(shortcode)) {
      return c.json({ error: 'Shortcode must be lowercase alphanumeric with / prefix (e.g., /vm)' }, 400)
    }

    const result = await db.query(
      `INSERT INTO note_templates (organization_id, shortcode, title, content, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, shortcode, title, content, tags, created_at`,
      [
        session.organization_id,
        shortcode,
        body.title,
        body.content,
        body.tags ? JSON.stringify(body.tags) : '[]',
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'note_templates',
      resourceId: result.rows[0].id,
      action: AuditAction.NOTE_TEMPLATE_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, template: result.rows[0] }, 201)
  } catch (err: any) {
    if (err?.message?.includes('idx_note_templates_org_shortcode')) {
      return c.json({ error: 'A template with this shortcode already exists' }, 409)
    }
    logger.error('POST /api/productivity/note-templates error', { error: err?.message })
    return c.json({ error: 'Failed to create note template' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.put('/note-templates/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const id = c.req.param('id')
    const parsed = await validateBody(c, UpdateNoteTemplateSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    // Capture old value for audit
    const existing = await db.query(
      `SELECT id, shortcode, title, content, tags FROM note_templates
       WHERE id = $1 AND organization_id = $2 AND is_active = true`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) return c.json({ error: 'Template not found' }, 404)

    const result = await db.query(
      `UPDATE note_templates
       SET shortcode = COALESCE($1, shortcode),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           tags = COALESCE($4, tags),
           updated_at = NOW()
       WHERE id = $5 AND organization_id = $6 AND is_active = true
       RETURNING id, shortcode, title, content, tags, updated_at`,
      [
        body.shortcode !== undefined ? body.shortcode : null,
        body.title !== undefined ? body.title : null,
        body.content !== undefined ? body.content : null,
        body.tags ? JSON.stringify(body.tags) : null,
        id,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) return c.json({ error: 'Template not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'note_templates',
      resourceId: id,
      action: AuditAction.NOTE_TEMPLATE_UPDATED,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    })

    return c.json({ success: true, template: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/productivity/note-templates/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update note template' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.delete('/note-templates/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const id = c.req.param('id')
    const result = await db.query(
      `UPDATE note_templates SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_active = true
       RETURNING id`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Template not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'note_templates',
      resourceId: id,
      action: AuditAction.NOTE_TEMPLATE_DELETED,
      oldValue: { id },
      newValue: null,
    })

    return c.json({ success: true, message: 'Template deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/productivity/note-templates/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete note template' }, 500)
  } finally {
    await db.end()
  }
})

// Expand shortcode — used by frontend to quickly expand /vm → full text
productivityRoutes.post('/note-templates/expand/:shortcode', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const shortcode = '/' + c.req.param('shortcode')
    const result = await db.query(
      `UPDATE note_templates SET usage_count = usage_count + 1
       WHERE organization_id = $1 AND shortcode = $2 AND is_active = true
       RETURNING content, tags`,
      [session.organization_id, shortcode]
    )

    if (result.rows.length === 0) return c.json({ error: 'Template not found' }, 404)

    return c.json({ success: true, content: result.rows[0].content, tags: result.rows[0].tags })
  } catch (err: any) {
    logger.error('GET /api/productivity/note-templates/expand error', { error: err?.message })
    return c.json({ error: 'Failed to expand template' }, 500)
  } finally {
    await db.end()
  }
})

// ═══════════════════════════════════════════════════════════
// OBJECTION REBUTTALS
// ═══════════════════════════════════════════════════════════

productivityRoutes.get('/objection-rebuttals', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const category = c.req.query('category')
    const search = c.req.query('search')

    let query = `SELECT id, category, objection_text, rebuttal_text, compliance_note,
                        usage_count, effectiveness, created_at
                 FROM objection_rebuttals
                 WHERE organization_id = $1 AND is_active = true`
    const params: any[] = [session.organization_id]
    let idx = 2

    if (category) {
      query += ` AND category = $${idx}`
      params.push(category)
      idx++
    }

    if (search) {
      query += ` AND (objection_text ILIKE $${idx} OR rebuttal_text ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }

    query += ` ORDER BY usage_count DESC, effectiveness DESC NULLS LAST`

    const result = await db.query(query, params)

    // If org has no custom rebuttals, return system defaults
    if (result.rows.length === 0 && !search) {
      return c.json({ success: true, rebuttals: getDefaultRebuttals(), isDefaults: true })
    }

    return c.json({ success: true, rebuttals: result.rows, isDefaults: false })
  } catch (err: any) {
    logger.error('GET /api/productivity/objection-rebuttals error', { error: err?.message })
    return c.json({ error: 'Failed to get objection rebuttals' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.post('/objection-rebuttals', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, CreateObjectionRebuttalSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const result = await db.query(
      `INSERT INTO objection_rebuttals
        (organization_id, category, objection_text, rebuttal_text, compliance_note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category, objection_text, rebuttal_text, compliance_note, created_at`,
      [
        session.organization_id,
        body.category || 'general',
        body.objection_text,
        body.rebuttal_text,
        body.compliance_note || null,
        session.user_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'objection_rebuttals',
      resourceId: result.rows[0].id,
      action: AuditAction.OBJECTION_REBUTTAL_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    })

    return c.json({ success: true, rebuttal: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/productivity/objection-rebuttals error', { error: err?.message })
    return c.json({ error: 'Failed to create objection rebuttal' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.put('/objection-rebuttals/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const id = c.req.param('id')
    const parsed = await validateBody(c, UpdateObjectionRebuttalSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    // Capture old value for audit
    const existing = await db.query(
      `SELECT id, category, objection_text, rebuttal_text, compliance_note FROM objection_rebuttals
       WHERE id = $1 AND organization_id = $2 AND is_active = true`,
      [id, session.organization_id]
    )
    if (existing.rows.length === 0) return c.json({ error: 'Rebuttal not found' }, 404)

    const result = await db.query(
      `UPDATE objection_rebuttals
       SET category = COALESCE($1, category),
           objection_text = COALESCE($2, objection_text),
           rebuttal_text = COALESCE($3, rebuttal_text),
           compliance_note = COALESCE($4, compliance_note),
           updated_at = NOW()
       WHERE id = $5 AND organization_id = $6 AND is_active = true
       RETURNING id, category, objection_text, rebuttal_text, compliance_note, updated_at`,
      [
        body.category !== undefined ? body.category : null,
        body.objection_text !== undefined ? body.objection_text : null,
        body.rebuttal_text !== undefined ? body.rebuttal_text : null,
        body.compliance_note !== undefined ? body.compliance_note : null,
        id,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) return c.json({ error: 'Rebuttal not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'objection_rebuttals',
      resourceId: id,
      action: AuditAction.OBJECTION_REBUTTAL_UPDATED,
      oldValue: existing.rows[0],
      newValue: result.rows[0],
    })

    return c.json({ success: true, rebuttal: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/productivity/objection-rebuttals/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update objection rebuttal' }, 500)
  } finally {
    await db.end()
  }
})

productivityRoutes.delete('/objection-rebuttals/:id', collectionsRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const id = c.req.param('id')
    const result = await db.query(
      `UPDATE objection_rebuttals SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_active = true
       RETURNING id`,
      [id, session.organization_id]
    )

    if (result.rows.length === 0) return c.json({ error: 'Rebuttal not found' }, 404)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'objection_rebuttals',
      resourceId: id,
      action: AuditAction.OBJECTION_REBUTTAL_DELETED,
      oldValue: { id },
      newValue: null,
    })

    return c.json({ success: true, message: 'Rebuttal deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/productivity/objection-rebuttals/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete objection rebuttal' }, 500)
  } finally {
    await db.end()
  }
})

// Track usage when agent views a rebuttal during a call
productivityRoutes.post('/objection-rebuttals/:id/use', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const id = c.req.param('id')
    await db.query(
      `UPDATE objection_rebuttals SET usage_count = usage_count + 1
       WHERE id = $1 AND organization_id = $2`,
      [id, session.organization_id]
    )
    return c.json({ success: true })
  } catch (err: any) {
    logger.error('POST /api/productivity/objection-rebuttals/:id/use error', { error: err?.message })
    return c.json({ error: 'Failed to track usage' }, 500)
  } finally {
    await db.end()
  }
})

// ═══════════════════════════════════════════════════════════
// DAILY PLANNER — Cross-Campaign Unified View
// ═══════════════════════════════════════════════════════════

productivityRoutes.get('/daily-planner', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    // 1. Due tasks (callbacks, follow-ups, promise follow-ups)
    const dueTasks = await db.query(
      `SELECT ct.id, ct.account_id, ct.type, ct.title, ct.notes, ct.due_date, ct.status,
              ca.name AS account_name, ca.primary_phone, ca.balance_due, ca.likelihood_score
       FROM collection_tasks ct
       JOIN collection_accounts ca ON ct.account_id = ca.id
       WHERE ct.organization_id = $1
         AND ct.status IN ('pending', 'in_progress')
         AND (ct.due_date IS NULL OR ct.due_date <= NOW() + INTERVAL '1 day')
         AND ca.is_deleted = false
       ORDER BY
         CASE ct.type
           WHEN 'promise' THEN 1
           WHEN 'payment' THEN 2
           WHEN 'followup' THEN 3
           WHEN 'escalation' THEN 4
           ELSE 5
         END,
         ct.due_date ASC NULLS LAST
       LIMIT 50`,
      [session.organization_id]
    )

    // 2. Past-due promises (accounts with promise_date in the past and balance > 0)
    const pastDuePromises = await db.query(
      `SELECT id, name, primary_phone, balance_due, promise_date, promise_amount, likelihood_score
       FROM collection_accounts
       WHERE organization_id = $1
         AND is_deleted = false
         AND promise_date IS NOT NULL
         AND promise_date < CURRENT_DATE
         AND balance_due > 0
         AND status IN ('active', 'partial')
       ORDER BY promise_date ASC
       LIMIT 20`,
      [session.organization_id]
    )

    // 3. High-priority accounts (high balance, recently contacted, or high likelihood)
    const priorityAccounts = await db.query(
      `SELECT id, name, primary_phone, balance_due, status, last_contacted_at, likelihood_score
       FROM collection_accounts
       WHERE organization_id = $1
         AND is_deleted = false
         AND status IN ('active', 'partial')
         AND balance_due > 0
       ORDER BY
         COALESCE(likelihood_score, 0) DESC,
         balance_due DESC
       LIMIT 15`,
      [session.organization_id]
    )

    // 4. Active campaign stats
    const campaignStats = await db.query(
      `SELECT dc.id, dc.name, dc.status,
              COUNT(cc.id)::int AS total_targets,
              COUNT(cc.id) FILTER (WHERE cc.status = 'completed')::int AS completed_targets,
              COUNT(cc.id) FILTER (WHERE cc.status = 'pending')::int AS pending_targets
       FROM dialer_campaigns dc
       LEFT JOIN campaign_calls cc ON dc.id = cc.campaign_id
       WHERE dc.organization_id = $1
         AND dc.status IN ('active', 'paused')
       GROUP BY dc.id, dc.name, dc.status
       ORDER BY dc.created_at DESC
       LIMIT 5`,
      [session.organization_id]
    )

    // 5. Today's summary stats
    const todayStats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS calls_today,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE AND status = 'completed')::int AS completed_today,
         COALESCE(SUM(duration) FILTER (WHERE created_at >= CURRENT_DATE), 0)::int AS talk_time_today
       FROM calls
       WHERE organization_id = $1`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      planner: {
        due_tasks: dueTasks.rows,
        past_due_promises: pastDuePromises.rows,
        priority_accounts: priorityAccounts.rows,
        campaign_stats: campaignStats.rows,
        today_stats: todayStats.rows[0] || { calls_today: 0, completed_today: 0, talk_time_today: 0 },
      },
    })
  } catch (err: any) {
    logger.error('GET /api/productivity/daily-planner error', { error: err?.message })
    return c.json({ error: 'Failed to get daily planner' }, 500)
  } finally {
    await db.end()
  }
})

// ═══════════════════════════════════════════════════════════
// LIKELIHOOD SCORING
// ═══════════════════════════════════════════════════════════

productivityRoutes.get('/likelihood/:accountId', collectionsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env)
  try {
    const accountId = c.req.param('accountId')
    const result = await computeLikelihoodScore(db, session.organization_id, accountId)

    return c.json({ success: true, likelihood: result })
  } catch (err: any) {
    logger.error('GET /api/productivity/likelihood/:accountId error', { error: err?.message })
    return c.json({ error: 'Failed to compute likelihood score' }, 500)
  } finally {
    await db.end()
  }
})

// ═══════════════════════════════════════════════════════════
// SYSTEM DEFAULTS
// ═══════════════════════════════════════════════════════════

function getDefaultRebuttals() {
  return [
    {
      id: 'default-1',
      category: 'financial',
      objection_text: "I can't afford to pay",
      rebuttal_text: "I understand this is a difficult situation. Let's look at what options might work for your budget. Even a small regular payment can help resolve this. What amount would be manageable for you?",
      compliance_note: 'Do not pressure. Must accept if debtor states inability to pay.',
    },
    {
      id: 'default-2',
      category: 'financial',
      objection_text: "I don't have the money right now",
      rebuttal_text: "I understand. When do you expect to be in a better position? We can set up a payment arrangement that starts on a date that works for you.",
      compliance_note: null,
    },
    {
      id: 'default-3',
      category: 'legal',
      objection_text: "I'm going to talk to my lawyer",
      rebuttal_text: "That's absolutely your right. Would you like to provide your attorney's contact information? We can communicate with them directly if you prefer.",
      compliance_note: 'If debtor requests attorney communication, ALL contact must go through attorney per FDCPA §809.',
    },
    {
      id: 'default-4',
      category: 'legal',
      objection_text: "I don't owe this debt / This isn't mine",
      rebuttal_text: "I understand your concern. You have the right to dispute this debt in writing within 30 days and we'll provide verification. Would you like me to explain that process?",
      compliance_note: 'Must provide debt validation notice per FDCPA §809(a). Do not continue collection if disputed until validated.',
    },
    {
      id: 'default-5',
      category: 'emotional',
      objection_text: "Stop calling me / Leave me alone",
      rebuttal_text: "I apologize for the inconvenience. You have the right to request that we stop contacting you. If you'd like, I can note your preference. However, I want you to know that resolving this could prevent further actions on the account.",
      compliance_note: 'Must honor cease-and-desist per FDCPA §805(c). Document the request immediately.',
    },
    {
      id: 'default-6',
      category: 'stalling',
      objection_text: "I'll pay next month / Call me later",
      rebuttal_text: "I appreciate your willingness to resolve this. To make sure we follow up at the right time, can we set a specific date? That way I can note it on your account and we won't need to call before then.",
      compliance_note: null,
    },
    {
      id: 'default-7',
      category: 'stalling',
      objection_text: "I already paid this",
      rebuttal_text: "Thank you for letting me know. Can you share the payment date, amount, or confirmation number? I'll verify it right away on our end so we can get this resolved.",
      compliance_note: null,
    },
    {
      id: 'default-8',
      category: 'general',
      objection_text: "I want to settle for less",
      rebuttal_text: "I understand you'd like to explore settlement options. Let me check what arrangements might be available on this account. What amount were you thinking?",
      compliance_note: 'Settlement authority varies by client. Check org policy before making offers.',
    },
  ]
}
