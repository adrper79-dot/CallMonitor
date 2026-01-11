import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import { AppError } from '@/types/app-error'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'
import { withIdempotency } from '@/lib/idempotency'

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
  updated_by?: string | null
  updated_at?: string | null
}

function isValidLangCode(s: any) {
  if (!s || typeof s !== 'string') return false
  // basic validation: two-letter code or language-region e.g. en or en-US
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(s)
}

async function handleGET(req: Request) {
  try {
    const url = new URL(req.url)
    const orgId = url.searchParams.get('orgId') ?? undefined
    if (!orgId) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'orgId required', user_message: 'Organization id required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    const session = await getServerSession().catch(() => null)
    const actorId = session?.user?.id ?? null
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
    if (error) {
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
  try {
    const body = await req.json()
    const orgId = body?.orgId ?? undefined
    const modulations = body?.modulations ?? {}

    if (!orgId) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'orgId required', user_message: 'Organization id required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    const session = await getServerSession().catch(() => null)
    const actorId = session?.user?.id ?? null
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
    const allowedKeys = ['record', 'transcribe', 'translate', 'translate_from', 'translate_to', 'survey', 'synthetic_caller']
    // Do NOT include `organization_id` in the update payload — PUT must not write org id per TOOL_TABLE_ALIGNMENT.
    // Keep `organization_id` only for the INSERT row below.
    const updatePayload: any = { updated_by: actorId }
    for (const k of Object.keys(modulations || {})) {
      const v = (modulations as any)[k]
      // accept booleans for boolean columns, strings for translate_from/translate_to
      if (allowedKeys.includes(k)) {
        if ((k === 'translate_from' || k === 'translate_to')) {
          if (v === null || typeof v === 'string') updatePayload[k] = v
        } else {
          if (typeof v === 'boolean') updatePayload[k] = v
        }
      }
    }

    // translation validation: if translate enabled then language codes required and valid
    if (updatePayload.translate === true) {
      const from = updatePayload.translate_from ?? modulations.translate_from
      const to = updatePayload.translate_to ?? modulations.translate_to
      if (!isValidLangCode(from) || !isValidLangCode(to)) {
        const err = new AppError({ code: 'INVALID_LANGUAGE', message: 'Invalid language codes', user_message: 'Invalid language codes for translation', severity: 'MEDIUM' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
      }
      updatePayload.translate_from = from
      updatePayload.translate_to = to
    }

    // fetch existing for audit
    const { data: existingRows } = await supabaseAdmin.from('voice_configs').select('*').eq('organization_id', orgId).limit(1)
    const existing = existingRows && existingRows[0] ? existingRows[0] : null

    // upsert: insert if none, otherwise update permitted columns per TOOL_TABLE_ALIGNMENT
    if (!existing) {
      const row = { id: uuidv4(), ...updatePayload }
      const { error: insertErr } = await supabaseAdmin.from('voice_configs').insert(row)
      if (insertErr) {
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
      const err = new AppError({ code: 'DB_UPDATE_FAILED', message: 'Failed to update voice config', user_message: 'Could not update configuration', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }

    const after = { ...existing, ...updatePayload }
    try {
      await supabaseAdmin.from('audit_logs').insert({ id: uuidv4(), organization_id: orgId, user_id: actorId, system_id: null, resource_type: 'voice_configs', resource_id: existing.id ?? null, action: 'update', before: existing, after, created_at: new Date().toISOString() })
    } catch (_) {}

    return NextResponse.json({ success: true, config: after })
  } catch (err: any) {
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
