
import { NextResponse } from 'next/server'
import { requireAuth, success, Errors } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { supabase } = ctx

        const url = new URL(req.url)
        const limit = parseInt(url.searchParams.get('limit') || '10')

        const { data, error } = await supabase
            .from('digests')
            .select('*')
            .order('generated_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return success({ digests: data })
    } catch (err) {
        return Errors.serverError(err)
    }
}
