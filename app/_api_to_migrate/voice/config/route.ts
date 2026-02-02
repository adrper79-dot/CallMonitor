import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/pgClient'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { AppError } from '@/types/app-error'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession and request.url
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type VoiceConfigRow = {
  id?: string
  organization_id: string
  record?: boolean
  transcribe?: boolean
  translate?: boolean
  live_translate?: boolean
  translate_from?: string | null
  translate_to?: string | null
  survey?: boolean
  synthetic_caller?: boolean
  survey_question_types?: any
  survey_prompts_locales?: any
  updated_by?: string | null
  updated_at?: string | null
}

function isValidLangCode(s: any) {
  if (!s || typeof s !== 'string') return false
  // basic validation: two-letter code or language-region e.g. en or en-US
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(s)
}

async function handleGET(req: Request) {
  let orgId: string | undefined = undefined
  let actorId: string | null = null

  try {
    const url = new URL(req.url)
    orgId = url.searchParams.get('orgId') ?? undefined
    if (!orgId) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'orgId required', user_message: 'Organization id required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    const session = await getServerSession(authOptions).catch(() => null)
    actorId = (session?.user as any)?.id ?? null
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const { rows: membershipRows } = await query(
      `SELECT id, role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
      [orgId, actorId]
    )

    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const { rows } = await query(
      `SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    )

    // If table doesn't exist (DB error), query() throws. 
    // We assume table exists as per migrations. If it fails, catch block handles it.

    const config = rows && rows[0] ? rows[0] : null

    // Normalize JSONB fields if they come back as objects directly (pg driver usually handles this)
    return NextResponse.json({ success: true, config })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_CONFIG_GET_FAILED', message: err?.message ?? 'Unexpected', user_message: 'Failed to read voice configuration', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

async function handlePUT(req: Request) {
  let orgId: string | undefined = undefined
  let actorId: string | null = null
  let modulations: any = {}

  try {
    const body = await req.json()
    orgId = body?.orgId ?? undefined
    modulations = body?.modulations ?? {}

    if (!orgId) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'orgId required', user_message: 'Organization id required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    const session = await getServerSession(authOptions).catch(() => null)
    actorId = (session?.user as any)?.id ?? null
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const { rows: membershipRows } = await query(
      `SELECT id, role FROM org_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
      [orgId, actorId]
    )

    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // RBAC enforcement
    const userRole = membershipRows[0].role?.toLowerCase() || 'viewer'
    const allowedRoles = ['owner', 'admin']
    if (!allowedRoles.includes(userRole)) {
      // Log permission denial for audit
      try {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, action, actor_type, actor_label, after, created_at)
            VALUES ($1, $2, $3, 'voice_configs', 'update_denied', 'human', $3, $4, NOW())`,
          [uuidv4(), orgId, actorId, JSON.stringify({ reason: 'insufficient_role', role: userRole })]
        )
      } catch (_) { }
      const err = new AppError({ code: 'FORBIDDEN', message: 'Insufficient permissions', user_message: 'You do not have permission to modify voice configuration. Only Owners and Admins can update settings.', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 403 })
    }

    // Map incoming modulation keys
    const allowedKeys = [
      'record', 'transcribe', 'translate', 'live_translate', 'translate_from', 'translate_to',
      'survey', 'synthetic_caller', 'use_voice_cloning', 'cloned_voice_id',
      'survey_prompts', 'survey_question_types', 'survey_prompts_locales', 'survey_voice', 'survey_webhook_email', 'survey_inbound_number',
      'caller_id_mask', 'caller_id_verified'
    ]
    const stringKeys = ['translate_from', 'translate_to', 'cloned_voice_id', 'survey_voice', 'survey_webhook_email', 'survey_inbound_number', 'caller_id_mask']
    const booleanKeys = ['record', 'transcribe', 'translate', 'live_translate', 'survey', 'synthetic_caller', 'use_voice_cloning', 'caller_id_verified']
    const jsonArrayKeys = ['survey_prompts', 'survey_question_types']
    const jsonObjectKeys = ['survey_prompts_locales']

    const updatePayload: any = { updated_by: actorId }
    for (const k of Object.keys(modulations || {})) {
      const v = (modulations as any)[k]
      if (allowedKeys.includes(k)) {
        if (stringKeys.includes(k)) {
          if (v === null || typeof v === 'string') updatePayload[k] = v
        } else if (booleanKeys.includes(k)) {
          if (typeof v === 'boolean') updatePayload[k] = v
        } else if (jsonArrayKeys.includes(k)) {
          if (v === null || Array.isArray(v)) updatePayload[k] = JSON.stringify(v)
        } else if (jsonObjectKeys.includes(k)) {
          if (v === null || typeof v === 'object') updatePayload[k] = JSON.stringify(v)
        }
      }
    }

    // Fetch existing config for validation and audit
    const { rows: existingRows } = await query(
      `SELECT * FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    )
    const existing = existingRows && existingRows[0] ? existingRows[0] : null

    // Validation logic...
    if (updatePayload.translate_from !== undefined && updatePayload.translate_from !== null) {
      if (!isValidLangCode(updatePayload.translate_from)) {
        const err = new AppError({ code: 'INVALID_LANGUAGE', message: 'Invalid from language code', user_message: 'Invalid source language code', severity: 'MEDIUM' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
      }
    }
    if (updatePayload.translate_to !== undefined && updatePayload.translate_to !== null) {
      if (!isValidLangCode(updatePayload.translate_to)) {
        const err = new AppError({ code: 'INVALID_LANGUAGE', message: 'Invalid to language code', user_message: 'Invalid target language code', severity: 'MEDIUM' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
      }
    }

    // Check if newly enabling translation
    const isNewlyEnablingTranslation =
      (updatePayload.translate === true && existing?.translate !== true) ||
      (updatePayload.live_translate === true && existing?.live_translate !== true)

    if (isNewlyEnablingTranslation) {
      const effectiveFrom = updatePayload.translate_from ?? existing?.translate_from
      const effectiveTo = updatePayload.translate_to ?? existing?.translate_to

      if (!effectiveFrom || !effectiveTo) {
        const err = new AppError({
          code: 'TRANSLATION_LANGUAGES_REQUIRED',
          message: 'Translation requires both source and target languages',
          user_message: 'Please select source and target languages before enabling translation',
          severity: 'MEDIUM'
        })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
      }
    }

    if (updatePayload.translate !== undefined && updatePayload.live_translate === undefined) {
      updatePayload.live_translate = updatePayload.translate
    } else if (updatePayload.live_translate !== undefined && updatePayload.translate === undefined) {
      updatePayload.translate = updatePayload.live_translate
    }

    // Upsert logic
    if (!existing) {
      const row = {
        id: uuidv4(),
        organization_id: orgId,
        ...updatePayload
      }

      const cols = Object.keys(row)
      const vals = Object.values(row)
      const params = vals.map((_, i) => `$${i + 1}`)

      try {
        await query(
          `INSERT INTO voice_configs (${cols.join(',')}) VALUES (${params.join(',')})`,
          vals
        )
      } catch (insertErr) {
        logger.error('Failed to insert voice_config', insertErr, { orgId, row })
        const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to insert voice config', user_message: 'Could not save configuration', severity: 'HIGH' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
      }

      try {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
            VALUES ($1, $2, $3, 'voice_configs', $4, 'create', 'human', $3, $5, NOW())`,
          [uuidv4(), orgId, actorId, row.id, JSON.stringify(row)]
        )
      } catch (_) { }
      return NextResponse.json({ success: true, config: row })
    }

    // update
    const keys = Object.keys(updatePayload)
    const values = Object.values(updatePayload)
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')

    try {
      await query(
        `UPDATE voice_configs SET ${setClause} WHERE organization_id = $${keys.length + 1}`,
        [...values, orgId]
      )
    } catch (updateErr) {
      logger.error('Failed to update voice_config', updateErr, { orgId, updatePayload })
      const err = new AppError({ code: 'DB_UPDATE_FAILED', message: 'Failed to update voice config', user_message: 'Could not update configuration', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    const after = { ...existing, ...updatePayload }
    try {
      await query(
        `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at)
            VALUES ($1, $2, $3, 'voice_configs', $4, 'update', 'human', $3, $5, $6, NOW())`,
        [uuidv4(), orgId, actorId, existing.id, JSON.stringify(existing), JSON.stringify(after)]
      )
    } catch (_) { }

    return NextResponse.json({ success: true, config: after })
  } catch (err: any) {
    logger.error('PUT /api/voice/config failed', err, { orgId, actorId, modulations })
    const e = err instanceof AppError ? err : new AppError({ code: 'VOICE_CONFIG_PUT_FAILED', message: err?.message ?? 'Unexpected', user_message: 'Failed to save voice configuration', severity: 'HIGH' })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}

export const GET = withRateLimit(handleGET, {
  identifier: (req) => {
    const url = new URL(req.url)
    const orgId = url.searchParams.get('orgId')
    return `${getClientIP(req)}-${orgId || 'anonymous'}`
  },
  config: {
    maxAttempts: 30,
    windowMs: 60 * 1000,
    blockMs: 5 * 60 * 1000
  }
})

export const PUT = withRateLimit(
  withIdempotency(handlePUT, {
    ttlSeconds: 300 // 5 minutes for config updates
  }),
  {
    identifier: (req) => {
      // Rate limit by IP + organization
      return `${getClientIP(req)}-config`
    },
    config: {
      maxAttempts: 20,
      windowMs: 60 * 1000,
      blockMs: 5 * 60 * 1000
    }
  }
)
