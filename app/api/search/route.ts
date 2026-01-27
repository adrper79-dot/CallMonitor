/**
 * GET /api/search
 * 
 * Search across indexed documents (calls, transcripts, notes).
 * NON-AUTHORITATIVE: For display only, not source of truth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import pgClient from '@/lib/pgClient'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'



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

        // Build dynamic SQL with parameterized values
        const clauses: string[] = ['organization_id = $1', 'is_current = true']
        const params: any[] = [orgId]
        let idx = 2

        if (sourceType) {
            clauses.push(`source_type = $${idx++}`)
            params.push(sourceType)
        }
        if (phoneNumber) {
            clauses.push(`phone_number ILIKE $${idx++}`)
            params.push(`%${phoneNumber}%`)
        }
        if (domain) {
            clauses.push(`domain = $${idx++}`)
            params.push(domain)
        }

        let ftClause = ''
        if (q) {
            // Use websearch_to_tsquery for websearch-style queries
            ftClause = `AND to_tsvector('english', coalesce(content, '')) @@ websearch_to_tsquery('english', $${idx})`
            params.push(q)
            idx++
        }

        const where = clauses.length ? `WHERE ${clauses.join(' AND ')} ${ftClause}` : ''

        const dataSql = `
            SELECT id, source_type, source_id, title, call_id, phone_number, domain, tags, indexed_at, version,
                   COUNT(*) OVER() AS total_count
            FROM search_documents
            ${where}
            ORDER BY indexed_at DESC
            LIMIT $${idx} OFFSET $${idx + 1}
        `
        params.push(limit, offset)

        const result = await pgClient.query(dataSql, params)
        const rows = result.rows || []
        const total = rows.length ? parseInt(rows[0].total_count, 10) : 0

        return NextResponse.json({
            success: true,
            results: rows,
            meta: {
                total,
                limit,
                offset,
                query: q,
                disclaimer: 'Search results are non-authoritative. Fetch canonical data for source of truth.'
            }
        })
    } catch (err: unknown) {
        logger.error('Search error', err instanceof Error ? err : new Error(String(err)))
        return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
    }
}
