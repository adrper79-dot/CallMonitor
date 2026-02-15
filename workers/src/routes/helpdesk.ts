/**
 * Helpdesk Integration Routes — Zendesk & Freshdesk
 *
 * Auto-create support tickets from calls with recording + evidence links.
 * Both providers use API key auth (no OAuth needed).
 *
 * Endpoints:
 *   GET    /status              - Check helpdesk connection status for org
 *   POST   /connect             - Configure helpdesk connection
 *   POST   /disconnect          - Remove helpdesk connection
 *   POST   /tickets             - Create ticket from call data
 *   GET    /tickets             - List tickets created through WIB
 *   POST   /tickets/auto-create - Configure auto-ticket rules
 *   GET    /tickets/auto-create - Get auto-ticket configuration
 *
 * @module helpdesk
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { crmRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { z } from 'zod'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

/** Schema for Zendesk connection config */
const ZendeskConfigSchema = z.object({
  subdomain: z.string().min(1).max(100),
  api_key: z.string().min(1).max(500),
  email: z.string().email(),
})

/** Schema for Freshdesk connection config */
const FreshdeskConfigSchema = z.object({
  domain: z.string().min(1).max(100),
  api_key: z.string().min(1).max(500),
})

/** Schema for connecting a helpdesk provider */
const ConnectHelpdeskSchema = z.object({
  provider: z.enum(['zendesk', 'freshdesk']),
  config: z.union([ZendeskConfigSchema, FreshdeskConfigSchema]),
})

