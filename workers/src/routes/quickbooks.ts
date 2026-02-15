/**
 * QuickBooks Integration Routes
 *
 * Endpoints:
 *   GET    /status              - Check QuickBooks connection status
 *   POST   /connect             - Initiate OAuth flow → return redirect URL
 *   POST   /callback            - Exchange auth code for tokens
 *   POST   /disconnect          - Revoke tokens, delete from KV
 *   GET    /customers           - List QuickBooks customers
 *   POST   /invoices/generate   - Generate invoice from call data
 *   GET    /invoices            - List recent invoices
 *   POST   /invoices/sync       - Manual sync trigger
 *
 * Uses the `integrations` table with provider='quickbooks'.
 * RealmId is stored in the config JSONB column.
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { crmRateLimit } from '../lib/rate-limit'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { storeTokens, getTokens, deleteTokens, isTokenExpired } from '../lib/crm-tokens'
import type { OAuthTokens } from '../lib/crm-tokens'
import {
  getQuickBooksAuthUrl,
  exchangeQuickBooksCode,
  refreshQuickBooksToken,
  revokeQuickBooksToken,
  getQuickBooksBaseUrl,
  listQuickBooksCustomers,
  createQuickBooksInvoice,
  listQuickBooksInvoices,
  buildCallInvoiceLineItems,
  QuickBooksError,
} from '../lib/quickbooks-client'
import type { QuickBooksAuthConfig } from '../lib/quickbooks-client'

// ── Routes ──────────────────────────────────────────────────────────────────

export const quickbooksRoutes = new Hono<AppEnv>()

// ── Helpers ─────────────────────────────────────────────────────────────────

const PROVIDER = 'quickbooks'

/**
 * Build QuickBooksAuthConfig from environment variables.
 */
function getAuthConfig(env: Record<string, unknown>): QuickBooksAuthConfig {
  return {
    clientId: (env.QUICKBOOKS_CLIENT_ID as string) || '',
    clientSecret: (env.QUICKBOOKS_CLIENT_SECRET as string) || '',
    redirectUri: (env.QUICKBOOKS_REDIRECT_URI as string) || '',
    environment: ((env.QUICKBOOKS_ENVIRONMENT as string) || 'sandbox') as 'sandbox' | 'production',
  }
}

/**
 * Get a valid access token for the org, refreshing if expired.
 */
async function getValidAccessToken(
  env: Record<string, unknown>,
  orgId: string
): Promise<{ accessToken: string; realmId: string } | null> {
  const tokens = await getTokens(env as any, orgId, PROVIDER)
  if (!tokens) return null

  // Retrieve realmId from KV metadata — stored alongside tokens
  const realmId = await (env as any).KV.get(`crm:meta:${orgId}:${PROVIDER}:realmId`)
  if (!realmId) {
    logger.warn('QuickBooks realmId missing from KV', { orgId })
    return null
  }

  // If token is still valid, return it
  if (!isTokenExpired(tokens)) {
    return { accessToken: tokens.access_token, realmId }
  }

  // Token expired — refresh it
  logger.info('QuickBooks token expired, refreshing', { orgId })
  const config = getAuthConfig(env)
  const newTokens = await refreshQuickBooksToken(config, tokens.refresh_token)

  // Store refreshed tokens
  const oauthTokens: OAuthTokens = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: Date.now() + newTokens.expires_in * 1000,
    token_type: newTokens.token_type,
  }
  await storeTokens(env as any, orgId, PROVIDER, oauthTokens)

  return { accessToken: newTokens.access_token, realmId }
}

// ── GET /status ─────────────────────────────────────────────────────────────

quickbooksRoutes.get('/status', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT id, status, connected_at, config, error_message
       FROM integrations
       WHERE organization_id = $1 AND provider = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.organization_id, PROVIDER]
    )

    if (result.rows.length === 0) {
      return c.json({
        success: true,
        connected: false,
        status: 'not_configured',
      })
    }

    const row = result.rows[0]
    const hasTokens = !!(await getTokens(c.env as any, session.organization_id, PROVIDER))

    return c.json({
      success: true,
      connected: row.status === 'active' && hasTokens,
      status: row.status,
      connectedAt: row.connected_at,
      realmId: row.config?.realmId || null,
      errorMessage: row.error_message || null,
    })
  } catch (err: any) {
    logger.error('GET /api/quickbooks/status error', { error: err?.message })
    return c.json({ error: 'Failed to check QuickBooks status' }, 500)
  } finally {
    await db.end()
  }
})

