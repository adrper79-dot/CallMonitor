
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.vercel/.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugTranscriptions() {
    console.log('--- Debugging Transcription Issues ---')
    // 9:55 PM Jan 19 2026 EST is approx Jan 20 02:55 UTC
    const since = new Date('2026-01-19T21:55:00-05:00').toISOString()
    console.log(`Checking for calls since ${since}`)

    // 1. Get recent calls from audit_logs (calls has no created_at)
    const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('resource_id, created_at, action')
        .eq('resource_type', 'calls')
        // Look for intent starting or creation
        .in('action', ['create', 'intent:call_start'])
        .gt('created_at', since)
        .order('created_at', { ascending: false })

    if (logsError) {
        console.error('Error fetching audit logs:', logsError)
        return
    }

    const allIds = logs?.map(l => l.resource_id).filter(Boolean) || []
    const callIds = allIds.filter((v, i, a) => a.indexOf(v) === i) as string[]
    console.log(`Found ${callIds.length} unique call IDs in audit logs`)

    if (callIds.length === 0) return

    // 2. Fetch Call Details
    const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('id, started_at, status, organization_id, call_sid')
        .in('id', callIds)

    if (callsError) {
        console.error('Error fetching calls:', callsError)
        return
    }

    for (const call of calls) {
        console.log(`\nCall ID: ${call.id}`)
        console.log(`  Started: ${call.started_at}`)
        console.log(`  Status: ${call.status}`)
        console.log(`  Org ID: ${call.organization_id}`)
        console.log(`  SID: ${call.call_sid}`)

        // 3. Check Voice Config
        const { data: vc } = await supabase
            .from('voice_configs')
            .select('transcribe, record')
            .eq('organization_id', call.organization_id)
            .single()

        console.log(`  Config: Transcribe=${vc?.transcribe}, Record=${vc?.record}`)

        if (!vc?.transcribe) {
            console.log('  -> Transcription NOT enabled for this org.')
            continue
        }

        // 4. Check Recordings
        const { data: recordings } = await supabase
            .from('recordings')
            .select('id, recording_url, created_at')
            .eq('call_id', call.id)

        if (recordings && recordings.length > 0) {
            recordings.forEach(r => {
                console.log(`  Recording Found: ${r.id} (Created: ${r.created_at})`)
                console.log(`  URL: ${r.recording_url}`)
            })
        } else {
            console.log('  -> NO Recordings found in DB.')
        }

        // 5. Check AI Runs
        const { data: aiRuns } = await supabase
            .from('ai_runs')
            .select('id, status, created_at, error, output')
            .eq('call_id', call.id)
            .eq('model', 'assemblyai-v1')

        if (aiRuns && aiRuns.length > 0) {
            aiRuns.forEach(run => {
                console.log(`  AI Run Found: ${run.id}`)
                console.log(`    Status: ${run.status}`)
                console.log(`    Created: ${run.created_at}`)
                if (run.error) console.log(`    Error:`, run.error)
                if (run.output) console.log(`    Output:`, JSON.stringify(run.output).substring(0, 100) + '...')
            })
        } else {
            // Double check if audit log has an error for AI_TRANSC_INSERT_FAILED
            const { data: errLogs } = await supabase
                .from('audit_logs')
                .select('after')
                .eq('resource_id', call.id) // might be strictly linked to call or ai_runs
                .eq('action', 'error')

            const transcErrors = errLogs?.filter(l => l.after?.code?.includes('TRANSC'))
            if (transcErrors && transcErrors.length > 0) {
                console.log('  -> Found Audit Log Errors related to transcription:', JSON.stringify(transcErrors))
            } else {
                console.log('  -> NO AI Runs found and NO explicit audit errors found.')
            }
        }
    }
}

debugTranscriptions().catch(e => {
    console.error(e)
    process.exit(1)
})
