import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Overrides = {
  emailEnabled?: boolean | null
}

function getOverrides(): Overrides {
  if (!(global as any).__authProviderOverrides) (global as any).__authProviderOverrides = {}
  return (global as any).__authProviderOverrides
}

export async function GET() {
  try {
    const adapterEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    const resendEnv = Boolean(process.env.RESEND_API_KEY)
    const nextauthSecret = Boolean(process.env.NEXTAUTH_SECRET)
    const overrides = getOverrides()
    const effectiveEmailEnabled = typeof overrides.emailEnabled === 'boolean' ? overrides.emailEnabled : (adapterEnv && resendEnv)
    return NextResponse.json({ ok: true, adapterEnv, resendEnv, nextauthSecret, overrides, effectiveEmailEnabled })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminKey = process.env.ADMIN_API_KEY
    if (adminKey) {
      const provided = req.headers.get('x-admin-key') || ''
      if (provided !== adminKey) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    const overrides = getOverrides()
    const before = { ...overrides }

    if (Object.prototype.hasOwnProperty.call(body, 'emailEnabled')) {
      const val = body.emailEnabled
      overrides.emailEnabled = val === null ? undefined : Boolean(val)
    }

    // Audit log: Auth Provider Change
    try {
      await query(
        `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, before, after, created_at)
         VALUES ($1, null, null, 'system_config', 'auth_providers', 'admin:config.update', 'system', 'admin-api', $2, $3, NOW())`,
        [
          uuidv4(),
          JSON.stringify(before),
          JSON.stringify(overrides)
        ]
      )
    } catch (auditErr) {
      logger.error('Admin auth-providers: Failed to write audit log', auditErr)
    }

    return NextResponse.json({ ok: true, overrides })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