// ── POST /connect ───────────────────────────────────────────────────────────

quickbooksRoutes.post('/connect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const config = getAuthConfig(c.env as any)
    if (!config.clientId || !config.clientSecret) {
      return c.json({ error: 'QuickBooks integration not configured' }, 400)
    }

    const authUrl = getQuickBooksAuthUrl(config)

    writeAuditLog(getDb(c.env, session.organization_id), {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_INITIATED,
      oldValue: null,
      newValue: { provider: PROVIDER },
    }).catch(() => {})

    logger.info('QuickBooks OAuth flow initiated', {
      orgId: session.organization_id,
    })

    return c.json({ success: true, authUrl })
  } catch (err: any) {
    logger.error('POST /api/quickbooks/connect error', { error: err?.message })
    return c.json({ error: 'Failed to initiate QuickBooks connection' }, 500)
  }
})

// ── POST /callback ──────────────────────────────────────────────────────────

quickbooksRoutes.post('/callback', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json<{ code: string; realmId: string }>()
    if (!body.code || !body.realmId) {
      return c.json({ error: 'Missing code or realmId' }, 400)
    }

    const config = getAuthConfig(c.env as any)
    const tokenResponse = await exchangeQuickBooksCode(config, body.code, body.realmId)

    // Store encrypted tokens in KV
    const oauthTokens: OAuthTokens = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: Date.now() + tokenResponse.expires_in * 1000,
      token_type: tokenResponse.token_type,
    }
    await storeTokens(c.env as any, session.organization_id, PROVIDER, oauthTokens)

    // Store realmId separately in KV for easy retrieval
    await (c.env as any).KV.put(
      `crm:meta:${session.organization_id}:${PROVIDER}:realmId`,
      body.realmId,
      { expirationTtl: 90 * 24 * 60 * 60 }
    )

    // Upsert integration record in DB
    await db.query(
      `INSERT INTO integrations (organization_id, provider, status, connected_at, connected_by, config)
       VALUES ($1, $2, 'active', NOW(), $3, $4)
       ON CONFLICT (organization_id, provider)
       DO UPDATE SET status = 'active', connected_at = NOW(), connected_by = $3,
                     config = $4, error_message = NULL, disconnected_at = NULL, updated_at = NOW()`,
      [
        session.organization_id,
        PROVIDER,
        session.user_id,
        JSON.stringify({ realmId: body.realmId }),
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_COMPLETED,
      oldValue: null,
      newValue: { provider: PROVIDER, realmId: body.realmId },
    }).catch(() => {})

    logger.info('QuickBooks OAuth callback successful', {
      orgId: session.organization_id,
      realmId: body.realmId,
    })

    return c.json({ success: true, realmId: body.realmId }, 201)
  } catch (err: any) {
    const isQbError = err instanceof QuickBooksError

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks',
      resourceId: session.organization_id,
      action: AuditAction.CRM_OAUTH_FAILED,
      oldValue: null,
      newValue: { provider: PROVIDER, error: err?.message },
    }).catch(() => {})

    logger.error('POST /api/quickbooks/callback error', {
      error: err?.message,
      statusCode: isQbError ? err.statusCode : undefined,
    })
    return c.json(
      { error: 'Failed to complete QuickBooks connection' },
      isQbError ? (err.statusCode as any) : 500
    )
  } finally {
    await db.end()
  }
})

// ── POST /disconnect ────────────────────────────────────────────────────────

