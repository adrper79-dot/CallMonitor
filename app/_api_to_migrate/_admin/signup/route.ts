import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { ApiErrors } from '@/lib/errors/apiHandler'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Admin Signup API
 * 
 * SECURITY: Requires ADMIN_API_KEY authentication
 * This endpoint creates users directly via Supabase Auth Admin API
 * Only use for internal/admin operations
 */
export async function POST(req: Request) {
  try {
    // CRITICAL SECURITY: Require ADMIN_API_KEY authentication
    const adminKey = process.env.ADMIN_API_KEY
    if (!adminKey) {
      logger.error('Admin signup: ADMIN_API_KEY not configured')
      return ApiErrors.internal('Admin endpoint not configured. Set ADMIN_API_KEY in environment.')
    }

    const providedKey = req.headers.get('x-admin-key') || req.headers.get('X-Admin-Key') || ''
    if (providedKey !== adminKey) {
      logger.warn('Admin signup: Unauthorized access attempt', {
        hasKey: !!providedKey,
        source: req.headers.get('x-forwarded-for') || 'unknown'
      })
      return ApiErrors.unauthorized()
    }

    const body = await req.json()
    const email = body?.email
    const password = body?.password
    const name = body?.name
    const organization_id = body?.organization_id
    const role = body?.role

    if (!email || !password) return ApiErrors.badRequest('email and password required')

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return ApiErrors.internal('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured')

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
      return ApiErrors.badRequest(data?.message ?? data)
    }

    // Audit log: Admin User Creation
    try {
      if (organization_id) {
        await query(
          `INSERT INTO audit_logs (id, organization_id, user_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
           VALUES ($1, $2, null, 'user', $3, 'admin:user.create', 'system', 'admin-api', $4, NOW())`,
          [
            uuidv4(),
            organization_id,
            data.id,
            JSON.stringify({ email, role, name })
          ]
        )
      }
    } catch (auditErr) {
      logger.error('Admin signup: Failed to write audit log', auditErr)
    }

    return NextResponse.json({ ok: true, user: data })
  } catch (err: any) {
    return ApiErrors.internal(err)
  }
}
