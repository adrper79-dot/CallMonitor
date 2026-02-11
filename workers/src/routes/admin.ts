/**
 * Admin Routes - Auth provider diagnostics and management
 *
 * Endpoints:
 *   GET  /auth-providers  - List auth providers & status
 *   POST /auth-providers  - Toggle / update an auth provider
 *
 * P2-2: Uses centralized getDb() — no inline neon imports
 * H1: Zod-validated request bodies via validateBody()
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { UpdateAuthProviderSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { adminRateLimit } from '../lib/rate-limit'

export const adminRoutes = new Hono<AppEnv>()

/** Roles at admin level or above in the RBAC hierarchy */
const ADMIN_ROLES = ['admin', 'owner']

// GET /auth-providers — List auth providers & diagnostic info
adminRoutes.get('/auth-providers', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT id, provider, enabled, client_id, config, created_at, updated_at
       FROM auth_providers
       WHERE organization_id = $1
       ORDER BY provider ASC`,
      [session.organization_id]
    )

    // Default provider list with status
    const defaults = ['credentials', 'google', 'github', 'microsoft', 'saml']
    const providerMap = new Map(result.rows.map((p: any) => [p.provider, p]))

    const providers = defaults.map((name) => {
      const existing = providerMap.get(name)
      return {
        provider: name,
        enabled: existing?.enabled ?? name === 'credentials',
        configured: !!existing,
        client_id: existing?.client_id ? '***' + existing.client_id.slice(-4) : null,
        updated_at: existing?.updated_at || null,
      }
    })

    return c.json({ success: true, providers })
  } catch (err: any) {
    logger.error('GET /api/_admin/auth-providers error', { error: err?.message })
    return c.json({ error: 'Failed to fetch auth providers' }, 500)
  } finally {
    await db.end()
  }
})

// POST /auth-providers — Toggle / update a provider
adminRoutes.post('/auth-providers', adminRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)

  const db = getDb(c.env)
  try {
    const parsed = await validateBody(c, UpdateAuthProviderSchema)
    if (!parsed.success) return parsed.response
    const { provider, enabled, client_id, client_secret, config } = parsed.data

    // BL-025: Hash client_secret with SHA-256 before storing
    let secretHash: string | null = null
    if (client_secret) {
      const encoder = new TextEncoder()
      const data = encoder.encode(client_secret)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      secretHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }

    // Capture old state for audit trail (BL-SEC-004)
    const oldProviderResult = await db.query(
      `SELECT id, provider, enabled, client_id FROM auth_providers
       WHERE organization_id = $1 AND provider = $2`,
      [session.organization_id, provider]
    )
    const oldProvider = oldProviderResult.rows[0] || null

    const result = await db.query(
      `INSERT INTO auth_providers (organization_id, provider, enabled, client_id, client_secret_hash, config)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (organization_id, provider) DO UPDATE SET
         enabled = COALESCE($3, auth_providers.enabled),
         client_id = COALESCE($4, auth_providers.client_id),
         client_secret_hash = CASE WHEN $5 IS NOT NULL THEN $5 ELSE auth_providers.client_secret_hash END,
         config = COALESCE($6::jsonb, auth_providers.config),
         updated_at = NOW()
       RETURNING id, provider, enabled, client_id, updated_at`,
      [
        session.organization_id,
        provider,
        enabled ?? false,
        client_id || null,
        secretHash,
        JSON.stringify(config || {}),
      ]
    )

    const row = result.rows[0]

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'auth_providers',
      resourceId: row.id,
      action: AuditAction.AUTH_PROVIDER_UPDATED,
      oldValue: oldProvider ? { provider: oldProvider.provider, enabled: oldProvider.enabled, client_id: oldProvider.client_id ? '***' + oldProvider.client_id.slice(-4) : null } : null,
      newValue: { provider: row.provider, enabled: row.enabled },
    })

    return c.json({
      success: true,
      provider: {
        ...row,
        client_id: row.client_id ? '***' + row.client_id.slice(-4) : null,
      },
    })
  } catch (err: any) {
    logger.error('POST /api/_admin/auth-providers error', { error: err?.message })
    return c.json({ error: 'Failed to update auth provider' }, 500)
  } finally {
    await db.end()
  }
})

// Catch-all route for admin endpoints — require authentication
adminRoutes.all('*', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  if (!ADMIN_ROLES.includes(session.role)) return c.json({ error: 'Admin access required' }, 403)
  return c.json({ error: 'Endpoint not found' }, 404)
})


