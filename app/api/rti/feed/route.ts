import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'
import supabaseAdmin from '@/lib/supabaseAdmin'

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
        // Filter by organization for RLS compliance
        const { data, error } = await supabaseAdmin
            .from('attention_decisions')
            .select('*, event:attention_events(*)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return success({
            items: (data || []).map((d: any) => ({
                type: 'decision',
                ...d
            }))
        })
    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
