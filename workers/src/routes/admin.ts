/**
 * Admin Routes - Auth provider diagnostics and management
 *
 * Endpoints:
 *   GET  /auth-providers  - List auth providers & status
 *   POST /auth-providers  - Toggle / update an auth provider
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const adminRoutes = new Hono<{ Bindings: Env }>()

async function getSQL(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

async function ensureTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS auth_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      provider TEXT NOT NULL,
      enabled BOOLEAN DEFAULT false,
      client_id TEXT,
      client_secret_hash TEXT,
      config JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(organization_id, provider)
    )
  `
}

// GET /auth-providers — List auth providers & diagnostic info
adminRoutes.get('/auth-providers', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    if (session.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const sql = await getSQL(c)
    await ensureTable(sql)

    const providers = await sql`
      SELECT id, provider, enabled, client_id, config, created_at, updated_at
      FROM auth_providers
      WHERE organization_id = ${session.organization_id}
      ORDER BY provider ASC
    `

    // Default provider list with status
    const defaults = ['credentials', 'google', 'github', 'microsoft', 'saml']
    const providerMap = new Map(providers.map((p: any) => [p.provider, p]))

    const result = defaults.map((name) => {
      const existing = providerMap.get(name)
      return {
        provider: name,
        enabled: existing?.enabled ?? (name === 'credentials'),
        configured: !!existing,
        client_id: existing?.client_id ? '***' + existing.client_id.slice(-4) : null,
        updated_at: existing?.updated_at || null,
      }
    })

    return c.json({ success: true, providers: result })
  } catch (err: any) {
    console.error('GET /api/_admin/auth-providers error:', err?.message)
    return c.json({ error: 'Failed to fetch auth providers' }, 500)
  }
})

// POST /auth-providers — Toggle / update a provider
adminRoutes.post('/auth-providers', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    if (session.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const sql = await getSQL(c)
    await ensureTable(sql)

    const body = await c.req.json()
    const { provider, enabled, client_id, client_secret, config } = body

    if (!provider) return c.json({ error: 'provider is required' }, 400)

    // Upsert
    const [result] = await sql`
      INSERT INTO auth_providers (organization_id, provider, enabled, client_id, client_secret_hash, config)
      VALUES (
        ${session.organization_id},
        ${provider},
        ${enabled ?? false},
        ${client_id || null},
        ${client_secret ? '***hashed***' : null},
        ${JSON.stringify(config || {})}
      )
      ON CONFLICT (organization_id, provider) DO UPDATE SET
        enabled = COALESCE(${enabled ?? null}, auth_providers.enabled),
        client_id = COALESCE(${client_id || null}, auth_providers.client_id),
        client_secret_hash = CASE WHEN ${client_secret || null} IS NOT NULL THEN '***hashed***' ELSE auth_providers.client_secret_hash END,
        config = COALESCE(${JSON.stringify(config || {})}::jsonb, auth_providers.config),
        updated_at = NOW()
      RETURNING id, provider, enabled, client_id, updated_at
    `

    return c.json({
      success: true,
      provider: {
        ...result,
        client_id: result.client_id ? '***' + result.client_id.slice(-4) : null,
      },
    })
  } catch (err: any) {
    console.error('POST /api/_admin/auth-providers error:', err?.message)
    return c.json({ error: 'Failed to update auth provider' }, 500)
  }
})
