import { NextResponse } from 'next/server'
import { requireAuth, requireRole, success, Errors, parseRequestBody } from '@/lib/api/utils'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { orgId } = ctx

        const { data, error } = await supabaseAdmin
            .from('attention_policies')
            .select('*')
            .eq('organization_id', orgId)
            .eq('is_enabled', true)
            .order('priority', { ascending: true })

        if (error) throw error

        return success({ policies: data || [] })
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
        const policy = {
            id: policyId,
            organization_id: orgId,
            name: body.name,
            description: body.description || null,
            policy_type: body.policy_type,
            policy_config: body.policy_config || {},
            priority: body.priority || 100,
            is_enabled: body.is_enabled ?? true,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const { data, error } = await supabaseAdmin
            .from('attention_policies')
            .insert(policy)
            .select()
            .single()

        if (error) {
            if (error.code === '42501') return Errors.forbidden('Admin access required')
            throw error
        }

        return success({ policy: data })

    } catch (err) {
        return Errors.internal(err instanceof Error ? err : undefined)
    }
}
