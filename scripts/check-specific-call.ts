
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CALL_ID = 'b0d66494-bde3-44e8-9e5e-51ed583b6a60';

async function checkCallStatus() {
    console.log(`=== CHECKING CALL: ${CALL_ID} ===\n`);

    // 1. Check Call
    const { data: call, error: callError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', CALL_ID)
        .single();

    if (callError) {
        console.log('❌ Call not found or error:', callError.message);
        return;
    }
    console.log(`Call Status: ${call.status}`);
    console.log(`Started: ${call.started_at}`);
    console.log(`Ended: ${call.ended_at}`);
    console.log(`SID: ${call.call_sid}`);

    // 2. Check Recording
    const { data: recordings } = await supabase
        .from('recordings')
        .select('*')
        .eq('call_id', CALL_ID);

    console.log('\n--- Recordings ---');
    if (recordings && recordings.length > 0) {
        recordings.forEach(rec => {
            console.log(`ID: ${rec.id}`);
            console.log(`Status: ${rec.status}`);
            console.log(`Duration: ${rec.duration_seconds} seconds`);
            console.log(`URL: ${rec.recording_url ? 'YES' : 'NO'}`);
        });
    } else {
        console.log('❌ No recordings found');
    }

    // 3. Check AI Runs (Transcription/Translation)
    const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('call_id', CALL_ID)
        .order('created_at', { ascending: true });

    console.log('\n--- AI Runs ---');
    if (aiRuns && aiRuns.length > 0) {
        aiRuns.forEach(run => {
            console.log(`Model: ${run.model}`);
            console.log(`Status: ${run.status}`);
            console.log(`Created: ${run.created_at}`);
            if (run.output) {
                console.log(`Output keys: ${Object.keys(run.output).join(', ')}`);
                if (run.output.error) console.log(`Error: ${JSON.stringify(run.output.error)}`);
            }
        });
    } else {
        console.log('❌ No AI runs found');
    }
}

checkCallStatus().catch(console.error);
