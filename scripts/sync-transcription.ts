
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

const RUN_ID = '10fc7553-fd25-4afa-904e-8b3b45e19d1e';

async function syncTranscription() {
    console.log(`Syncing transcription for Run ID: ${RUN_ID}`);

    // 1. Get Run Details
    const { data: run, error: runError } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('id', RUN_ID)
        .single();

    if (runError || !run) {
        console.error('Run not found:', runError);
        return;
    }

    const jobId = run.output?.job_id;
    if (!jobId) {
        console.error('No Job ID in run output');
        return;
    }
    console.log(`Found Job ID: ${jobId}`);

    // 2. Fetch from AssemblyAI
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    console.log('Fetching transcript...');
    const response = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
        headers: { 'Authorization': ASSEMBLYAI_API_KEY! }
    });

    if (!response.ok) {
        console.error('Failed to fetch transcript:', await response.text());
        return;
    }

    const transcript = await response.json();
    console.log(`Transcript status: ${transcript.status}`);

    if (transcript.status === 'completed') {
        // 3. Update AI Run
        await supabase.from('ai_runs').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            output: {
                ...run.output,
                transcript: transcript,
                status: 'completed'
            }
        }).eq('id', RUN_ID);
        console.log('AI Run updated to completed');

        // 4. Update Recording
        const { data: rec } = await supabase.from('recordings').select('id').eq('call_id', run.call_id).limit(1).single();
        if (rec) {
            await supabase.from('recordings').update({
                transcript_json: transcript,
                updated_at: new Date().toISOString()
            }).eq('id', rec.id);
            console.log('Recording updated with transcript');
        } else {
            console.log('No recording found for call_id');
        }

    } else {
        console.log('Transcript not valid/completed yet');
    }
}

syncTranscription().catch(console.error);
