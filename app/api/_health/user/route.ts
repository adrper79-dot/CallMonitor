import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

    const q = new URL(req.url).searchParams.get('email')
    if (!q) return NextResponse.json({ ok: false, error: 'missing email query param' }, { status: 400 })

    const supabase = createClient(url, key)
    const { data, error } = await supabase.from('users').select('id,organization_id,email,phone,role,created_at,is_admin,tenant_id,tool_id,created_by').eq('email', q).limit(1)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: Array.isArray(data) && data.length ? data[0] : null })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
