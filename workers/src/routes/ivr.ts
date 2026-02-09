/**
 * IVR Routes — IVR Payment Collection flow management
 *
 * Routes:
 *   POST /start              — Start an IVR payment flow on a call
 *   GET  /status/:callId     — Get IVR flow status for a call
 *
 * @see ARCH_DOCS/FEATURE_IMPLEMENTATION_PLAN.md — Phase 5
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { validateBody } from '../lib/validate'
import { IVRFlowSchema } from '../lib/schemas'
import { logger } from '../lib/logger'
import { ivrRateLimit } from '../lib/rate-limit'
import { startIVRFlow } from '../lib/ivr-flow-engine'

export const ivrRoutes = new Hono<AppEnv>()

// Start an IVR payment flow on a call
ivrRoutes.post('/start', ivrRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, IVRFlowSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env)
  try {
    // Verify account belongs to org
    const acctResult = await db.query(
      `SELECT id, balance_due, status FROM collection_accounts
       WHERE id = $1 AND organization_id = $2`,
      [parsed.data.account_id, session.organization_id]
    )
    if (acctResult.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Find the active call for this org (most recent in_progress call)
    const callResult = await db.query(
      `SELECT id, call_control_id FROM calls
       WHERE organization_id = $1 AND status = 'in_progress'
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.organization_id]
    )
    if (callResult.rows.length === 0) {
      return c.json({ error: 'No active call found' }, 400)
    }

    const call = callResult.rows[0]

    await startIVRFlow(
      c.env,
      db,
      call.call_control_id,
      call.id,
      session.organization_id,
      parsed.data.account_id
    )

    return c.json({
      success: true,
      message: 'IVR flow started',
      call_id: call.id,
      account_id: parsed.data.account_id,
    })
  } catch (err: any) {
    logger.error('POST /api/ivr/start error', { error: err?.message })
    return c.json({ error: 'Failed to start IVR flow' }, 500)
  } finally {
    await db.end()
  }
})

// Get IVR flow status for a call
ivrRoutes.get('/status/:callId', async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const callId = c.req.param('callId')

  const db = getDb(c.env)
  try {
    // Get recent collection payments for this call
    const paymentResult = await db.query(
      `SELECT cp.id, cp.amount, cp.method, cp.stripe_payment_id, cp.created_at
       FROM collection_payments cp
       WHERE cp.organization_id = $1
         AND EXISTS (
           SELECT 1 FROM calls c WHERE c.id = $2 AND c.organization_id = $1
         )
       ORDER BY cp.created_at DESC
       LIMIT 5`,
      [session.organization_id, callId]
    )

    // Get call status
    const callResult = await db.query(
      `SELECT id, status, from_number, to_number, created_at
       FROM calls
       WHERE id = $1 AND organization_id = $2`,
      [callId, session.organization_id]
    )

    return c.json({
      success: true,
      call: callResult.rows[0] || null,
      payments: paymentResult.rows,
    })
  } catch (err: any) {
    logger.error('GET /api/ivr/status error', { error: err?.message, callId })
    return c.json({ error: 'Failed to get IVR status' }, 500)
  } finally {
    await db.end()
  }
})

