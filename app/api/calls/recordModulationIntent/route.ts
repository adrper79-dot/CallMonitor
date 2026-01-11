import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { getServerSession } from 'next-auth/next'
import { AppError } from '@/types/app-error'

type Modulations = { record?: boolean; transcribe?: boolean; translate?: boolean; survey?: boolean; synthetic_caller?: boolean }

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const callId = body?.callId
    const modulations: Modulations = body?.modulations ?? {}

    if (!callId || typeof callId !== 'string') {
      return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'callId required' } }, { status: 400 })
    }

    // fetch call to resolve organization
    const { data: callRows, error: callErr } = await supabaseAdmin.from('calls').select('id,organization_id').eq('id', callId).limit(1)
    if (callErr) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch call' } }, { status: 500 })
    const call = callRows?.[0]
    if (!call) return NextResponse.json({ success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } }, { status: 404 })

    const organization_id = call.organization_id

    // session lookup (best-effort)
    let actorId: string | null = null
    try {
      const session = await getServerSession()
      actorId = session?.user?.id ?? null
    } catch (_) {
      actorId = null
    }

    // sanitize modulations: only accept known keys and boolean values
    const allowedKeys = ['record', 'transcribe', 'translate', 'survey', 'synthetic_caller']
    const safeConfig: Record<string, boolean> = {}
    for (const k of allowedKeys) {
      const v = (modulations as any)[k]
      if (typeof v === 'boolean') safeConfig[k] = v
    }

    // write audit intent
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id,
        user_id: actorId,
        system_id: null,
        resource_type: 'calls',
        resource_id: callId,
        action: 'intent:modulations_update',
        before: null,
        after: { config: safeConfig, requested_at: new Date().toISOString() },
        created_at: new Date().toISOString()
      })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: { code: 'AUDIT_WRITE_FAILED', message: String(e?.message ?? e) } }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    const e = new AppError({ code: 'MODULATION_INTENT_ERROR', message: err?.message ?? 'Unexpected', user_message: 'Failed to record modulation intent', severity: 'HIGH', retriable: true })
    return NextResponse.json({ success: false, error: { id: e.id, code: e.code, message: e.user_message } }, { status: 500 })
  }
}
