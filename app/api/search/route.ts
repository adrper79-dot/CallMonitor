/**
 * GET /api/search
 * 
 * Search across indexed documents (calls, transcripts, notes).
 * NON-AUTHORITATIVE: For display only, not source of truth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.orgId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const orgId = session.user.orgId
        const { searchParams } = new URL(req.url)
        const q = searchParams.get('q') || ''
        const sourceType = searchParams.get('source_type')
        const phoneNumber = searchParams.get('phone')
        const domain = searchParams.get('domain')
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
        const offset = parseInt(searchParams.get('offset') || '0')

        let query = supabaseAdmin
            .from('search_documents')
            .select('id, source_type, source_id, title, call_id, phone_number, domain, tags, indexed_at, version', { count: 'exact' })
            .eq('organization_id', orgId)
            .eq('is_current', true)
            .order('indexed_at', { ascending: false })
            .range(offset, offset + limit - 1)

        // Apply filters
        if (sourceType) query = query.eq('source_type', sourceType)
        if (phoneNumber) query = query.ilike('phone_number', `%${phoneNumber}%`)
        if (domain) query = query.eq('domain', domain)

        // Full-text search using PostgreSQL text search
        if (q) {
            // Use websearch syntax for better UX
            query = query.textSearch('content', q, { type: 'websearch', config: 'english' })
        }

        const { data, error, count } = await query

        if (error) {
            logger.error('Search query failed', error)
            return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            results: data,
            meta: {
                total: count,
                limit,
                offset,
                query: q,
                // Explicit disclaimer per ARCH_DOCS
                disclaimer: 'Search results are non-authoritative. Fetch canonical data for source of truth.'
            }
        })
    } catch (err: unknown) {
        logger.error('Search error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
    }
}
