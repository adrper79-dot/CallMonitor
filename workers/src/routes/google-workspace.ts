/**
 * Google Workspace Integration Routes - Calendar + Contacts
 *
 * Endpoints:
 *   GET    /status           - Connection status
 *   POST   /connect          - Initiate OAuth flow
 *   POST   /callback         - OAuth callback, store tokens
 *   POST   /disconnect       - Revoke tokens, cleanup
 *   GET    /contacts          - List Google contacts
 *   POST   /contacts/sync     - Sync contacts into platform
 *   GET    /calendars         - List available calendars
 *   GET    /events            - List calendar events
 *   POST   /events            - Create calendar event (booking sync)
 *   DELETE /events/:eventId   - Cancel calendar event
 *
 * Stores connection in `integrations` table with provider='google_workspace'.
 *
 * @see workers/src/lib/google-workspace.ts - raw Google API client
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { crmRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { z } from 'zod'
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  revokeGoogleToken,
  listGoogleContacts,
  searchGoogleContacts,
  listCalendars,
  listCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  DEFAULT_GOOGLE_SCOPES,
  type GoogleAuthConfig,
} from '../lib/google-workspace'

// ─── Schemas ────────────────────────────────────────────────────────────────

const CallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
})

const ContactsSyncSchema = z.object({
  pageSize: z.number().int().min(1).max(1000).optional(),
  syncToken: z.string().optional(),
})

const CreateEventSchema = z.object({
  calendarId: z.string().min(1),
  summary: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  start: z.object({
    dateTime: z.string().min(1),
    timeZone: z.string().min(1),
  }),
  end: z.object({
    dateTime: z.string().min(1),
    timeZone: z.string().min(1),
  }),
  attendees: z
    .array(z.object({ email: z.string().email() }))
    .max(50)
    .optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROVIDER = 'google_workspace'

/**
 * Build GoogleAuthConfig from env. Env keys:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 */
function buildAuthConfig(env: any): GoogleAuthConfig {
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    scopes: DEFAULT_GOOGLE_SCOPES,
  }
}

/**
 * Get the active Google Workspace integration for this org.
 * Returns null if not connected.
 */
async function getIntegration(db: any, orgId: string) {
  const result = await db.query(
    `SELECT id, provider, status, settings, connected_at, updated_at
     FROM integrations
     WHERE organization_id = $1 AND provider = $2
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, PROVIDER]
  )
  return result.rows[0] ?? null
}

/**
 * Retrieve a valid access token for the integration.
 * Automatically refreshes if expired.
 */
async function getValidAccessToken(
  db: any,
  orgId: string,
  env: any
): Promise<{ accessToken: string; integrationId: string } | null> {
  const result = await db.query(
    `SELECT id, settings FROM integrations
     WHERE organization_id = $1 AND provider = $2 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, PROVIDER]
  )

  if (result.rows.length === 0) return null
  const integration = result.rows[0]
  const settings = typeof integration.settings === 'string'
    ? JSON.parse(integration.settings)
    : integration.settings

  const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at).getTime() : 0
  const now = Date.now()

  // If token has >60s remaining, reuse it
  if (settings.access_token && expiresAt > now + 60_000) {
    return { accessToken: settings.access_token, integrationId: integration.id }
  }

  // Refresh needed
  if (!settings.refresh_token) {
    logger.warn('[google-workspace] No refresh token available', { orgId })
    return null
  }

  try {
    const config = buildAuthConfig(env)
    const tokens = await refreshGoogleToken(config, settings.refresh_token)

    const updatedSettings = {
      ...settings,
      access_token: tokens.access_token,
      token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    }

    await db.query(
      `UPDATE integrations SET settings = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3`,
      [JSON.stringify(updatedSettings), integration.id, orgId]
    )

    return { accessToken: tokens.access_token, integrationId: integration.id }
  } catch (err: any) {
    logger.error('[google-workspace] Token refresh failed during request', { error: err?.message })
    // Mark integration as errored
    await db.query(
      `UPDATE integrations SET status = 'error', error_message = $1, last_error_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3`,
      [`Token refresh failed: ${err?.message}`, integration.id, orgId]
    ).catch(() => {})
    return null
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const googleWorkspaceRoutes = new Hono<AppEnv>()

// ── GET /status — Connection status ──────────────────────────────────────────

googleWorkspaceRoutes.get('/status', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integration = await getIntegration(db, session.organization_id)

    return c.json({
      success: true,
      connected: integration?.status === 'active',
      integration: integration
        ? {
            id: integration.id,
            status: integration.status,
            connected_at: integration.connected_at,
            updated_at: integration.updated_at,
          }
        : null,
    })
  } catch (err: any) {
    logger.error('GET /api/google-workspace/status error', { error: err?.message })
    return c.json({ error: 'Failed to get integration status' }, 500)
  } finally {
    await db.end()
  }
})

// ── POST /connect — Initiate OAuth flow ──────────────────────────────────────

