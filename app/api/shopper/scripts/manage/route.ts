import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireRole, requireAuth, Errors, success } from '@/lib/api/utils'
import { logger } from '@/lib/logger'
import { query } from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/shopper/scripts/manage - Create or update a secret shopper script
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx

    const body = await req.json()
    const {
      id, organization_id, name, description, script_text, persona = 'professional',
      tts_provider = 'signalwire', tts_voice = 'rime.spore', elevenlabs_voice_id,
      expected_outcomes = [], scoring_weights = {}, is_active = true
    } = body

    if (!organization_id || !name || !script_text) {
      return Errors.badRequest('organization_id, name, and script_text are required')
    }

    if (organization_id !== ctx.orgId) {
      return Errors.unauthorized()
    }

    let script
    if (id) {
      // Update
      const { rows } = await query(
        `UPDATE shopper_scripts SET
                name = $1, description = $2, script_text = $3, persona = $4,
                tts_provider = $5, tts_voice = $6, elevenlabs_voice_id = $7,
                expected_outcomes = $8, scoring_weights = $9, is_active = $10,
                updated_at = NOW()
             WHERE id = $11 AND organization_id = $12
             RETURNING *`,
        [
          name, description, script_text, persona,
          tts_provider, tts_voice, elevenlabs_voice_id || null,
          JSON.stringify(expected_outcomes), JSON.stringify(scoring_weights), is_active,
          id, organization_id
        ]
      )
      script = rows[0]
    } else {
      // Create
      const newId = uuidv4()
      const { rows } = await query(
        `INSERT INTO shopper_scripts (
                id, organization_id, name, description, script_text, persona,
                tts_provider, tts_voice, elevenlabs_voice_id,
                expected_outcomes, scoring_weights, is_active,
                created_by, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
             RETURNING *`,
        [
          newId, organization_id, name, description, script_text, persona,
          tts_provider, tts_voice, elevenlabs_voice_id || null,
          JSON.stringify(expected_outcomes), JSON.stringify(scoring_weights), is_active,
          ctx.userId
        ]
      )
      script = rows[0]
    }

    if (!script) {
      return Errors.internal('Failed to save script')
    }

    // Audit Log
    try {
      await query(
        `INSERT INTO audit_logs (
                id, organization_id, user_id, resource_type, resource_id, action, 
                actor_type, actor_label, after, created_at
             ) VALUES ($1, $2, $3, 'shopper_scripts', $4, $5, 'human', $3, $6, NOW())`,
        [
          uuidv4(), organization_id, ctx.userId, script.id,
          id ? 'update' : 'create',
          JSON.stringify({ name, persona, tts_provider })
        ]
      )
    } catch { /* Best effort */ }

    return NextResponse.json({ success: true, script }, { status: id ? 200 : 201 })
  } catch (error: any) {
    logger.error('Shopper script manage error', error)
    return Errors.internal(error)
  }
}

/**
 * GET /api/shopper/scripts/manage - List all shopper scripts
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth()
    if (ctx instanceof NextResponse) return ctx

    const { rows } = await query(
      `SELECT * FROM shopper_scripts 
         WHERE organization_id = $1 
         ORDER BY created_at DESC`,
      [ctx.orgId]
    )

    return success({ scripts: rows || [] })
  } catch (error: any) {
    logger.error('Shopper script list error', error)
    return Errors.internal(error)
  }
}

/**
 * DELETE /api/shopper/scripts/manage - Delete a shopper script
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireRole(['owner', 'admin'])
    if (ctx instanceof NextResponse) return ctx

    const url = new URL(req.url)
    const scriptId = url.searchParams.get('id')

    if (!scriptId) {
      return Errors.badRequest('id required')
    }

    await query(
      `DELETE FROM shopper_scripts WHERE id = $1 AND organization_id = $2`,
      [scriptId, ctx.orgId]
    )

    return success({ message: 'Script deleted' })
  } catch (error: any) {
    logger.error('Shopper script delete error', error)
    return Errors.internal(error)
  }
}
