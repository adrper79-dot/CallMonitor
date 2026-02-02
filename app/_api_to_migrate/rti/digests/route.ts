import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'
import { query } from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { orgId } = ctx

        const url = new URL(req.url)
        const limitStr = url.searchParams.get('limit') || '10'
        const limit = Math.min(parseInt(limitStr), 100) // Cap limit at 100

        const { rows } = await query(
            `SELECT * FROM digests 
             WHERE organization_id = $1 
             ORDER BY generated_at DESC 
             LIMIT $2`,
            [orgId, limit]
        )

        return success({ digests: rows || [] })
    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
