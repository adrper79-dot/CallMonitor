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

export const callerIdRoutes = new Hono<{ Bindings: Env }>()

/** Shared: list caller IDs */
async function listCallerIds(c: any) {
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
      WHERE table_schema = 'public' AND table_name = 'caller_ids'
    ) as exists
  `

  if (!tableCheck[0].exists) {
    return c.json({ success: true, callerIds: [] })
  }

  const result = await sql`
    SELECT * FROM caller_ids
    WHERE organization_id = ${session.organization_id}
    ORDER BY created_at DESC
  `

  return c.json({ success: true, callerIds: result })
}

/** Shared: initiate verification */
async function initiateVerification(c: any) {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const { phone_number, label } = body

  if (!phone_number) {
    return c.json({ error: 'Phone number is required' }, 400)
  }

  // Validate E.164 format
  if (!/^\+[1-9]\d{1,14}$/.test(phone_number)) {
    return c.json({ error: 'Invalid phone number format (must be E.164, e.g. +14155551234)' }, 400)
  }

  const { neon } = await import('@neondatabase/serverless')
  const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
  const sql = neon(connectionString)

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS caller_ids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      phone_number TEXT NOT NULL,
      label TEXT,
      status TEXT DEFAULT 'pending',
      verification_code TEXT,
      verified_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `

  // Check for duplicate
  const existing = await sql`
    SELECT id, status FROM caller_ids
    WHERE organization_id = ${session.organization_id} AND phone_number = ${phone_number}
  `

  if (existing.length > 0 && existing[0].status === 'verified') {
    return c.json({ error: 'This number is already verified' }, 409)
  }

  // Generate a 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

  if (existing.length > 0) {
    // Update existing pending record
    await sql`
      UPDATE caller_ids
      SET verification_code = ${verificationCode}, status = 'pending', updated_at = NOW()
      WHERE id = ${existing[0].id}
    `
  } else {
    // Insert new
    await sql`
      INSERT INTO caller_ids (organization_id, phone_number, label, status, verification_code)
      VALUES (${session.organization_id}, ${phone_number}, ${label || ''}, 'pending', ${verificationCode})
    `
  }

  // In production, send the code via SMS/call using Telnyx
  // For now, log it (would be replaced with actual Telnyx verify API)
  console.log(`[CallerID] Verification code for ${phone_number}: ${verificationCode}`)

  return c.json({
    success: true,
    message: 'Verification initiated. Check your phone for the code.',
    phone_number,
  })
}

// GET /
callerIdRoutes.get('/', async (c) => {
  try {
    return await listCallerIds(c)
  } catch (err: any) {
    console.error('GET /api/caller-id error:', err?.message)
    return c.json({ error: 'Failed to get caller IDs' }, 500)
  }
})

// GET /verify — frontend alias
callerIdRoutes.get('/verify', async (c) => {
  try {
    return await listCallerIds(c)
  } catch (err: any) {
    console.error('GET /api/caller-id/verify error:', err?.message)
    return c.json({ error: 'Failed to get caller IDs' }, 500)
  }
})

// POST / — initiate verification
callerIdRoutes.post('/', async (c) => {
  try {
    return await initiateVerification(c)
  } catch (err: any) {
    console.error('POST /api/caller-id error:', err?.message)
    return c.json({ error: 'Failed to initiate verification' }, 500)
  }
})

// POST /verify — frontend alias
callerIdRoutes.post('/verify', async (c) => {
  try {
    return await initiateVerification(c)
  } catch (err: any) {
    console.error('POST /api/caller-id/verify error:', err?.message)
    return c.json({ error: 'Failed to initiate verification' }, 500)
  }
})

// PUT /verify — confirm verification with code
callerIdRoutes.put('/verify', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { phone_number, code } = body

    if (!phone_number || !code) {
      return c.json({ error: 'Phone number and verification code are required' }, 400)
    }

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      SELECT id, verification_code FROM caller_ids
      WHERE organization_id = ${session.organization_id}
        AND phone_number = ${phone_number}
        AND status = 'pending'
    `

    if (result.length === 0) {
      return c.json({ error: 'No pending verification found for this number' }, 404)
    }

    if (result[0].verification_code !== code) {
      return c.json({ error: 'Invalid verification code' }, 400)
    }

    // Mark as verified
    await sql`
      UPDATE caller_ids
      SET status = 'verified', verified_at = NOW(), verification_code = NULL, updated_at = NOW()
      WHERE id = ${result[0].id}
    `

    return c.json({
      success: true,
      message: 'Caller ID verified successfully',
      phone_number,
    })
  } catch (err: any) {
    console.error('PUT /api/caller-id/verify error:', err?.message)
    return c.json({ error: 'Failed to verify caller ID' }, 500)
  }
})

// DELETE /:id — remove caller ID
callerIdRoutes.delete('/:id', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const callerId = c.req.param('id')

    const { neon } = await import('@neondatabase/serverless')
    const connectionString = c.env.NEON_PG_CONN || c.env.HYPERDRIVE?.connectionString
    const sql = neon(connectionString)

    const result = await sql`
      DELETE FROM caller_ids
      WHERE id = ${callerId} AND organization_id = ${session.organization_id}
      RETURNING id
    `

    if (result.length === 0) {
      return c.json({ error: 'Caller ID not found' }, 404)
    }

    return c.json({ success: true, message: 'Caller ID removed' })
  } catch (err: any) {
    console.error('DELETE /api/caller-id/:id error:', err?.message)
    return c.json({ error: 'Failed to remove caller ID' }, 500)
  }
})
