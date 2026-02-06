/**
 * Retention Routes - Data retention policies and legal holds
 *
 * Endpoints:
 *   GET  /              - Get retention policy
 *   PUT  /              - Update retention policy
 *   GET  /legal-holds   - List legal holds
 *   POST /legal-holds   - Create legal hold
 *   DELETE /legal-holds/:id - Release (delete) legal hold
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const retentionRoutes = new Hono<{ Bindings: Env }>()

async function getNeon(c: any) {
  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  return neon(connectionString)
}

// GET / — Get retention policy
retentionRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getNeon(c)

    await sql`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL UNIQUE,
        recording_retention_days INTEGER DEFAULT 365,
        transcript_retention_days INTEGER DEFAULT 365,
        call_log_retention_days INTEGER DEFAULT 730,
        auto_delete_enabled BOOLEAN DEFAULT false,
        gdpr_mode BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    const rows = await sql`
      SELECT * FROM retention_policies
      WHERE organization_id = ${session.organization_id}
      LIMIT 1
    `

    const policy = rows[0] || {
      recording_retention_days: 365,
      transcript_retention_days: 365,
      call_log_retention_days: 730,
      auto_delete_enabled: false,
      gdpr_mode: false,
    }

    return c.json({ success: true, policy })
  } catch (err: any) {
    console.error('GET /api/retention error:', err?.message)
    return c.json({ error: 'Failed to get retention policy' }, 500)
  }
})

// PUT / — Update retention policy
retentionRoutes.put('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const {
      recording_retention_days,
      transcript_retention_days,
      call_log_retention_days,
      auto_delete_enabled,
      gdpr_mode,
    } = body

    const sql = await getNeon(c)

    await sql`
      CREATE TABLE IF NOT EXISTS retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL UNIQUE,
        recording_retention_days INTEGER DEFAULT 365,
        transcript_retention_days INTEGER DEFAULT 365,
        call_log_retention_days INTEGER DEFAULT 730,
        auto_delete_enabled BOOLEAN DEFAULT false,
        gdpr_mode BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    const result = await sql`
      INSERT INTO retention_policies (
        organization_id, recording_retention_days, transcript_retention_days,
        call_log_retention_days, auto_delete_enabled, gdpr_mode
      ) VALUES (
        ${session.organization_id},
        ${recording_retention_days ?? 365},
        ${transcript_retention_days ?? 365},
        ${call_log_retention_days ?? 730},
        ${auto_delete_enabled ?? false},
        ${gdpr_mode ?? false}
      )
      ON CONFLICT (organization_id)
      DO UPDATE SET
        recording_retention_days = EXCLUDED.recording_retention_days,
        transcript_retention_days = EXCLUDED.transcript_retention_days,
        call_log_retention_days = EXCLUDED.call_log_retention_days,
        auto_delete_enabled = EXCLUDED.auto_delete_enabled,
        gdpr_mode = EXCLUDED.gdpr_mode,
        updated_at = NOW()
      RETURNING *
    `

    return c.json({ success: true, policy: result[0] })
  } catch (err: any) {
    console.error('PUT /api/retention error:', err?.message)
    return c.json({ error: 'Failed to update retention policy' }, 500)
  }
})

// GET /legal-holds — List legal holds
retentionRoutes.get('/legal-holds', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const sql = await getNeon(c)

    await sql`
      CREATE TABLE IF NOT EXISTS legal_holds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        matter_reference TEXT,
        applies_to_all BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        released_at TIMESTAMPTZ
      )
    `

    const rows = await sql`
      SELECT * FROM legal_holds
      WHERE organization_id = ${session.organization_id}
      ORDER BY created_at DESC
    `

    return c.json({ success: true, legalHolds: rows })
  } catch (err: any) {
    console.error('GET /api/retention/legal-holds error:', err?.message)
    return c.json({ error: 'Failed to list legal holds' }, 500)
  }
})

// POST /legal-holds — Create legal hold
retentionRoutes.post('/legal-holds', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json()
    const { name, matter_reference, applies_to_all } = body

    if (!name) return c.json({ error: 'Legal hold name required' }, 400)

    const sql = await getNeon(c)

    await sql`
      CREATE TABLE IF NOT EXISTS legal_holds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        name TEXT NOT NULL,
        matter_reference TEXT,
        applies_to_all BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        released_at TIMESTAMPTZ
      )
    `

    const result = await sql`
      INSERT INTO legal_holds (organization_id, name, matter_reference, applies_to_all, created_by)
      VALUES (${session.organization_id}, ${name}, ${matter_reference || null}, ${applies_to_all ?? false}, ${session.user_id})
      RETURNING *
    `

    return c.json({ success: true, legalHold: result[0] })
  } catch (err: any) {
    console.error('POST /api/retention/legal-holds error:', err?.message)
    return c.json({ error: 'Failed to create legal hold' }, 500)
  }
})

// DELETE /legal-holds/:id — Release legal hold
retentionRoutes.delete('/legal-holds/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) return c.json({ error: 'Unauthorized' }, 401)

    const holdId = c.req.param('id')
    const sql = await getNeon(c)

    const result = await sql`
      UPDATE legal_holds
      SET status = 'released', released_at = NOW()
      WHERE id = ${holdId}::uuid AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) return c.json({ error: 'Legal hold not found' }, 404)

    return c.json({ success: true, message: 'Legal hold released' })
  } catch (err: any) {
    console.error('DELETE /api/retention/legal-holds/:id error:', err?.message)
    return c.json({ error: 'Failed to release legal hold' }, 500)
  }
})
