
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

async function checkLatestCall() {
    console.log('Fetching latest call...')

    // Get latest call
    const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(1)

    if (error) {
        console.error('Error fetching calls:', error)
        return
    }

    if (!calls || calls.length === 0) {
        console.log('No calls found.')
        return
    }

    const call = calls[0]
    console.log('Latest Call:', call)
    console.log(`Call ID: ${call.id}`)
    console.log(`Status: ${call.status}`)
    console.log(`Created At: ${call.created_at}`)
    console.log(`Started At: ${call.started_at}`)
    console.log(`Ended At: ${call.ended_at}`)

    // Check AI Runs for this call
    const { data: aiRuns, error: aiError } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('call_id', call.id)

    if (aiError) {
        console.error('Error fetching AI runs:', aiError)
    } else {
        console.log(`AI Runs found: ${aiRuns.length}`)
        aiRuns.forEach(run => {
            console.log(` - Run ID: ${run.id}, Status: ${run.status}, Model: ${run.model}`)
        })
    }

    // Check Audit Logs for this call
    const { data: logs, error: logError } = await supabase
        .from('audit_logs')
        .select('*')
        .or(`resource_id.eq.${call.id},after.cs.{"call_id":"${call.id}"}`)
        .order('created_at', { ascending: false })
        .limit(10)

    if (logError) {
        console.error('Error fetching audit logs:', logError)
    } else {
        console.log(`Audit Logs found: ${logs.length}`)
        logs.forEach(log => {
            console.log(`[${log.created_at}] ${log.resource_type}:${log.action}`)
            if (log.action === 'error') {
                console.log('  ERROR:', log.before)
            }
        })
    }

    // GLOBAL ACTIVITY CHECK
    console.log('\n--- RECENT GLOBAL ACTIVITY ---')
    const { data: globalLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    globalLogs?.forEach(log => {
        console.log(`[${log.created_at}] ${log.resource_type}:${log.action} (ID: ${log.resource_id})`)
    })
}

checkLatestCall().catch(console.error)