googleWorkspaceRoutes.post('/connect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const config = buildAuthConfig(c.env)
    const authUrl = getGoogleAuthUrl(config)

    writeAuditLog(getDb(c.env, session.organization_id), {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_workspace',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_INITIATED,
      oldValue: null,
      newValue: { provider: PROVIDER },
    }).catch(() => {})

    return c.json({ success: true, authUrl })
  } catch (err: any) {
    logger.error('POST /api/google-workspace/connect error', { error: err?.message })
    return c.json({ error: 'Failed to initiate Google OAuth' }, 500)
  }
})

// ── POST /callback — OAuth callback, exchange code and store tokens ──────────

googleWorkspaceRoutes.post('/callback', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, CallbackSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const { code } = parsed.data
    const config = buildAuthConfig(c.env)
    const tokens = await exchangeGoogleCode(config, code)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000)

    const settings = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      scope: tokens.scope,
    }

    // Upsert: update existing or create new
    const existing = await getIntegration(db, session.organization_id)

    let integrationId: string
    if (existing) {
      await db.query(
        `UPDATE integrations
         SET settings = $1, status = 'active', error_message = NULL,
             connected_at = NOW(), disconnected_at = NULL, connected_by = $2, updated_at = NOW()
         WHERE id = $3 AND organization_id = $4`,
        [JSON.stringify(settings), session.user_id, existing.id, session.organization_id]
      )
      integrationId = existing.id
    } else {
      const result = await db.query(
        `INSERT INTO integrations (organization_id, provider, settings, status, connected_by, connected_at)
         VALUES ($1, $2, $3, 'active', $4, NOW())
         RETURNING id`,
        [session.organization_id, PROVIDER, JSON.stringify(settings), session.user_id]
      )
      integrationId = result.rows[0].id
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_workspace',
      resourceId: integrationId,
      action: AuditAction.CRM_OAUTH_COMPLETED,
      oldValue: existing ? { status: existing.status } : null,
      newValue: { status: 'active', provider: PROVIDER },
    }).catch(() => {})

    logger.info('[google-workspace] OAuth completed', {
      orgId: session.organization_id,
      integrationId,
    })

    return c.json({ success: true, integrationId }, 201)
  } catch (err: any) {
    logger.error('POST /api/google-workspace/callback error', { error: err?.message })

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_workspace',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_FAILED,
      oldValue: null,
      newValue: { error: err?.message },
    }).catch(() => {})

    return c.json({ error: 'Failed to complete Google OAuth' }, 500)
  } finally {
    await db.end()
  }
})

// ── POST /disconnect — Revoke tokens, cleanup ───────────────────────────────

googleWorkspaceRoutes.post('/disconnect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integration = await getIntegration(db, session.organization_id)
    if (!integration) {
      return c.json({ error: 'No Google Workspace integration found' }, 404)
    }

    // Attempt token revocation (best-effort)
    const settings = typeof integration.settings === 'string'
      ? JSON.parse(integration.settings)
      : integration.settings

    if (settings.access_token) {
      try {
        await revokeGoogleToken(settings.access_token)
      } catch {
        logger.warn('[google-workspace] Token revocation failed (continuing disconnect)')
      }
    }

    // Mark as disconnected, clear sensitive settings
    await db.query(
      `UPDATE integrations
       SET status = 'disconnected', settings = $1,
           disconnected_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND organization_id = $3`,
      [JSON.stringify({}), integration.id, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_workspace',
      resourceId: integration.id,
      action: AuditAction.INTEGRATION_DISCONNECTED,
      oldValue: { status: integration.status },
      newValue: { status: 'disconnected', provider: PROVIDER },
    }).catch(() => {})

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('POST /api/google-workspace/disconnect error', { error: err?.message })
    return c.json({ error: 'Failed to disconnect Google Workspace' }, 500)
  } finally {
    await db.end()
  }
})

// ── GET /contacts — List Google contacts ─────────────────────────────────────

googleWorkspaceRoutes.get('/contacts', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const pageSize = parseInt(c.req.query('pageSize') || '100', 10)
    const pageToken = c.req.query('pageToken') || undefined

    const result = await listGoogleContacts(auth.accessToken, { pageSize, pageToken })

    return c.json({
      success: true,
      contacts: result.connections,
      nextPageToken: result.nextPageToken,
      totalPeople: result.totalPeople,
    })
  } catch (err: any) {
    logger.error('GET /api/google-workspace/contacts error', { error: err?.message })
    return c.json({ error: 'Failed to list Google contacts' }, 500)
  } finally {
    await db.end()
  }
})

// ── POST /contacts/sync — Sync contacts into platform ────────────────────────

