/**
 * CRM Integration Routes - OAuth connections and sync management
 *
 * Endpoints:
 *   GET    /integrations              - List CRM integrations
 *   POST   /integrations              - Create CRM integration (OAuth flow)
 *   GET    /integrations/:id          - Get integration details
 *   PUT    /integrations/:id          - Update integration settings
 *   DELETE /integrations/:id          - Disconnect integration
 *   POST   /integrations/:id/oauth    - Initiate OAuth flow
 *   POST   /integrations/:id/sync     - Trigger manual sync
 *
 *   GET    /objects                   - List CRM object links
 *   POST   /objects                   - Create CRM object link
 *   GET    /objects/:id               - Get object link details
 *   PUT    /objects/:id               - Update object link
 *   DELETE /objects/:id               - Delete object link
 *
 *   GET    /sync-log                  - List sync operations
 *   GET    /sync-log/:id              - Get sync operation details
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

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateIntegrationSchema = z.object({
  provider: z.enum(['hubspot', 'salesforce', 'zoho', 'pipedrive']),
  settings: z.record(z.unknown()).optional(),
})

const UpdateIntegrationSchema = z.object({
  settings: z.record(z.unknown()).optional(),
  sync_enabled: z.boolean().optional(),
})

const CreateCrmObjectLinkSchema = z.object({
  call_id: z.string().uuid(),
  crm_object_type: z.enum(['contact', 'company', 'deal', 'lead', 'account', 'opportunity']),
  crm_object_id: z.string().min(1).max(200),
  crm_object_name: z.string().max(200).optional(),
  crm_object_url: z.string().url().optional(),
  sync_direction: z.enum(['inbound', 'outbound']).default('outbound'),
})

const UpdateCrmObjectLinkSchema = z.object({
  crm_object_name: z.string().max(200).optional(),
  crm_object_url: z.string().url().optional(),
  sync_direction: z.enum(['inbound', 'outbound']).optional(),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

export const crmRoutes = new Hono<AppEnv>()

// ─── Integration Management ──────────────────────────────────────────────────

// List integrations
crmRoutes.get('/integrations', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const result = await db.query(
      `SELECT id, provider, provider_account_id, provider_account_name,
              status, error_message, last_error_at, settings, sync_enabled,
              connected_at, disconnected_at, created_at, updated_at
       FROM integrations
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, integrations: result.rows })
  } catch (err: any) {
    logger.error('GET /api/crm/integrations error', { error: err?.message })
    return c.json({ error: 'Failed to get integrations' }, 500)
  } finally {
    await db.end()
  }
})

// Create integration
crmRoutes.post('/integrations', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateIntegrationSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    const result = await db.query(
      `INSERT INTO integrations (organization_id, provider, settings, connected_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session.organization_id, data.provider, JSON.stringify(data.settings || {}), session.user_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_integrations',
      resourceId: result.rows[0].id,
      action: AuditAction.CRM_INTEGRATION_CREATED,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, integration: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/crm/integrations error', { error: err?.message })
    return c.json({ error: 'Failed to create integration' }, 500)
  } finally {
    await db.end()
  }
})

// Get integration details
crmRoutes.get('/integrations/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integrationId = c.req.param('id')

    const result = await db.query(
      `SELECT * FROM integrations
       WHERE id = $1 AND organization_id = $2`,
      [integrationId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Integration not found' }, 404)
    }

    return c.json({ success: true, integration: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/crm/integrations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get integration' }, 500)
  } finally {
    await db.end()
  }
})

// Update integration
crmRoutes.put('/integrations/:id', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integrationId = c.req.param('id')
    const parsed = await validateBody(c, UpdateIntegrationSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    // Get existing record
    const existing = await db.query(
      `SELECT * FROM integrations WHERE id = $1 AND organization_id = $2`,
      [integrationId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Integration not found' }, 404)
    }
    const oldRecord = existing.rows[0]

    const result = await db.query(
      `UPDATE integrations
       SET settings = COALESCE($1, settings),
           sync_enabled = COALESCE($2, sync_enabled),
           updated_at = NOW()
       WHERE id = $3 AND organization_id = $4
       RETURNING *`,
      [
        data.settings ? JSON.stringify(data.settings) : null,
        data.sync_enabled,
        integrationId,
        session.organization_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_integrations',
      resourceId: integrationId,
      action: AuditAction.CRM_INTEGRATION_UPDATED,
      oldValue: oldRecord,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, integration: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/crm/integrations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update integration' }, 500)
  } finally {
    await db.end()
  }
})

// Delete integration
crmRoutes.delete('/integrations/:id', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'admin')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const integrationId = c.req.param('id')

    // Get existing record
    const existing = await db.query(
      `SELECT * FROM integrations WHERE id = $1 AND organization_id = $2`,
      [integrationId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'Integration not found' }, 404)
    }
    const oldRecord = existing.rows[0]

    // Delete associated object links and sync log
    await db.query(`DELETE FROM crm_sync_log WHERE integration_id = $1`, [integrationId])
    await db.query(`DELETE FROM crm_object_links WHERE integration_id = $1`, [integrationId])

    // Delete integration
    await db.query(
      `DELETE FROM integrations WHERE id = $1 AND organization_id = $2`,
      [integrationId, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_integrations',
      resourceId: integrationId,
      action: AuditAction.CRM_INTEGRATION_DELETED,
      oldValue: oldRecord,
      newValue: null,
    }).catch(() => {})

    return c.json({ success: true, message: 'Integration disconnected' })
  } catch (err: any) {
    logger.error('DELETE /api/crm/integrations/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete integration' }, 500)
  } finally {
    await db.end()
  }
})

// ─── CRM Object Links ───────────────────────────────────────────────────────

// List object links
crmRoutes.get('/objects', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const callId = c.req.query('call_id')

    let query = `SELECT col.*, c.phone_number, c.started_at
                 FROM crm_object_links col
                 LEFT JOIN calls c ON col.call_id = c.id
                 WHERE col.organization_id = $1`
    const params: any[] = [session.organization_id]
    let paramIndex = 2

    if (callId) {
      query += ` AND col.call_id = $${paramIndex}`
      params.push(callId)
      paramIndex++
    }

    query += ` ORDER BY col.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return c.json({ success: true, objects: result.rows })
  } catch (err: any) {
    logger.error('GET /api/crm/objects error', { error: err?.message })
    return c.json({ error: 'Failed to get CRM objects' }, 500)
  } finally {
    await db.end()
  }
})

// Create object link
crmRoutes.post('/objects', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const parsed = await validateBody(c, CreateCrmObjectLinkSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    // Verify call belongs to organization
    const callCheck = await db.query(
      `SELECT id FROM calls WHERE id = $1 AND organization_id = $2`,
      [data.call_id, session.organization_id]
    )
    if (callCheck.rows.length === 0) {
      return c.json({ error: 'Call not found' }, 404)
    }

    const result = await db.query(
      `INSERT INTO crm_object_links
        (organization_id, call_id, crm_object_type, crm_object_id,
         crm_object_name, crm_object_url, sync_direction)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        session.organization_id,
        data.call_id,
        data.crm_object_type,
        data.crm_object_id,
        data.crm_object_name || null,
        data.crm_object_url || null,
        data.sync_direction,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_object_links',
      resourceId: result.rows[0].id,
      action: AuditAction.CRM_OBJECT_LINKED,
      oldValue: null,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, object: result.rows[0] }, 201)
  } catch (err: any) {
    logger.error('POST /api/crm/objects error', { error: err?.message })
    return c.json({ error: 'Failed to create CRM object link' }, 500)
  } finally {
    await db.end()
  }
})

// Get object link details
crmRoutes.get('/objects/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const objectId = c.req.param('id')

    const result = await db.query(
      `SELECT col.*, c.phone_number, c.started_at
       FROM crm_object_links col
       LEFT JOIN calls c ON col.call_id = c.id
       WHERE col.id = $1 AND col.organization_id = $2`,
      [objectId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'CRM object link not found' }, 404)
    }

    return c.json({ success: true, object: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/crm/objects/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get CRM object' }, 500)
  } finally {
    await db.end()
  }
})

// Update object link
crmRoutes.put('/objects/:id', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const objectId = c.req.param('id')
    const parsed = await validateBody(c, UpdateCrmObjectLinkSchema)
    if (!parsed.success) return parsed.response
    const data = parsed.data

    // Get existing record
    const existing = await db.query(
      `SELECT * FROM crm_object_links WHERE id = $1 AND organization_id = $2`,
      [objectId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'CRM object link not found' }, 404)
    }
    const oldRecord = existing.rows[0]

    const result = await db.query(
      `UPDATE crm_object_links
       SET crm_object_name = COALESCE($1, crm_object_name),
           crm_object_url = COALESCE($2, crm_object_url),
           sync_direction = COALESCE($3, sync_direction),
           updated_at = NOW()
       WHERE id = $4 AND organization_id = $5
       RETURNING *`,
      [
        data.crm_object_name,
        data.crm_object_url,
        data.sync_direction,
        objectId,
        session.organization_id,
      ]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_object_links',
      resourceId: objectId,
      action: AuditAction.CRM_OBJECT_UPDATED,
      oldValue: oldRecord,
      newValue: result.rows[0],
    }).catch(() => {})

    return c.json({ success: true, object: result.rows[0] })
  } catch (err: any) {
    logger.error('PUT /api/crm/objects/:id error', { error: err?.message })
    return c.json({ error: 'Failed to update CRM object' }, 500)
  } finally {
    await db.end()
  }
})

// Delete object link
crmRoutes.delete('/objects/:id', crmRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const objectId = c.req.param('id')

    // Get existing record
    const existing = await db.query(
      `SELECT * FROM crm_object_links WHERE id = $1 AND organization_id = $2`,
      [objectId, session.organization_id]
    )
    if (existing.rows.length === 0) {
      return c.json({ error: 'CRM object link not found' }, 404)
    }
    const oldRecord = existing.rows[0]

    await db.query(
      `DELETE FROM crm_object_links WHERE id = $1 AND organization_id = $2`,
      [objectId, session.organization_id]
    )

    writeAuditLog(db, {
      organizationId: session.organization_id,
      userId: session.user_id,
      resourceType: 'crm_object_links',
      resourceId: objectId,
      action: AuditAction.CRM_OBJECT_UNLINKED,
      oldValue: oldRecord,
      newValue: null,
    }).catch(() => {})

    return c.json({ success: true, message: 'CRM object link removed' })
  } catch (err: any) {
    logger.error('DELETE /api/crm/objects/:id error', { error: err?.message })
    return c.json({ error: 'Failed to delete CRM object' }, 500)
  } finally {
    await db.end()
  }
})

// ─── Sync Log ───────────────────────────────────────────────────────────────

// List sync operations
crmRoutes.get('/sync-log', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200)
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const integrationId = c.req.query('integration_id')
    const status = c.req.query('status')

    let query = `SELECT csl.*, i.provider, i.provider_account_name
                 FROM crm_sync_log csl
                 LEFT JOIN integrations i ON csl.integration_id = i.id
                 WHERE csl.organization_id = $1`
    const params: any[] = [session.organization_id]
    let paramIndex = 2

    if (integrationId) {
      query += ` AND csl.integration_id = $${paramIndex}`
      params.push(integrationId)
      paramIndex++
    }

    if (status) {
      query += ` AND csl.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    query += ` ORDER BY csl.started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    return c.json({ success: true, sync_log: result.rows })
  } catch (err: any) {
    logger.error('GET /api/crm/sync-log error', { error: err?.message })
    return c.json({ error: 'Failed to get sync log' }, 500)
  } finally {
    await db.end()
  }
})

// Get sync operation details
crmRoutes.get('/sync-log/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const db = getDb(c.env, session.organization_id)
  try {
    const logId = c.req.param('id')

    const result = await db.query(
      `SELECT csl.*, i.provider, i.provider_account_name
       FROM crm_sync_log csl
       LEFT JOIN integrations i ON csl.integration_id = i.id
       WHERE csl.id = $1 AND csl.organization_id = $2`,
      [logId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Sync log entry not found' }, 404)
    }

    return c.json({ success: true, log_entry: result.rows[0] })
  } catch (err: any) {
    logger.error('GET /api/crm/sync-log/:id error', { error: err?.message })
    return c.json({ error: 'Failed to get sync log entry' }, 500)
  } finally {
    await db.end()
  }
})