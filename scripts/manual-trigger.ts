
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

async function triggerTranscription() {
    console.log(`Triggering transcription for call: ${CALL_ID}`);
    const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

    // 1. Get Recording
    const { data: recordings } = await supabase
        .from('recordings')
        .select('*')
        .eq('call_id', CALL_ID)
        .limit(1);

    if (!recordings || recordings.length === 0) {
        console.error('No recording found');
        return;
    }
    const recording = recordings[0];
    console.log('Recording found:', recording.id, recording.recording_url);

    // 2. Get AI System
    const { data: systems } = await supabase
        .from('systems')
        .select('id')
        .eq('key', 'system-ai')
        .single();

    if (!systems) {
        console.error('System system-ai not found');
        return;
    }
    console.log('System found:', systems.id);

    // 3. Create AI Run
    const aiRunId = uuidv4();
    const { error: insertError } = await supabase.from('ai_runs').insert({
        id: aiRunId,
        call_id: CALL_ID,
        system_id: systems.id,
        model: 'assemblyai-v1',
        status: 'queued',
        started_at: new Date().toISOString(),
        produced_by: 'model',
        is_authoritative: true
    });

    if (insertError) {
        console.error('Failed to create AI run:', insertError);
        return;
    }
    console.log('AI Run created:', aiRunId);

    // 4. Call AssemblyAI
    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
    console.log('Calling AssemblyAI with key:', ASSEMBLYAI_API_KEY ? 'UPDATED' : 'MISSING');

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
            'Authorization': ASSEMBLYAI_API_KEY!,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            audio_url: recording.recording_url,
            webhook_url: `${NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`,
            sentiment_analysis: true,
            entity_detection: true,
            auto_chapters: true,
            speaker_labels: true,
            content_safety: true,
            iab_categories: true,
            language_detection: true
        })
    });

    if (response.ok) {
        const data = await response.json();
        console.log('AssemblyAI Job Started:', data.id);

        await supabase.from('ai_runs').update({
            status: 'processing',
            output: { job_id: data.id, status: 'queued' }
        }).eq('id', aiRunId);

        console.log('AI Run updated to processing');
    } else {
        const error = await response.text();
        console.error('AssemblyAI failed:', error);
        await supabase.from('ai_runs').update({
            status: 'failed',
            output: { error: error }
        }).eq('id', aiRunId);
    }
}

triggerTranscription().catch(console.error);