quickbooksRoutes.post('/disconnect', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    // Attempt to revoke the token before deleting
    const tokens = await getTokens(c.env as any, session.organization_id, PROVIDER)
    if (tokens) {
      const config = getAuthConfig(c.env as any)
      await revokeQuickBooksToken(config, tokens.refresh_token).catch(() => {
        logger.warn('QuickBooks token revocation failed during disconnect', {
          orgId: session.organization_id,
        })
      })
    }

    // Delete encrypted tokens from KV
    await deleteTokens(c.env as any, session.organization_id, PROVIDER)
    // Delete realmId metadata
    await (c.env as any).KV.delete(
      `crm:meta:${session.organization_id}:${PROVIDER}:realmId`
    )

    // Update integration record
    await db.query(
      `UPDATE integrations
       SET status = 'disconnected', disconnected_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1 AND provider = $2`,
      [session.organization_id, PROVIDER]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks',
      resourceId: session.organization_id,
      action: AuditAction.INTEGRATION_DISCONNECTED,
      oldValue: { provider: PROVIDER },
      newValue: null,
    }).catch(() => {})

    logger.info('QuickBooks disconnected', { orgId: session.organization_id })

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('POST /api/quickbooks/disconnect error', { error: err?.message })
    return c.json({ error: 'Failed to disconnect QuickBooks' }, 500)
  } finally {
    await db.end()
  }
})

// ── GET /customers ──────────────────────────────────────────────────────────

quickbooksRoutes.get('/customers', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const tokenInfo = await getValidAccessToken(c.env as any, session.organization_id)
    if (!tokenInfo) {
      return c.json({ error: 'QuickBooks not connected' }, 400)
    }

    const config = getAuthConfig(c.env as any)
    const baseUrl = getQuickBooksBaseUrl(config.environment)
    const customers = await listQuickBooksCustomers(baseUrl, tokenInfo.accessToken, tokenInfo.realmId)

    return c.json({ success: true, customers })
  } catch (err: any) {
    const isQbError = err instanceof QuickBooksError
    logger.error('GET /api/quickbooks/customers error', {
      error: err?.message,
      statusCode: isQbError ? err.statusCode : undefined,
    })
    return c.json(
      { error: 'Failed to fetch QuickBooks customers' },
      isQbError && err.statusCode === 401 ? 401 : 500
    )
  }
})

// ── POST /invoices/generate ─────────────────────────────────────────────────

quickbooksRoutes.post('/invoices/generate', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const body = await c.req.json<{
      customer_id: string
      start_date: string
      end_date: string
      rate_per_minute: number
    }>()

    if (!body.customer_id || !body.start_date || !body.end_date || !body.rate_per_minute) {
      return c.json({ error: 'Missing required fields: customer_id, start_date, end_date, rate_per_minute' }, 400)
    }

    if (body.rate_per_minute <= 0 || body.rate_per_minute > 100) {
      return c.json({ error: 'rate_per_minute must be between 0 and 100' }, 400)
    }

    // Get QuickBooks connection
    const tokenInfo = await getValidAccessToken(c.env as any, session.organization_id)
    if (!tokenInfo) {
      return c.json({ error: 'QuickBooks not connected' }, 400)
    }

    // Fetch matching calls from DB
    const callsResult = await db.query(
      `SELECT id, duration_seconds, caller_id, started_at, disposition
       FROM calls
       WHERE organization_id = $1
         AND started_at >= $2
         AND started_at <= $3
         AND status = 'completed'
         AND duration_seconds > 0
       ORDER BY started_at ASC`,
      [session.organization_id, body.start_date, body.end_date]
    )

    if (callsResult.rows.length === 0) {
      return c.json({ error: 'No completed calls found in the specified date range' }, 404)
    }

    // Build line items from call data
    const lineItems = buildCallInvoiceLineItems(callsResult.rows, body.rate_per_minute)

    // Create invoice in QuickBooks
    const config = getAuthConfig(c.env as any)
    const baseUrl = getQuickBooksBaseUrl(config.environment)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30) // Net 30

    const invoice = await createQuickBooksInvoice(
      baseUrl,
      tokenInfo.accessToken,
      tokenInfo.realmId,
      {
        customerId: body.customer_id,
        lineItems,
        dueDate: dueDate.toISOString().split('T')[0],
        notes: `Call services ${body.start_date} to ${body.end_date} — ${callsResult.rows.length} calls`,
      }
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks_invoice',
      resourceId: invoice.Id,
      action: AuditAction.QUICKBOOKS_INVOICE_CREATED,
      oldValue: null,
      newValue: {
        invoiceId: invoice.Id,
        docNumber: invoice.DocNumber,
        totalAmt: invoice.TotalAmt,
        callCount: callsResult.rows.length,
        dateRange: { start: body.start_date, end: body.end_date },
        ratePerMinute: body.rate_per_minute,
      },
    }).catch(() => {})

    logger.info('QuickBooks invoice generated from calls', {
      orgId: session.organization_id,
      invoiceId: invoice.Id,
      callCount: callsResult.rows.length,
      totalAmt: invoice.TotalAmt,
    })

    return c.json({
      success: true,
      invoice: {
        id: invoice.Id,
        docNumber: invoice.DocNumber,
        totalAmount: invoice.TotalAmt,
        balance: invoice.Balance,
        dueDate: invoice.DueDate,
        callCount: callsResult.rows.length,
      },
    }, 201)
  } catch (err: any) {
    const isQbError = err instanceof QuickBooksError
    logger.error('POST /api/quickbooks/invoices/generate error', {
      error: err?.message,
      statusCode: isQbError ? err.statusCode : undefined,
      intuitTid: isQbError ? err.intuitTid : undefined,
    })
    return c.json(
      { error: 'Failed to generate QuickBooks invoice' },
      isQbError && err.statusCode === 401 ? 401 : 500
    )
  } finally {
    await db.end()
  }
})

