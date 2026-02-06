/**
 * Shopper Routes - Mystery shopper script management
 * 
 * Endpoints:
 *   GET    /scripts        - List scripts for organization
 *   GET    /scripts/manage - Alias for GET /scripts (frontend compat)
 *   POST   /scripts        - Create a script
 *   POST   /scripts/manage - Alias for POST /scripts (frontend compat)
 *   PUT    /scripts/:id    - Update a script
 *   DELETE /scripts/:id    - Delete a script
 *   DELETE /scripts/manage - Delete a script (via body.id, frontend compat)
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { validateBody } from '../lib/validate'
import { CreateShopperSchema, UpdateShopperSchema } from '../lib/schemas'

export const shopperRoutes = new Hono<{ Bindings: Env }>()

/** Shared handler: list scripts */
async function listScripts(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  // Check if table exists
  const tableCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'shopper_scripts'
    ) as exists
  `

  if (!tableCheck[0].exists) {
    return c.json({ success: true, scripts: [], total: 0 })
  }

  const result = await sql`
    SELECT * FROM shopper_scripts
    WHERE organization_id = ${session.organization_id}
    ORDER BY created_at DESC
  `

  return c.json({
    success: true,
    scripts: result,
    total: result.length,
  })
}

/** Shared handler: create or update script */
async function upsertScript(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const parsed = await validateBody(c, CreateShopperSchema)
  if (!parsed.success) return parsed.response
  const { id, name, content, scenario, is_active } = parsed.data

  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS shopper_scripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      content TEXT,
      scenario TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  if (id) {
    // Update existing
    const result = await sql`
      UPDATE shopper_scripts
      SET name = ${name},
          content = ${content || ''},
          scenario = ${scenario || ''},
          is_active = ${is_active ?? true},
          updated_at = NOW()
      WHERE id = ${id} AND organization_id = ${session.organization_id}
      RETURNING *
    `
    if (result.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }
    return c.json({ success: true, script: result[0] })
  }

  // Create new
  const result = await sql`
    INSERT INTO shopper_scripts (organization_id, name, content, scenario, is_active)
    VALUES (${session.organization_id}, ${name}, ${content || ''}, ${scenario || ''}, ${is_active ?? true})
    RETURNING *
  `

  return c.json({ success: true, script: result[0] }, 201)
}

// GET /scripts
shopperRoutes.get('/scripts', async (c) => {
  try {
    return await listScripts(c)
  } catch (err: any) {
    console.error('GET /api/shopper/scripts error:', err?.message)
    return c.json({ error: 'Failed to get scripts' }, 500)
  }
})

// GET /scripts/manage — frontend alias
shopperRoutes.get('/scripts/manage', async (c) => {
  try {
    return await listScripts(c)
  } catch (err: any) {
    console.error('GET /api/shopper/scripts/manage error:', err?.message)
    return c.json({ error: 'Failed to get scripts' }, 500)
  }
})

// POST /scripts
shopperRoutes.post('/scripts', async (c) => {
  try {
    return await upsertScript(c)
  } catch (err: any) {
    console.error('POST /api/shopper/scripts error:', err?.message)
    return c.json({ error: 'Failed to create script' }, 500)
  }
})

// POST /scripts/manage — frontend alias
shopperRoutes.post('/scripts/manage', async (c) => {
  try {
    return await upsertScript(c)
  } catch (err: any) {
    console.error('POST /api/shopper/scripts/manage error:', err?.message)
    return c.json({ error: 'Failed to create/update script' }, 500)
  }
})

// PUT /scripts/:id — update script
shopperRoutes.put('/scripts/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const scriptId = c.req.param('id')
    const parsed = await validateBody(c, UpdateShopperSchema)
    if (!parsed.success) return parsed.response
    const { name, content, scenario, is_active } = parsed.data

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      UPDATE shopper_scripts
      SET name = COALESCE(${name}, name),
          content = COALESCE(${content}, content),
          scenario = COALESCE(${scenario}, scenario),
          is_active = COALESCE(${is_active}, is_active),
          updated_at = NOW()
      WHERE id = ${scriptId} AND organization_id = ${session.organization_id}
      RETURNING *
    `

    if (result.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    return c.json({ success: true, script: result[0] })
  } catch (err: any) {
    console.error('PUT /api/shopper/scripts/:id error:', err?.message)
    return c.json({ error: 'Failed to update script' }, 500)
  }
})

// DELETE /scripts/:id — delete script
shopperRoutes.delete('/scripts/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const scriptId = c.req.param('id')

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      DELETE FROM shopper_scripts
      WHERE id = ${scriptId} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    return c.json({ success: true, message: 'Script deleted' })
  } catch (err: any) {
    console.error('DELETE /api/shopper/scripts/:id error:', err?.message)
    return c.json({ error: 'Failed to delete script' }, 500)
  }
})

// DELETE /scripts/manage — frontend compat (id in body or query)
shopperRoutes.delete('/scripts/manage', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Try to get id from query or body
    let scriptId = c.req.query('id')
    if (!scriptId) {
      try {
        const body = await c.req.json()
        scriptId = body.id
      } catch { /* no body */ }
    }

    if (!scriptId) {
      return c.json({ error: 'Script ID required' }, 400)
    }

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      DELETE FROM shopper_scripts
      WHERE id = ${scriptId} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    return c.json({ success: true, message: 'Script deleted' })
  } catch (err: any) {
    console.error('DELETE /api/shopper/scripts/manage error:', err?.message)
    return c.json({ error: 'Failed to delete script' }, 500)
  }
})
