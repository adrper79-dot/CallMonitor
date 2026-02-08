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
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { CreateShopperSchema, UpdateShopperSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'

export const shopperRoutes = new Hono<AppEnv>()

/** Shared handler: list scripts */
async function listScripts(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT * FROM shopper_scripts
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({
      success: true,
      scripts: result.rows,
      total: result.rows.length,
    })
  } finally {
    await db.end()
  }
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

  const db = getDb(c.env)
  try {
    if (id) {
      // Update existing
      const result = await db.query(
        `UPDATE shopper_scripts
         SET name = $1,
             content = $2,
             scenario = $3,
             is_active = $4,
             updated_at = NOW()
         WHERE id = $5 AND organization_id = $6
         RETURNING *`,
        [name, content || '', scenario || '', is_active ?? true, id, session.organization_id]
      )
      if (result.rows.length === 0) {
        return c.json({ error: 'Script not found' }, 404)
      }
      writeAuditLog(db, {
        organizationId: session.organization_id,
        userId: session.user_id,
        resourceType: 'shopper_scripts',
        resourceId: result.rows[0].id,
        action: AuditAction.SHOPPER_SCRIPT_UPDATED,
        before: null,
        after: result.rows[0],
      })
      return c.json({ success: true, script: result.rows[0] })
    }

    // Create new
    const result = await db.query(
      `INSERT INTO shopper_scripts (organization_id, name, content, scenario, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session.organization_id, name, content || '', scenario || '', is_active ?? true]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'shopper_scripts',
      resourceId: result.rows[0].id,
      action: AuditAction.SHOPPER_SCRIPT_CREATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, script: result.rows[0] }, 201)
  } finally {
    await db.end()
  }
}

// GET /scripts
shopperRoutes.get('/scripts', async (c) => {
  try {
    return await listScripts(c)
  } catch (err: any) {
    logger.error('GET /api/shopper/scripts error', { error: err?.message })
    return c.json({ error: 'Failed to get scripts' }, 500)
  }
})

// GET /scripts/manage — frontend alias
shopperRoutes.get('/scripts/manage', async (c) => {
  try {
    return await listScripts(c)
  } catch (err: any) {
    logger.error('GET /api/shopper/scripts/manage error', { error: err?.message })
    return c.json({ error: 'Failed to get scripts' }, 500)
  }
})

// POST /scripts
shopperRoutes.post('/scripts', async (c) => {
  try {
    return await upsertScript(c)
  } catch (err: any) {
    logger.error('POST /api/shopper/scripts error', { error: err?.message })
    return c.json({ error: 'Failed to create script' }, 500)
  }
})

// POST /scripts/manage — frontend alias
shopperRoutes.post('/scripts/manage', async (c) => {
  try {
    return await upsertScript(c)
  } catch (err: any) {
    logger.error('POST /api/shopper/scripts/manage error', { error: err?.message })
    return c.json({ error: 'Failed to create/update script' }, 500)
  }
})

// PUT /scripts/:id — update script
shopperRoutes.put('/scripts/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const scriptId = c.req.param('id')
    const parsed = await validateBody(c, UpdateShopperSchema)
    if (!parsed.success) return parsed.response
    const { name, content, scenario, is_active } = parsed.data

    const result = await db.query(
      `UPDATE shopper_scripts
       SET name = COALESCE($1, name),
           content = COALESCE($2, content),
           scenario = COALESCE($3, scenario),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND organization_id = $6
       RETURNING *`,
      [
        name || null,
        content || null,
        scenario || null,
        is_active ?? null,
        scriptId,
        session.organization_id,
      ]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'shopper_scripts',
      resourceId: scriptId,
      action: AuditAction.SHOPPER_SCRIPT_UPDATED,
      before: null,
      after: result.rows[0],
    })

    return c.json({ success: true, script: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/shopper/scripts/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update script' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /scripts/:id — delete script
shopperRoutes.delete('/scripts/:id', async (c) => {
  const db = getDb(c.env)
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const scriptId = c.req.param('id')

    const result = await db.query(
      `DELETE FROM shopper_scripts
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [scriptId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'shopper_scripts',
      resourceId: scriptId,
      action: AuditAction.SHOPPER_SCRIPT_DELETED,
      before: { id: scriptId },
      after: null,
    })

    return c.json({ success: true, message: 'Script deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/shopper/scripts/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete script' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /scripts/manage — frontend compat (id in body or query)
shopperRoutes.delete('/scripts/manage', async (c) => {
  const db = getDb(c.env)
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
      } catch {
        /* no body */
      }
    }

    if (!scriptId) {
      return c.json({ error: 'Script ID required' }, 400)
    }

    const result = await db.query(
      `DELETE FROM shopper_scripts
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [scriptId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Script not found' }, 404)
    }

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'shopper_scripts',
      resourceId: scriptId,
      action: AuditAction.SHOPPER_SCRIPT_DELETED,
      before: { id: scriptId },
      after: null,
    })

    return c.json({ success: true, message: 'Script deleted' })
  } catch (err: any) {
    logger.error('DELETE /api/shopper/scripts/manage error', { error: err?.message })
    return c.json({ error: 'Failed to delete script' }, 500)
  } finally {
    await db.end()
  }
})