// ── GET /invoices ───────────────────────────────────────────────────────────

quickbooksRoutes.get('/invoices', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const tokenInfo = await getValidAccessToken(c.env as any, session.organization_id)
    if (!tokenInfo) {
      return c.json({ error: 'QuickBooks not connected' }, 400)
    }

    const config = getAuthConfig(c.env as any)
    const baseUrl = getQuickBooksBaseUrl(config.environment)

    const customerId = c.req.query('customer_id')
    const startDate = c.req.query('start_date')
    const endDate = c.req.query('end_date')

    const invoices = await listQuickBooksInvoices(
      baseUrl,
      tokenInfo.accessToken,
      tokenInfo.realmId,
      {
        customerId: customerId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }
    )

    return c.json({ success: true, invoices })
  } catch (err: any) {
    const isQbError = err instanceof QuickBooksError
    logger.error('GET /api/quickbooks/invoices error', {
      error: err?.message,
      statusCode: isQbError ? err.statusCode : undefined,
    })
    return c.json(
      { error: 'Failed to fetch QuickBooks invoices' },
      isQbError && err.statusCode === 401 ? 401 : 500
    )
  }
})

// ── POST /invoices/sync ─────────────────────────────────────────────────────

quickbooksRoutes.post('/invoices/sync', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const tokenInfo = await getValidAccessToken(c.env as any, session.organization_id)
    if (!tokenInfo) {
      return c.json({ error: 'QuickBooks not connected' }, 400)
    }

    const config = getAuthConfig(c.env as any)
    const baseUrl = getQuickBooksBaseUrl(config.environment)

    // Fetch all recent invoices from QuickBooks
    const invoices = await listQuickBooksInvoices(
      baseUrl,
      tokenInfo.accessToken,
      tokenInfo.realmId
    )

    // Update integration last sync timestamp
    await db.query(
      `UPDATE integrations
       SET config = config || $3::jsonb, updated_at = NOW()
       WHERE organization_id = $1 AND provider = $2`,
      [
        session.organization_id,
        PROVIDER,
        JSON.stringify({ lastSyncAt: new Date().toISOString(), invoiceCount: invoices.length }),
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'quickbooks',
      resourceId: session.organization_id,
      action: AuditAction.INTEGRATION_SYNC_TRIGGERED,
      oldValue: null,
      newValue: { provider: PROVIDER, invoiceCount: invoices.length },
    }).catch(() => {})

    logger.info('QuickBooks invoice sync completed', {
      orgId: session.organization_id,
      invoiceCount: invoices.length,
    })

    return c.json({
      success: true,
      syncedAt: new Date().toISOString(),
      invoiceCount: invoices.length,
    })
  } catch (err: any) {
    const isQbError = err instanceof QuickBooksError
    logger.error('POST /api/quickbooks/invoices/sync error', {
      error: err?.message,
      statusCode: isQbError ? err.statusCode : undefined,
    })
    return c.json(
      { error: 'Failed to sync QuickBooks invoices' },
      isQbError && err.statusCode === 401 ? 401 : 500
    )
  } finally {
    await db.end()
  }
})
