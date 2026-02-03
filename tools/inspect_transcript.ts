
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

async function inspectTranscript() {
    const targetCallId = '7766e828-4038-41e9-a76d-23038bcc68d6'
    console.log(`Inspecting Call ID: ${targetCallId}`)

    // 1. Find the AI Runs for this call
    const { data: runs, error } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('call_id', targetCallId)

    if (error) {
        console.error('Error fetching AI Run:', error)
    }

    // Fallback: search by looking inside transcript_json in output if job_id match fails
    // Or just list recent completed runs

    if (runs && runs.length > 0) {
        console.log(`Found ${runs.length} AI Runs for Call ${targetCallId}:`)
        for (const r of runs) {
            console.log(`Run: ${r.model} | Status: ${r.status}`)
            if (r.status === 'completed') {
                console.log(`FULL OUTPUT:`, JSON.stringify(r.output, null, 2))
            }
            if (r.output?.error) {
                const err = r.output.error
                console.log(`ERROR: ${err.message || JSON.stringify(err)}`)
            }
        }
    } else {
        console.log('No AI Runs found.')
    }

    // Check Call Details
    const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('id', targetCallId)
        .single()

    if (call) {
        console.log(`\nCall Details:`)
        console.log(`Created: ${call.created_at}`)
        console.log(`Started: ${call.started_at}`)
        console.log(`Ended: ${call.ended_at}`)

        // Check Recording Detail
        const { data: recs } = await supabase
            .from('recordings')
            .select('*')
            .eq('call_id', targetCallId)

        console.log(`\nFound ${recs ? recs.length : 0} Recordings:`)
        recs?.forEach(r => {
            console.log(`- ID: ${r.id}`)
            console.log(`  URL: ${r.recording_url}`)
            console.log(`  CallSID: ${r.call_sid}`)
            console.log(`  RecSID: ${r.recording_sid}`)
            console.log(`  Status: ${r.status}`)
            console.log(`  Duration: ${r.duration_seconds}s`)
            console.log(`  Size: ${r.size_bytes}`)
            console.log(`  Channels: ${r.channels}`)
        })
    }
}

inspectTranscript().catch(console.error)
