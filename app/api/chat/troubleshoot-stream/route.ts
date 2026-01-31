
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { query } from '@/lib/pgClient'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

// Allow OpenNext/Node runtime to handle this, avoid strict Edge limitations
// export const runtime = 'edge' 

export async function POST(req: Request) {
    try {
        const { message, orgId } = await req.json()

        if (!orgId) return new Response('Missing orgId', { status: 400 })

        // Auth Check
        const session = await getServerSession(authOptions)
        if (!session?.user) return new Response('Unauthorized', { status: 401 })

        // Verify Admin Role
        const { rows: members } = await query(
            `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2`,
            [orgId, (session.user as any).id]
        )

        const role = members?.[0]?.role
        if (role !== 'owner' && role !== 'admin') {
            return new Response('Forbidden: Admins only', { status: 403 })
        }

        // Context: Fetch Audit Logs (High Severity)
        const { rows: errors } = await query(
            `SELECT * FROM audit_logs 
       WHERE organization_id = $1 
       AND (actor_label LIKE '%error%' OR action LIKE '%fail%') 
       ORDER BY created_at DESC LIMIT 10`,
            [orgId]
        )

        // Context: Simulate CLI Checks (R2)
        let checks = '{}'
        try {
            checks = JSON.stringify({ status: 'clean', last_check: new Date().toISOString() })
        } catch (e) {
            console.error('Failed to fetch CLI checks', e)
        }

        const systemPrompt = `You are a Stack Error Fix Agent for a Next.js + Neon + Cloudflare stack.
    Analyze the context and user query.
    
    Context:
    - Recent Errors: ${JSON.stringify(errors)}
    - CLI Checks: ${checks}
    
    Output strictly in YAML format:
    fixes:
      - command: '...'
        desc: '...'
      - sql: '...'
        desc: '...'
    
    No chit-chat.`

        const result = streamText({
            model: openai('gpt-4o-mini'),
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ]
        })

        return result.toDataStreamResponse()

    } catch (error: any) {
        console.error('API Error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
}
