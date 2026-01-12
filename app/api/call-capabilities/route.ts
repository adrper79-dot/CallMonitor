import { NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import { AppError } from '@/types/app-error'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'

type Capabilities = Record<'record' | 'transcribe' | 'translate' | 'survey' | 'synthetic_caller' | 'real_time_translation_preview', boolean>

const defaultCaps = (): Capabilities => ({ record: false, transcribe: false, translate: false, survey: false, synthetic_caller: false, real_time_translation_preview: false })

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const callId = url.searchParams.get('callId') ?? undefined
    const orgId = url.searchParams.get('orgId') ?? undefined

    if (!orgId && !callId) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'orgId or callId required', user_message: 'orgId or callId required', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // resolve organization_id via call if callId provided
    let organization_id = orgId
    if (!organization_id && callId) {
      const { data: callRows, error: callErr } = await supabaseAdmin.from('calls').select('organization_id').eq('id', callId).limit(1)
      if (callErr) {
        const err = new AppError({ code: 'DB_ERROR', message: 'Failed to fetch call', user_message: 'Failed to fetch call', severity: 'HIGH' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
      }
      const call = callRows?.[0]
      if (!call) {
        const err = new AppError({ code: 'CALL_NOT_FOUND', message: 'Call not found', user_message: 'Call not found', severity: 'MEDIUM' })
        return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 404 })
      }
      organization_id = call.organization_id
    }

    if (!organization_id) {
      const err = new AppError({ code: 'INVALID_INPUT', message: 'organization id not resolved', user_message: 'organization id not resolved', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 400 })
    }

    // require authenticated actor
    const session = await getServerSession().catch(() => null)
    const actorId = session?.user?.id ?? null
    if (!actorId) {
      const err = new AppError({ code: 'AUTH_REQUIRED', message: 'Authentication required', user_message: 'Authentication required', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // membership check
    const { data: membershipRows, error: membershipErr } = await supabaseAdmin.from('org_members').select('id,role').eq('organization_id', organization_id).eq('user_id', actorId).limit(1)
    if (membershipErr) {
      const err = new AppError({ code: 'DB_ERROR', message: 'Failed to verify membership', user_message: 'Failed to verify membership', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }
    if (!membershipRows || membershipRows.length === 0) {
      const err = new AppError({ code: 'AUTH_ORG_MISMATCH', message: 'Actor not authorized for organization', user_message: 'Not authorized for this organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 401 })
    }

    // organization lookup (plan)
    const { data: orgRows, error: orgErr } = await supabaseAdmin.from('organizations').select('plan').eq('id', organization_id).limit(1)
    if (orgErr) {
      const err = new AppError({ code: 'DB_ERROR', message: 'Failed to fetch organization', user_message: 'Failed to fetch organization', severity: 'HIGH' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 500 })
    }
    const org = orgRows?.[0]
    if (!org) {
      const err = new AppError({ code: 'ORG_NOT_FOUND', message: 'Organization not found', user_message: 'Organization not found', severity: 'MEDIUM' })
      return NextResponse.json({ success: false, error: { id: err.id, code: err.code, message: err.user_message, severity: err.severity } }, { status: 404 })
    }

    // base capabilities by plan
    const plan = String(org.plan ?? '').toLowerCase()
    let capabilities = defaultCaps()
    if (plan === 'enterprise') capabilities = { record: true, transcribe: true, translate: true, survey: true, synthetic_caller: true, real_time_translation_preview: false }
    else if (plan === 'business') capabilities = { record: true, transcribe: true, translate: true, survey: true, synthetic_caller: true, real_time_translation_preview: false }
    else if (['pro', 'standard', 'active', 'trial'].includes(plan)) capabilities = { record: true, transcribe: true, translate: false, survey: true, synthetic_caller: false, real_time_translation_preview: false }
    else capabilities = defaultCaps()

    // Live translation preview requires Business plan (or enterprise) + feature flag
    const isBusinessPlan = ['business', 'enterprise'].includes(plan)
    const isFeatureFlagEnabled = isLiveTranslationPreviewEnabled()
    capabilities.real_time_translation_preview = isBusinessPlan && isFeatureFlagEnabled

    // consult voice_configs (optional; table added to ARCH_DOCS Schema)
    try {
      const { data: vcRows, error: vcErr } = await supabaseAdmin.from('voice_configs').select('record,transcribe,translate,survey,synthetic_caller,translate_from,translate_to').eq('organization_id', organization_id).limit(1)
      if (vcErr) {
        // do not fail the request for missing/erroneous voice_configs; log by returning a low-severity AppError in the body
      } else if (vcRows && vcRows[0]) {
        const cfg = vcRows[0]
        ;(['record', 'transcribe', 'translate', 'survey', 'synthetic_caller'] as Array<keyof Capabilities>).forEach((k) => {
          const v = (cfg as any)[k]
          if (typeof v === 'boolean') capabilities[k] = v
        })
      }
    } catch (e) {
      // swallow — voice_configs augmentation is best-effort
    }

    return NextResponse.json({ success: true, capabilities })
  } catch (err: any) {
    const e = err instanceof AppError ? err : new AppError({ code: 'CALL_CAPS_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to determine call capabilities', severity: 'HIGH', retriable: true })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message, severity: e.severity } }, { status: 500 })
  }
}
