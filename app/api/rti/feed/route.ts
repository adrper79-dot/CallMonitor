
import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { supabase } = ctx

        const url = new URL(req.url)
        const limit = parseInt(url.searchParams.get('limit') || '50')

        // Fetch decisions with their associated events
        // RLS ensures org isolation
        const { data, error } = await supabase
            .from('attention_decisions')
            .select('*, event:attention_events(*)')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return success({
            items: data.map(d => ({
                type: 'decision',
                ...d
            }))
        })
    } catch (err) {
        return Errors.serverError(err)
    }
}