/** Schema for creating a ticket from a call */
const CreateTicketSchema = z.object({
  call_id: z.string().uuid(),
  subject: z.string().max(300).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

/** Schema for auto-create ticket configuration */
const AutoCreateConfigSchema = z.object({
  enabled: z.boolean(),
  conditions: z.object({
    on_missed_call: z.boolean().optional(),
    on_negative_sentiment: z.boolean().optional(),
    on_compliance_violation: z.boolean().optional(),
    sentiment_threshold: z.number().min(-1).max(1).optional(),
  }),
})

// ─── Priority Mapping ───────────────────────────────────────────────────────

/** Map WIB priority strings to Freshdesk numeric priorities */
const FRESHDESK_PRIORITY_MAP: Record<string, 1 | 2 | 3 | 4> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
}

// ─── Exported Helpers ───────────────────────────────────────────────────────

/**
 * Create a ticket in Zendesk via REST API.
 * Uses Basic auth with `{email}/token:{api_key}` base64 encoded.
 *
 * @param config - Zendesk connection credentials
 * @param data   - Ticket payload
 * @returns Created ticket id and URL
 */
export async function createZendeskTicket(
  config: { subdomain: string; apiKey: string; email: string },
  data: {
    subject: string
    description: string
    priority: string
    tags: string[]
    custom_fields?: Array<{ id: number; value: string }>
    external_id?: string
  }
): Promise<{ id: number; url: string }> {
  const credentials = btoa(`${config.email}/token:${config.apiKey}`)

  const response = await fetch(
    `https://${config.subdomain}.zendesk.com/api/v2/tickets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        ticket: {
          subject: data.subject,
          description: data.description,
          priority: data.priority,
          tags: data.tags,
          custom_fields: data.custom_fields,
          external_id: data.external_id,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown')
    throw new Error(`Zendesk API error ${response.status}: ${errorText}`)
  }

  const result = (await response.json()) as { ticket: { id: number; url: string } }
  return {
    id: result.ticket.id,
    url: `https://${config.subdomain}.zendesk.com/agent/tickets/${result.ticket.id}`,
  }
}

/**
 * Create a ticket in Freshdesk via REST API.
 * Uses Basic auth with `{api_key}:X` base64 encoded.
 *
 * @param config - Freshdesk connection credentials
 * @param data   - Ticket payload
 * @returns Created ticket id and URL
 */
export async function createFreshdeskTicket(
  config: { domain: string; apiKey: string },
  data: {
    subject: string
    description: string
    priority: 1 | 2 | 3 | 4
    tags: string[]
    email?: string
    custom_fields?: Record<string, any>
  }
): Promise<{ id: number; url: string }> {
  const credentials = btoa(`${config.apiKey}:X`)

  const response = await fetch(
    `https://${config.domain}.freshdesk.com/api/v2/tickets`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        tags: data.tags,
        email: data.email,
        custom_fields: data.custom_fields,
        status: 2, // Open
        source: 7, // Chat (closest to "API/phone")
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown')
    throw new Error(`Freshdesk API error ${response.status}: ${errorText}`)
  }

  const result = (await response.json()) as { id: number }
  return {
    id: result.id,
    url: `https://${config.domain}.freshdesk.com/a/tickets/${result.id}`,
  }
}

/**
 * Build a helpdesk ticket subject + description from call data.
 *
 * @param call       - Call record from DB
 * @param recording  - Optional recording metadata (includes url)
 * @param transcript - Optional call transcript text
 * @returns Ticket fields ready for submission
 */
export function buildTicketFromCall(
  call: any,
  recording?: any,
  transcript?: string
): {
  subject: string
  description: string
  priority: string
  tags: string[]
} {
  const direction = call.direction === 'inbound' ? 'Inbound' : 'Outbound'
  const phone = call.from_number || call.to_number || 'Unknown'
  const duration = call.duration
    ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`
    : 'N/A'

  const subject = `[Word Is Bond] ${direction} Call — ${phone}`

  const lines: string[] = [
    `## Call Details`,
    `- **Direction:** ${direction}`,
    `- **From:** ${call.from_number || 'N/A'}`,
    `- **To:** ${call.to_number || 'N/A'}`,
    `- **Duration:** ${duration}`,
    `- **Status:** ${call.status || 'N/A'}`,
    `- **Date:** ${call.created_at || 'N/A'}`,
    `- **Call ID:** ${call.id}`,
  ]

  if (call.outcome) {
    lines.push(`- **Outcome:** ${call.outcome}`)
  }
  if (call.disposition) {
    lines.push(`- **Disposition:** ${call.disposition}`)
  }

  if (recording?.url) {
    lines.push('', `## Recording`, `[Listen to recording](${recording.url})`)
  }

  if (transcript) {
    const trimmed = transcript.length > 2000 ? transcript.slice(0, 2000) + '…' : transcript
    lines.push('', `## Transcript`, trimmed)
  }

  if (call.notes) {
    lines.push('', `## Agent Notes`, call.notes)
  }

  const tags = ['word-is-bond', direction.toLowerCase()]
  if (call.outcome) tags.push(`outcome:${call.outcome}`)
  if (call.disposition) tags.push(`disposition:${call.disposition}`)

  // Default priority mapping based on call attributes
  let priority = 'normal'
  if (call.status === 'missed' || call.status === 'no-answer') priority = 'high'
  if (call.sentiment_score !== undefined && call.sentiment_score < -0.5) priority = 'high'

  return { subject, description: lines.join('\n'), priority, tags }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const helpdeskRoutes = new Hono<AppEnv>()

/**
 * GET /status — Check helpdesk connection status for the organization.
 * Returns the active helpdesk integration (zendesk or freshdesk) if any.
 */
helpdeskRoutes.get('/status', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT id, provider, status, config, connected_at, updated_at
       FROM integrations
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
       ORDER BY connected_at DESC
       LIMIT 1`,
      [session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ success: true, connected: false, integration: null })
    }

    const integration = result.rows[0]
    // Strip sensitive fields before returning
    const safeConfig = integration.config
      ? { ...integration.config, api_key: undefined }
      : null

    return c.json({
      success: true,
      connected: integration.status === 'active',
      integration: {
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
        config: safeConfig,
        connected_at: integration.connected_at,
        updated_at: integration.updated_at,
      },
    })
  } catch (err: any) {
    logger.error('GET /api/helpdesk/status error', { error: err?.message })
    return c.json({ error: 'Failed to check helpdesk status' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * POST /connect — Configure a new helpdesk connection.
 * Validates API key by making a test request to the provider.
 *
 * Body: { provider: 'zendesk'|'freshdesk', config: { subdomain, api_key, email? } }
 */
helpdeskRoutes.post('/connect', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, ConnectHelpdeskSchema)
    if (!parsed.success) return parsed.response
    const { provider, config } = parsed.data

    // Validate provider-specific config shape
    if (provider === 'zendesk') {
      const zParsed = ZendeskConfigSchema.safeParse(config)
      if (!zParsed.success) {
        return c.json({ error: 'Zendesk config requires subdomain, api_key, and email' }, 400)
      }
    } else {
      const fParsed = FreshdeskConfigSchema.safeParse(config)
      if (!fParsed.success) {
        return c.json({ error: 'Freshdesk config requires domain and api_key' }, 400)
      }
    }

    // Test the connection by hitting the provider's API
    const testOk = await testHelpdeskConnection(provider, config)
    if (!testOk) {
      return c.json({ error: 'Could not connect — check your credentials and subdomain/domain' }, 400)
    }

    // Upsert: disconnect any existing helpdesk integration first
    await db.query(
      `UPDATE integrations
       SET status = 'disconnected', disconnected_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
         AND status = 'active'`,
      [session.organization_id]
    )

    const result = await db.query(
      `INSERT INTO integrations (organization_id, provider, status, config, connected_by, connected_at)
       VALUES ($1, $2, 'active', $3, $4, NOW())
       RETURNING *`,
      [session.organization_id, provider, JSON.stringify(config), session.user_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'helpdesk_integration',
      resourceId: result.rows[0].id,
      action: AuditAction.INTEGRATION_CONNECTED,
      oldValue: null,
      newValue: { provider },
    }).catch(() => {})

    return c.json({
      success: true,
      integration: {
        id: result.rows[0].id,
        provider: result.rows[0].provider,
        status: result.rows[0].status,
        connected_at: result.rows[0].connected_at,
      },
    }, 201)
  } catch (err: any) {
    logger.error('POST /api/helpdesk/connect error', { error: err?.message })
    return c.json({ error: 'Failed to connect helpdesk' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * POST /disconnect — Remove the active helpdesk connection.
 */
helpdeskRoutes.post('/disconnect', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `UPDATE integrations
       SET status = 'disconnected', disconnected_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
         AND status = 'active'
       RETURNING id, provider`,
      [session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'No active helpdesk connection found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'helpdesk_integration',
      resourceId: result.rows[0].id,
      action: AuditAction.INTEGRATION_DISCONNECTED,
      oldValue: { provider: result.rows[0].provider, status: 'active' },
      newValue: { provider: result.rows[0].provider, status: 'disconnected' },
    }).catch(() => {})

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('POST /api/helpdesk/disconnect error', { error: err?.message })
    return c.json({ error: 'Failed to disconnect helpdesk' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * POST /tickets — Create a helpdesk ticket from a call.
 * Fetches call data, recording, and transcript, then creates a ticket
 * in the connected helpdesk provider.
 *
 * Body: { call_id, subject?, priority?, tags? }
 */
helpdeskRoutes.post('/tickets', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateTicketSchema)
    if (!parsed.success) return parsed.response
    const { call_id, subject, priority, tags } = parsed.data

    // 1. Get active helpdesk integration
    const integrationResult = await db.query(
      `SELECT id, provider, config
       FROM integrations
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
         AND status = 'active'
       LIMIT 1`,
      [session.organization_id]
    )
    if (integrationResult.rows.length === 0) {
      return c.json({ error: 'No active helpdesk connection. Connect Zendesk or Freshdesk first.' }, 400)
    }
    const integration = integrationResult.rows[0]
    const providerConfig = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config

    // 2. Fetch call data
    const callResult = await db.query(
      `SELECT * FROM calls WHERE id = $1 AND organization_id = $2`,
      [call_id, session.organization_id]
    )
    if (callResult.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }
    const call = callResult.rows[0]

    // 3. Fetch recording (optional)
    const recResult = await db.query(
      `SELECT id, url, duration, created_at
       FROM recordings
       WHERE call_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [call_id, session.organization_id]
    )
    const recording = recResult.rows[0] || null

    // 4. Fetch transcript (optional)
    const txResult = await db.query(
      `SELECT text FROM transcriptions
       WHERE call_id = $1 AND organization_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [call_id, session.organization_id]
    )
    const transcript = txResult.rows[0]?.text || null

    // 5. Build ticket content
    const ticketData = buildTicketFromCall(call, recording, transcript)
    if (subject) ticketData.subject = subject
    if (priority) ticketData.priority = priority
    if (tags && tags.length > 0) ticketData.tags = [...ticketData.tags, ...tags]

    // 6. Create ticket in the provider
    let ticketResult: { id: number; url: string }

    if (integration.provider === 'zendesk') {
      ticketResult = await createZendeskTicket(
        {
          subdomain: providerConfig.subdomain,
          apiKey: providerConfig.api_key,
          email: providerConfig.email,
        },
        {
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority,
          tags: ticketData.tags,
          external_id: call_id,
        }
      )
    } else {
      ticketResult = await createFreshdeskTicket(
        {
          domain: providerConfig.domain,
          apiKey: providerConfig.api_key,
        },
        {
          subject: ticketData.subject,
          description: ticketData.description,
          priority: FRESHDESK_PRIORITY_MAP[ticketData.priority] || 2,
          tags: ticketData.tags,
        }
      )
    }

    // 7. Log ticket creation in DB
    const logResult = await db.query(
      `INSERT INTO helpdesk_tickets (organization_id, integration_id, call_id, provider, ticket_id, ticket_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        session.organization_id,
        integration.id,
        call_id,
        integration.provider,
        String(ticketResult.id),
        ticketResult.url,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'helpdesk_ticket',
      resourceId: logResult.rows[0].id,
      action: AuditAction.ZENDESK_TICKET_CREATED,
      oldValue: null,
      newValue: {
        provider: integration.provider,
        ticket_id: ticketResult.id,
        call_id,
      },
    }).catch(() => {})

    return c.json({
      success: true,
      ticket: {
        id: logResult.rows[0].id,
        provider: integration.provider,
        ticket_id: ticketResult.id,
        ticket_url: ticketResult.url,
        call_id,
      },
    }, 201)
  } catch (err: any) {
    logger.error('POST /api/helpdesk/tickets error', { error: err?.message })
    return c.json({ error: 'Failed to create helpdesk ticket' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * GET /tickets — List helpdesk tickets created through Word Is Bond.
 * Supports pagination via ?limit and ?offset query params.
 */
helpdeskRoutes.get('/tickets', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100)
    const offset = parseInt(c.req.query('offset') || '0', 10)

    const result = await db.query(
      `SELECT ht.id, ht.call_id, ht.provider, ht.ticket_id, ht.ticket_url, ht.created_at,
              cl.from_number, cl.to_number, cl.direction, cl.status AS call_status
       FROM helpdesk_tickets ht
       LEFT JOIN calls cl ON cl.id = ht.call_id AND cl.organization_id = ht.organization_id
       WHERE ht.organization_id = $1
       ORDER BY ht.created_at DESC
       LIMIT $2 OFFSET $3`,
      [session.organization_id, limit, offset]
    )

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM helpdesk_tickets WHERE organization_id = $1`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      tickets: result.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset,
    })
  } catch (err: any) {
    logger.error('GET /api/helpdesk/tickets error', { error: err?.message })
    return c.json({ error: 'Failed to list helpdesk tickets' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * POST /tickets/auto-create — Configure auto-ticket creation rules.
 * Stores the config in the integration's JSONB config column under `auto_create`.
 *
 * Body: { enabled, conditions: { on_missed_call?, on_negative_sentiment?, ... } }
 */
helpdeskRoutes.post('/tickets/auto-create', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, AutoCreateConfigSchema)
    if (!parsed.success) return parsed.response
    const autoConfig = parsed.data

    // Must have an active helpdesk integration
    const existing = await db.query(
      `SELECT id, config FROM integrations
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
         AND status = 'active'
       LIMIT 1`,
      [session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'No active helpdesk connection' }, 400)
    }

    const integration = existing.rows[0]
    const currentConfig = typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : (integration.config || {})
    const oldAutoCreate = currentConfig.auto_create || null

    currentConfig.auto_create = autoConfig

    const result = await db.query(
      `UPDATE integrations
       SET config = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING id`,
      [JSON.stringify(currentConfig), integration.id, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'helpdesk_auto_create',
      resourceId: result.rows[0].id,
      action: AuditAction.INTEGRATION_CONNECTED,
      oldValue: oldAutoCreate,
      newValue: autoConfig,
    }).catch(() => {})

    return c.json({ success: true, auto_create: autoConfig })
  } catch (err: any) {
    logger.error('POST /api/helpdesk/tickets/auto-create error', { error: err?.message })
    return c.json({ error: 'Failed to update auto-create config' }, 500)
  } finally {
    await db.end()
  }
})

/**
 * GET /tickets/auto-create — Get the current auto-ticket creation configuration.
 */
helpdeskRoutes.get('/tickets/auto-create', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT config FROM integrations
       WHERE organization_id = $1
         AND provider IN ('zendesk', 'freshdesk')
         AND status = 'active'
       LIMIT 1`,
      [session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({
        success: true,
        auto_create: { enabled: false, conditions: {} },
      })
    }

    const config = typeof result.rows[0].config === 'string'
      ? JSON.parse(result.rows[0].config)
      : (result.rows[0].config || {})

    return c.json({
      success: true,
      auto_create: config.auto_create || { enabled: false, conditions: {} },
    })
  } catch (err: any) {
    logger.error('GET /api/helpdesk/tickets/auto-create error', { error: err?.message })
    return c.json({ error: 'Failed to get auto-create config' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Test the helpdesk provider connection by making a lightweight API call.
 * Zendesk: GET /api/v2/users/me
 * Freshdesk: GET /api/v2/tickets?per_page=1
 *
 * @param provider - 'zendesk' or 'freshdesk'
 * @param config   - Provider credentials
 * @returns true if connection succeeds
 */
async function testHelpdeskConnection(
  provider: string,
  config: Record<string, any>
): Promise<boolean> {
  try {
    if (provider === 'zendesk') {
      const credentials = btoa(`${config.email}/token:${config.api_key}`)
      const res = await fetch(
        `https://${config.subdomain}.zendesk.com/api/v2/users/me.json`,
        { headers: { Authorization: `Basic ${credentials}` } }
      )
      return res.ok
    } else {
      const credentials = btoa(`${config.api_key}:X`)
      const res = await fetch(
        `https://${config.domain}.freshdesk.com/api/v2/tickets?per_page=1`,
        { headers: { Authorization: `Basic ${credentials}` } }
      )
      return res.ok
    }
  } catch (err) {
    logger.error('Helpdesk connection test failed', {
      provider,
      error: (err as Error)?.message,
    })
    return false
  }
}
