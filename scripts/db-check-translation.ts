
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

const CALL_ID = 'b64559c9-1c7b-47d0-b947-a80b2765ffdd';

async function checkTranslation() {
    console.log(`Checking AI runs for call: ${CALL_ID}`);
    // Select started_at instead of created_at
    const { data: runs, error } = await supabase
        .from('ai_runs')
        .select('id, model, status, started_at, output')
        .eq('call_id', CALL_ID)
        .order('started_at', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!runs || runs.length === 0) {
        console.log('No AI runs found.');
    } else {
        runs.forEach(run => {
            console.log('------------------------------------------------');
            console.log(`ID: ${run.id}`);
            console.log(`Model: ${run.model}`);
            console.log(`Status: ${run.status}`);
            console.log(`Started: ${run.started_at}`);
            if (run.output && run.output.error) {
                console.log(`Error: ${run.output.error}`);
            }
            if (run.output && (run.output.translated_text || run.output.translation)) {
                console.log('Translation content found in THIS run.');
            }
        });
    }

    // Check voice_configs for this call's org
    console.log('\nChecking Voice Config...');
    const { data: call } = await supabase.from('calls').select('organization_id').eq('id', CALL_ID).single();
    if (call) {
        const { data: vc } = await supabase.from('voice_configs').select('*').eq('organization_id', call.organization_id).single();
        if (vc) {
            console.log('Voice Config Translation Settings:', {
                translate: vc.translate,
                translation_enabled: vc.translation_enabled, // might be undefined
                translate_from: vc.translate_from,
                translate_to: vc.translate_to,
                translation_from: vc.translation_from,
                translation_to: vc.translation_to
            });
        } else {
            console.log('Voice Config not found');
        }
    }
}

checkTranslation().catch(console.error);
