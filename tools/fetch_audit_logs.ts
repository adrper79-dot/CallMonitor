
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAuditLogs() {
    const callId = process.argv[2]
    console.log(`Fetching audit logs${callId ? ` for call ${callId}` : ' (latest 10)'}...`)

    let query = supabase
        .from('audit_logs')
        .select('created_at, resource_type, action, before, after, resource_id')
        .order('created_at', { ascending: false })
        .limit(20)

    if (callId) {
        // Audit logs store call_id inside the 'after' JSONB column often, or resource_id is the call_id
        // We filter for resource_id = callId OR after->call_id = callId
        // Note: Supabase JS syntax for JSON filter involves .contains or .msg
        query = query.or(`resource_id.eq.${callId},after.cs.{"call_id":"${callId}"}`)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching logs:', error)
        return
    }

    if (data.length === 0) {
        console.log('No matching audit logs found.')
    } else {
        console.log(`Found ${data.length} Logs:`)
        data.forEach(log => {
            console.log(`[${log.created_at}] ${log.resource_type}:${log.action} (ID: ${log.resource_id})`)
            console.log('  After:', JSON.stringify(log.after).substring(0, 150) + '...')
            if (log.before && log.before.error) {
                console.log('  ERROR DETAILS:', log.before)
            }
        })
    }
}

checkAuditLogs().catch(console.error)
