import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'
import supabaseAdmin from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { orgId } = ctx

        const url = new URL(req.url)
        const limit = parseInt(url.searchParams.get('limit') || '10')

        const { data, error } = await supabaseAdmin
            .from('digests')
            .select('*')
            .eq('organization_id', orgId)
            .order('generated_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return success({ digests: data || [] })
    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
