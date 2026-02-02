import { NextResponse } from 'next/server'
import { requireAuth, requireRole, success, Errors, parseRequestBody } from '@/lib/api/utils'
import { query } from '@/lib/pgClient'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { orgId } = ctx

        const { rows } = await query(
            `SELECT * FROM attention_policies 
             WHERE organization_id = $1 AND is_enabled = true 
             ORDER BY priority ASC`,
            [orgId]
        )

        return success({ policies: rows || [] })
    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}

export async function POST(req: Request) {
    try {
        // Require admin role for policy management
        const ctx = await requireRole(['owner', 'admin'])
        if (ctx instanceof NextResponse) return ctx
        const { orgId, userId } = ctx

        const body = await parseRequestBody(req)

        // Validate basics
        if (!body.name || !body.policy_type) {
            return Errors.badRequest('Missing name or policy_type')
        }

        // Validate policy_type
        const validTypes = ['quiet_hours', 'threshold', 'recurring_suppress', 'keyword_escalate', 'custom']
        if (!validTypes.includes(body.policy_type)) {
            return Errors.badRequest(`Invalid policy_type. Must be one of: ${validTypes.join(', ')}`)
        }

        // Prepare Record
        const policyId = uuidv4()

        const { rows } = await query(
            `INSERT INTO attention_policies (
                id, organization_id, name, description, policy_type, 
                policy_config, priority, is_enabled, created_by, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING *`,
            [
                policyId,
                orgId,
                body.name,
                body.description || null,
                body.policy_type,
                JSON.stringify(body.policy_config || {}),
                body.priority || 100,
                body.is_enabled ?? true,
                userId
            ]
        )

        return success({ policy: rows[0] })

    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
