import { NextResponse } from 'next/server'
import pgClient from '@/lib/pgClient'

// Force dynamic rendering - health checks should always be fresh
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    try {
      const res = await pgClient.query('SELECT id FROM users LIMIT 1')
      const sample = res?.rows ? res.rows.length : 0
      return NextResponse.json({ ok: true, message: 'adapter reachable', sample })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
