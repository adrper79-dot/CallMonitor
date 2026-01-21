
import { NextResponse } from 'next/server'
import { requireAuth, success, Errors, parseRequestBody } from '@/lib/api/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { supabase } = ctx

        const { data, error } = await supabase
            .from('attention_policies')
            .select('*')
            .eq('is_enabled', true)
            .order('priority', { ascending: true })

        if (error) throw error

        return success({ policies: data })
    } catch (err) {
        return Errors.serverError(err)
    }
}

export async function POST(req: Request) {
    try {
        const ctx = await requireAuth()
        if (ctx instanceof NextResponse) return ctx
        const { supabase, user } = ctx

        // RLS handles Admin check, but we can double check logic or rely on DB error
        const body = await parseRequestBody(req)

        // Validate basics
        if (!body.name || !body.policy_type) {
            return Errors.badRequest('Missing name or policy_type')
        }

        // Prepare Record
        const policy = {
            organization_id: body.organization_id, // RLS will override/check this
            name: body.name,
            description: body.description,
            policy_type: body.policy_type,
            policy_config: body.policy_config || {},
            priority: body.priority || 100,
            is_enabled: body.is_enabled ?? true,
            created_by: user.id
        }

        // Supabase RLS will ignore passed organization_id if it doesn't match? 
        // Usually best to let RLS handle it, or force it from session if we knew org_id.
        // Given the endpoint context usually implies 'current org', we assume `body.organization_id` 
        // corresponds to one the user is in. RLS policy 'attention_policies_insert_admin' checks membership.

        const { data, error } = await supabase
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
        return Errors.serverError(err)
    }
}