googleWorkspaceRoutes.post('/contacts/sync', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, ContactsSyncSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const { pageSize, syncToken } = parsed.data
    const result = await listGoogleContacts(auth.accessToken, { pageSize, syncToken })

    let synced = 0
    let skipped = 0

    for (const contact of result.connections) {
      const name = contact.names?.[0]?.displayName ?? 'Unknown'
      const email = contact.emailAddresses?.[0]?.value ?? null
      const phone = contact.phoneNumbers?.[0]?.value ?? null

      // Skip contacts with no useful info
      if (!email && !phone) {
        skipped++
        continue
      }

      // Upsert into contacts table using google resource name as external_id
      await db.query(
        `INSERT INTO contacts (organization_id, name, email, phone, source, external_id, metadata)
         VALUES ($1, $2, $3, $4, 'google_workspace', $5, $6)
         ON CONFLICT (organization_id, source, external_id) DO UPDATE SET
           name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, contacts.email),
           phone = COALESCE(EXCLUDED.phone, contacts.phone),
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          session.organization_id,
          name,
          email,
          phone,
          contact.resourceName,
          JSON.stringify({
            given_name: contact.names?.[0]?.givenName,
            family_name: contact.names?.[0]?.familyName,
            organization: contact.organizations?.[0]?.name,
            title: contact.organizations?.[0]?.title,
            all_emails: contact.emailAddresses?.map((e) => e.value),
            all_phones: contact.phoneNumbers?.map((p) => p.value),
          }),
        ]
      )
      synced++
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_workspace',
      resourceId: auth.integrationId,
      action: AuditAction.GOOGLE_WORKSPACE_SYNCED,
      oldValue: null,
      newValue: { synced, skipped, total: result.connections.length },
    }).catch(() => {})

    return c.json({
      success: true,
      synced,
      skipped,
      total: result.connections.length,
      nextSyncToken: result.nextSyncToken,
    })
  } catch (err: any) {
    logger.error('POST /api/google-workspace/contacts/sync error', { error: err?.message })
    return c.json({ error: 'Failed to sync Google contacts' }, 500)
  } finally {
    await db.end()
  }
})

// ── GET /calendars — List available calendars ────────────────────────────────

googleWorkspaceRoutes.get('/calendars', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const calendars = await listCalendars(auth.accessToken)

    return c.json({ success: true, calendars })
  } catch (err: any) {
    logger.error('GET /api/google-workspace/calendars error', { error: err?.message })
    return c.json({ error: 'Failed to list calendars' }, 500)
  } finally {
    await db.end()
  }
})

// ── GET /events — List calendar events ───────────────────────────────────────

googleWorkspaceRoutes.get('/events', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const calendarId = c.req.query('calendarId') || 'primary'
    const timeMin = c.req.query('timeMin') || undefined
    const timeMax = c.req.query('timeMax') || undefined
    const maxResults = c.req.query('maxResults') ? parseInt(c.req.query('maxResults')!, 10) : 50
    const pageToken = c.req.query('pageToken') || undefined

    const result = await listCalendarEvents(auth.accessToken, calendarId, {
      timeMin,
      timeMax,
      maxResults,
      pageToken,
      singleEvents: true,
    })

    return c.json({
      success: true,
      events: result.items,
      nextPageToken: result.nextPageToken,
    })
  } catch (err: any) {
    logger.error('GET /api/google-workspace/events error', { error: err?.message })
    return c.json({ error: 'Failed to list calendar events' }, 500)
  } finally {
    await db.end()
  }
})

// ── POST /events — Create calendar event (booking sync) ──────────────────────

googleWorkspaceRoutes.post('/events', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, CreateEventSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const { calendarId, ...eventData } = parsed.data
    const event = await createCalendarEvent(auth.accessToken, calendarId, eventData)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_calendar_event',
      resourceId: event.id,
      action: AuditAction.BOOKING_CREATED,
      oldValue: null,
      newValue: {
        google_event_id: event.id,
        summary: event.summary,
        calendar_id: calendarId,
      },
    }).catch(() => {})

    return c.json({ success: true, event }, 201)
  } catch (err: any) {
    logger.error('POST /api/google-workspace/events error', { error: err?.message })
    return c.json({ error: 'Failed to create calendar event' }, 500)
  } finally {
    await db.end()
  }
})

// ── DELETE /events/:eventId — Cancel calendar event ──────────────────────────

googleWorkspaceRoutes.delete('/events/:eventId', crmRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const auth = await getValidAccessToken(db, session.organization_id, c.env)
    if (!auth) {
      return c.json({ error: 'Google Workspace not connected or token expired' }, 403)
    }

    const eventId = c.req.param('eventId')
    const calendarId = c.req.query('calendarId') || 'primary'

    await deleteCalendarEvent(auth.accessToken, calendarId, eventId)

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'google_calendar_event',
      resourceId: eventId,
      action: AuditAction.BOOKING_DELETED,
      oldValue: { google_event_id: eventId, calendar_id: calendarId },
      newValue: null,
    }).catch(() => {})

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('DELETE /api/google-workspace/events/:eventId error', { error: err?.message })
    return c.json({ error: 'Failed to delete calendar event' }, 500)
  } finally {
    await db.end()
  }
})
