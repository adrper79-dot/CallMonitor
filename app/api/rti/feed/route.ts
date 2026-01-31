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
        const limit = parseInt(url.searchParams.get('limit') || '50')

        // Fetch decisions with their associated events
        // Optimization: Use SQL JOIN instead of client-side join logic
        const { rows } = await query(
            `SELECT d.*, 
                    json_build_object(
                      'id', e.id,
                      'type', e.type,
                      'created_at', e.created_at,
                      'data', e.data
                    ) as event
             FROM attention_decisions d
             LEFT JOIN attention_events e ON d.event_id = e.id
             WHERE d.organization_id = $1
             ORDER BY d.created_at DESC
             LIMIT $2`,
            [orgId, limit]
        )

        return success({
            items: (rows || []).map((d: any) => ({
                type: 'decision',
                ...d
            }))
        })
    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
