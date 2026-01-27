import { NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'

// Force dynamic rendering - uses request.url
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const conn = process.env.NEON_PG_CONN || process.env.PG_CONN || process.env.DATABASE_URL
    if (!conn) return NextResponse.json({ ok: false, error: 'Postgres connection not configured (set NEON_PG_CONN or PG_CONN)' }, { status: 500 })

    const q = new URL(req.url).searchParams.get('email')
    if (!q) return NextResponse.json({ ok: false, error: 'missing email query param' }, { status: 400 })

    const res = await pgClient.query(
      `SELECT id, organization_id, email, phone, role, created_at, is_admin, tenant_id, tool_id, created_by
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [q]
    )

    const row = res?.rows && res.rows.length ? res.rows[0] : null
    return NextResponse.json({ ok: true, result: row })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
