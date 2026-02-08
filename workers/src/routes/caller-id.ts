/**
 * Caller ID Routes - Manage verified caller ID numbers
 *
 * Endpoints:
 *   GET  /         - List caller IDs for org
 *   GET  /verify   - Alias for GET / (frontend compat)
 *   POST /         - Initiate caller ID verification
 *   POST /verify   - Alias for POST / (frontend compat)
 *   PUT  /verify   - Confirm verification with code
 *   DELETE /:id    - Remove a caller ID
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { AddCallerIdSchema, VerifyCallerIdSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export const callerIdRoutes = new Hono<{ Bindings: Env }>()

/** Shared: list caller IDs */
async function listCallerIds(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT * FROM caller_ids
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [session.organization_id]
    )

    return c.json({ success: true, callerIds: result.rows })
  } finally {
    await db.end()
  }
}

/** Shared: initiate verification */
async function initiateVerification(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const parsed = await validateBody(c, AddCallerIdSchema)
  if (!parsed.success) return parsed.response
  const { phone_number, label } = parsed.data

  const db = getDb(c.env)
  try {
    // Check for duplicate
    const existing = await db.query(
      `SELECT id, status FROM caller_ids
       WHERE organization_id = $1 AND phone_number = $2`,
      [session.organization_id, phone_number]
    )

    if (existing.rows.length > 0 && existing.rows[0].status === 'verified') {
      return c.json({ error: 'This number is already verified' }, 409)
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    if (existing.rows.length > 0) {
      // Update existing pending record
      await db.query(
        `UPDATE caller_ids
         SET verification_code = $1, status = 'pending', updated_at = NOW()
         WHERE id = $2`,
        [verificationCode, existing.rows[0].id]
      )
    } else {
      // Insert new
      await db.query(
        `INSERT INTO caller_ids (organization_id, phone_number, label, status, verification_code)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [session.organization_id, phone_number, label || '', verificationCode]
      )
    }

    // In production, send the code via SMS/call using Telnyx
    // For now, log it (would be replaced with actual Telnyx verify API)
    // Verification code generated (do NOT log the code itself)

    return c.json({
      success: true,
      message: 'Verification initiated. Check your phone for the code.',
      phone_number,
    })
  } finally {
    await db.end()
  }
}

// GET /
callerIdRoutes.get('/', async (c) => {
  try {
    return await listCallerIds(c)
  } catch (err: any) {
    logger.error('GET /api/caller-id error', { error: err?.message })
    return c.json({ error: 'Failed to get caller IDs' }, 500)
  }
})

// GET /verify — frontend alias
callerIdRoutes.get('/verify', async (c) => {
  try {
    return await listCallerIds(c)
  } catch (err: any) {
    logger.error('GET /api/caller-id/verify error', { error: err?.message })
    return c.json({ error: 'Failed to get caller IDs' }, 500)
  }
})

// POST / — initiate verification
callerIdRoutes.post('/', async (c) => {
  try {
    return await initiateVerification(c)
  } catch (err: any) {
    logger.error('POST /api/caller-id error', { error: err?.message })
    return c.json({ error: 'Failed to initiate verification' }, 500)
  }
})

// POST /verify — frontend alias
callerIdRoutes.post('/verify', async (c) => {
  try {
    return await initiateVerification(c)
  } catch (err: any) {
    logger.error('POST /api/caller-id/verify error', { error: err?.message })
    return c.json({ error: 'Failed to initiate verification' }, 500)
  }
})

// PUT /verify — confirm verification with code
callerIdRoutes.put('/verify', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const parsed = await validateBody(c, VerifyCallerIdSchema)
  if (!parsed.success) return parsed.response
  const { phone_number, code } = parsed.data

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `SELECT id, verification_code FROM caller_ids
       WHERE organization_id = $1
         AND phone_number = $2
         AND status = 'pending'`,
      [session.organization_id, phone_number]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'No pending verification found for this number' }, 404)
    }

    if (result.rows[0].verification_code !== code) {
      return c.json({ error: 'Invalid verification code' }, 400)
    }

    // Mark as verified
    await db.query(
      `UPDATE caller_ids
       SET status = 'verified', verified_at = NOW(), verification_code = NULL, updated_at = NOW()
       WHERE id = $1`,
      [result.rows[0].id]
    )

    return c.json({
      success: true,
      message: 'Caller ID verified successfully',
      phone_number,
    })
  } catch (err: any) {
    logger.error('PUT /api/caller-id/verify error', { error: err?.message })
    return c.json({ error: 'Failed to verify caller ID' }, 500)
  } finally {
    await db.end()
  }
})

// DELETE /:id — remove caller ID
callerIdRoutes.delete('/:id', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const callerId = c.req.param('id')

  const db = getDb(c.env)
  try {
    const result = await db.query(
      `DELETE FROM caller_ids
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [callerId, session.organization_id]
    )

    if (result.rows.length === 0) {
      return c.json({ error: 'Caller ID not found' }, 404)
    }

    return c.json({ success: true, message: 'Caller ID removed' })
  } catch (err: any) {
    logger.error('DELETE /api/caller-id/:id error', { error: err?.message })
    return c.json({ error: 'Failed to remove caller ID' }, 500)
  } finally {
    await db.end()
  }
})
