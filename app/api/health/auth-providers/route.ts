import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const adapterEnv = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY)
    const resendEnv = Boolean(process.env.RESEND_API_KEY)
    const nextauthSecret = Boolean(process.env.NEXTAUTH_SECRET)
    const googleEnv = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    return NextResponse.json({ ok: true, adapterEnv, resendEnv, nextauthSecret, googleEnv })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
