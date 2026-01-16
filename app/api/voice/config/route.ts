import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { AppError } from '@/types/app-error'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

// Force dynamic rendering - uses headers via getServerSession and request.url
export const dynamic = 'force-dynamic'

type VoiceConfigRow = {
  id?: string
  organization_id: string
  record?: boolean
  transcribe?: boolean
  translate?: boolean
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

    const { data: membershipRows, error: membershipErr } = await supabaseAdmin.from('org_members').select('id,role').eq('organization_id', orgId).eq('user_id', actorId).limit(1)
    if (membershipErr) {
      const err = new AppError({ code: 'DB_ERROR', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }
    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    const { data: rows, error } = await supabaseAdmin.from('voice_configs').select('*').eq('organization_id', orgId).limit(1)
    
    // If table doesn't exist (42P01 error), return null config instead of failing
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.info('voice_configs table does not exist yet, returning null config', { orgId })
        return NextResponse.json({ success: true, config: null })
      }
      const err = new AppError({ code: 'DB_ERROR', message: 'Failed to fetch voice configs', user_message: 'Failed to fetch voice configuration', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    const config = rows && rows[0] ? rows[0] : null
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

    const { data: membershipRows, error: membershipErr } = await supabaseAdmin.from('org_members').select('id,role').eq('organization_id', orgId).eq('user_id', actorId).limit(1)
    if (membershipErr) {
      const err = new AppError({ code: 'DB_ERROR', message: 'Membership lookup failed', user_message: 'Unable to verify membership', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }
    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'UNAUTHORIZED', message: 'Not authorized', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // Map incoming modulation keys to columns allowed by Schema
    // Per TOOL_TABLE_ALIGNMENT: voice_configs PUT allows all modulation columns
    // NOTE: target_id and campaign_id are NOT in the database schema - they are transient/session fields
    const allowedKeys = [
      'record', 'transcribe', 'translate', 'translate_from', 'translate_to', 
      'survey', 'synthetic_caller', 'use_voice_cloning', 'cloned_voice_id',
      // AI Survey Bot fields
      'survey_prompts', 'survey_question_types', 'survey_prompts_locales', 'survey_voice', 'survey_webhook_email', 'survey_inbound_number',
      // Caller ID masking
      'caller_id_mask', 'caller_id_verified'
    ]
    const stringKeys = ['translate_from', 'translate_to', 'cloned_voice_id', 'survey_voice', 'survey_webhook_email', 'survey_inbound_number', 'caller_id_mask']
    const booleanKeys = ['record', 'transcribe', 'translate', 'survey', 'synthetic_caller', 'use_voice_cloning', 'caller_id_verified']
    const jsonArrayKeys = ['survey_prompts', 'survey_question_types'] // Array fields stored as JSONB
    const jsonObjectKeys = ['survey_prompts_locales'] // JSON objects stored as JSONB
    // Do NOT include `organization_id` in the update payload — PUT must not write org id per TOOL_TABLE_ALIGNMENT.
    // Keep `organization_id` only for the INSERT row below.
    const updatePayload: any = { updated_by: actorId }
    for (const k of Object.keys(modulations || {})) {
      const v = (modulations as any)[k]
      // accept booleans for boolean columns, strings for string columns, arrays for jsonb
      if (allowedKeys.includes(k)) {
        if (stringKeys.includes(k)) {
          if (v === null || typeof v === 'string') updatePayload[k] = v
        } else if (booleanKeys.includes(k)) {
          if (typeof v === 'boolean') updatePayload[k] = v
        } else if (jsonArrayKeys.includes(k)) {
          // Accept arrays for JSONB columns
          if (v === null || Array.isArray(v)) updatePayload[k] = v
        } else if (jsonObjectKeys.includes(k)) {
          if (v === null || typeof v === 'object') updatePayload[k] = v
        }
      }
    }

    // Fetch existing config for validation and audit
    const { data: existingRows } = await supabaseAdmin.from('voice_configs').select('*').eq('organization_id', orgId).limit(1)
    const existing = existingRows && existingRows[0] ? existingRows[0] : null

    // Translation validation (per MASTER_ARCHITECTURE.txt):
    // - If language codes are provided, validate format
    // - If translate=true is being set, require language codes to be provided
    //   (either in this request or already existing in the config)
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
    
    // MASTER_ARCHITECTURE compliance: When enabling translation, language codes are required
    // Check if translate is being enabled (either explicitly or will remain true)
    const willTranslateBeEnabled = updatePayload.translate === true || 
      (updatePayload.translate === undefined && existing?.translate === true)
    
    if (willTranslateBeEnabled) {
      // Determine effective language codes after this update
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

    // upsert: insert if none, otherwise update permitted columns per TOOL_TABLE_ALIGNMENT
    if (!existing) {
      const row = { 
        id: uuidv4(), 
        organization_id: orgId,  // Required: NOT NULL constraint
        ...updatePayload 
      }
      const { error: insertErr } = await supabaseAdmin.from('voice_configs').insert(row)
      if (insertErr) {
        logger.error('Failed to insert voice_config', insertErr, { orgId, row })
        const err = new AppError({ code: 'DB_INSERT_FAILED', message: 'Failed to insert voice config', user_message: 'Could not save configuration', severity: 'HIGH' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
      }
      try {
        await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id: orgId, user_id: actorId, system_id: null, resource_type: 'voice_configs', resource_id: row.id, action: 'create', before: null, after: row, created_at: new Date().toISOString() })
      } catch (_) {}
      return NextResponse.json({ success: true, config: row })
    }

    // update
    // Use `any` cast to avoid typing mismatch in this environment and perform an update by organization_id
    const { error: updateErr } = await (supabaseAdmin as any).from('voice_configs').update(updatePayload).eq('organization_id', orgId)
    if (updateErr) {
      logger.error('Failed to update voice_config', updateErr, { orgId, updatePayload })
      const err = new AppError({ code: 'DB_UPDATE_FAILED', message: 'Failed to update voice config', user_message: 'Could not update configuration', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    const after = { ...existing, ...updatePayload }
    try {
      await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id: orgId, user_id: actorId, system_id: null, resource_type: 'voice_configs', resource_id: existing.id ?? null, action: 'update', before: existing, after, created_at: new Date().toISOString() })
    } catch (_) {}

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
