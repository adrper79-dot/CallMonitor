import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { crmRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'

const PROVIDER = 'outlook'
const MS_AUTH_BASE = 'https://login.microsoftonline.com'
const DEFAULT_SCOPES = ['offline_access', 'openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'Mail.Send']

const ConnectSchema = z.object({
  state: z.string().max(1024).optional(),
})

const CallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
})

interface OutlookAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  tenantId: string
}

function buildAuthConfig(env: any): OutlookAuthConfig {
  return {
    clientId: env.MICROSOFT_CLIENT_ID || '',
    clientSecret: env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: env.MICROSOFT_REDIRECT_URI || '',
    tenantId: env.MICROSOFT_TENANT_ID || 'common',
  }
}

function getAuthorizeUrl(config: OutlookAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: DEFAULT_SCOPES.join(' '),
    prompt: 'select_account',
  })

  if (state) params.set('state', state)

  return `${MS_AUTH_BASE}/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`
}

async function exchangeCode(config: OutlookAuthConfig, code: string) {
  const tokenUrl = `${MS_AUTH_BASE}/${config.tenantId}/oauth2/v2.0/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      scope: DEFAULT_SCOPES.join(' '),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Microsoft token exchange failed (${response.status}): ${body.slice(0, 300)}`)
  }

  return (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
    token_type?: string
  }
}

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

export const outlookRoutes = new Hono<AppEnv>()

outlookRoutes.get('/status', async (c) => {
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
    logger.error('GET /api/outlook/status error', { error: err?.message })
    return c.json({ error: 'Failed to get Outlook integration status' }, 500)
  } finally {
    await db.end()
  }
})

outlookRoutes.post('/connect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, ConnectSchema)
  if (!parsed.success) return parsed.response

  try {
    const config = buildAuthConfig(c.env)
    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      return c.json({ error: 'Outlook integration not configured' }, 400)
    }

    const authUrl = getAuthorizeUrl(config, parsed.data.state)

    const auditDb = getDb(c.env, session.organization_id)
    writeAuditLog(auditDb, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'outlook',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_INITIATED,
      oldValue: null,
      newValue: { provider: PROVIDER },
    })
      .finally(async () => {
        await auditDb.end()
      })
      .catch(() => {})

    return c.json({ success: true, authUrl })
  } catch (err: any) {
    logger.error('POST /api/outlook/connect error', { error: err?.message })
    return c.json({ error: 'Failed to initiate Outlook OAuth' }, 500)
  }
})

outlookRoutes.post('/callback', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, CallbackSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
  try {
    const config = buildAuthConfig(c.env)
    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      return c.json({ error: 'Outlook integration not configured' }, 400)
    }

    const tokens = await exchangeCode(config, parsed.data.code)
    const now = Date.now()
    const settings = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(now + (tokens.expires_in || 3600) * 1000).toISOString(),
      scope: tokens.scope,
      token_type: tokens.token_type,
    }

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
      resourceType: 'outlook',
      resourceId: integrationId,
      action: AuditAction.CRM_OAUTH_COMPLETED,
      oldValue: existing ? { status: existing.status } : null,
      newValue: { status: 'active', provider: PROVIDER },
    }).catch(() => {})

    return c.json({ success: true, integrationId }, 201)
  } catch (err: any) {
    logger.error('POST /api/outlook/callback error', { error: err?.message })

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'outlook',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_FAILED,
      oldValue: null,
      newValue: { error: err?.message },
    }).catch(() => {})

    return c.json({ error: 'Failed to complete Outlook OAuth' }, 500)
  } finally {
    await db.end()
  }
})

outlookRoutes.post('/disconnect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integration = await getIntegration(db, session.organization_id)
    if (!integration) {
      return c.json({ error: 'No Outlook integration found' }, 404)
    }

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
      resourceType: 'outlook',
      resourceId: integration.id,
      action: AuditAction.INTEGRATION_DISCONNECTED,
      oldValue: { status: integration.status },
      newValue: { status: 'disconnected', provider: PROVIDER },
    }).catch(() => {})

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('POST /api/outlook/disconnect error', { error: err?.message })
    return c.json({ error: 'Failed to disconnect Outlook' }, 500)
  } finally {
    await db.end()
  }
})
