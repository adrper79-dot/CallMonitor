import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = body?.email
    const password = body?.password
    const name = body?.name
    const organization_id = body?.organization_id
    const role = body?.role

    if (!email || !password) return NextResponse.json({ ok: false, error: 'email and password required' }, { status: 400 })

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })

    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users`
    const userMetadata: Record<string, any> = {}
    if (organization_id) userMetadata.organization_id = organization_id
    if (role) userMetadata.role = role
    if (name) userMetadata.name = name

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: Object.keys(userMetadata).length ? userMetadata : undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: data?.message ?? data }, { status: res.status })
    }

    return NextResponse.json({ ok: true, user: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
