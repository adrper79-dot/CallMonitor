
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

// Mock logger to avoid import issues or complex dependencies
// We need to hijack the module cache for '@/lib/logger' if possible, or just hope it imports clean.
// Using tsconfig-paths should resolve it. But let's hope logger is simple.

import { translateText } from '@/app/services/translation';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('🔍 Finding a call with transcript to translate...');

    // 1. Find a call with a transcript in 'recordings'
    let { data: recordings, error } = await supabase
        .from('recordings')
        .select('call_id, transcript_json, organization_id, recording_url')
        .not('transcript_json', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

    let sourceText = '';
    let callId = '';
    let organizationId = '';
    let recordingUrl = undefined;

    if (recordings && recordings.length > 0) {
        const rec = recordings[0];
        console.log(`✅ Found recording for call: ${rec.call_id}`);
        callId = rec.call_id;
        organizationId = rec.organization_id;
        recordingUrl = rec.recording_url;
        sourceText = rec.transcript_json?.text || '';
    } else {
        // Fallback to ai_runs
        console.log('No recordings with transcript found. Checking ai_runs...');
        const { data: runs } = await supabase
            .from('ai_runs')
            .select('call_id, output, call:calls(organization_id)')
            .eq('status', 'completed')
            .not('output->transcript', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (runs && runs.length > 0) {
            const run = runs[0];
            callId = run.call_id;
            organizationId = (run.call as any)?.organization_id;
            sourceText = (run.output as any)?.transcript?.text || '';
            console.log(`✅ Found ai_run transcript for call: ${callId}`);
        } else {
            console.log('⚠️ No transcripts found. Generating DUMMY data for testing...');

            // 1. Get an organization
            const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
            if (!orgs || orgs.length === 0) {
                console.error('❌ No organizations found. Cannot create dummy data.');
                process.exit(1);
            }
            organizationId = orgs[0].id;
            callId = crypto.randomUUID();

            console.log(`   Using Org ID: ${organizationId}`);
            console.log(`   Creating dummy Call ID: ${callId}`);

            // 2. Create dummy call
            // Detect column names first
            const { data: sampleCalls } = await supabase.from('calls').select('*').limit(1);
            let fromCol = 'phone_from';
            let toCol = 'phone_to';

            if (sampleCalls && sampleCalls.length > 0) {
                const keys = Object.keys(sampleCalls[0]);
                console.log('   Detected Call Columns:', keys.join(', '));
                if (keys.includes('from_number')) fromCol = 'from_number';
                if (keys.includes('to_number')) toCol = 'to_number';
            } else {
                console.log('   Table empty, guessing columns: phone_from/phone_to based on error');
                // If previous error said phone_from missing, try from_number
                fromCol = 'from_number';
                toCol = 'to_number';
            }

            const callData: any = {
                id: callId,
                organization_id: organizationId,
                status: 'completed',
                type: 'inbound',
                started_at: new Date().toISOString(),
                ended_at: new Date().toISOString(),
            };
            callData[fromCol] = '+15550001111';
            callData[toCol] = '+15550002222';

            const { error: callError } = await supabase.from('calls').insert(callData);

            if (callError) {
                console.error('❌ Failed to create dummy call:', callError);
                // Last ditch effort: Try basic schema
                console.log('   Retrying with minimal schema...');
                const minimalData: any = {
                    id: callId,
                    organization_id: organizationId,
                    status: 'completed'
                };
                const { error: retryError } = await supabase.from('calls').insert(minimalData);
                if (retryError) {
                    console.error('❌ Retry failed:', retryError);
                    process.exit(1);
                }
            }
            console.log('   ✅ Dummy call created.');

            sourceText = "Hello, this is a test call to verify the translation logic works correctly. We hope this message translates well into Spanish.";
            console.log(`   Using dummy transcript text.`);
        }
    }

    if (!sourceText) {
        console.error('❌ Transcript found but text is empty.');
        process.exit(1);
    }

    console.log(`📝 Source Text (${sourceText.length} chars): "${sourceText.substring(0, 50)}..."`);

    // 2. Prepare Translation Input
    const translationRunId = crypto.randomUUID();
    const toLanguage = 'es'; // Target Spanish
    const fromLanguage = 'en';

    console.log(`🚀 Triggering translation to ${toLanguage}...`);
    console.log(`   Run ID: ${translationRunId}`);

    // Create the ai_run entry (required by translateText to update status)
    const { error: insertError } = await supabase
        .from('ai_runs')
        .insert({
            id: translationRunId,
            call_id: callId,
            model: 'test-translation-script',
            status: 'queued',
            started_at: new Date().toISOString(),
            output: {
                from_language: fromLanguage,
                to_language: toLanguage,
                source_text: sourceText,
                triggered_by: 'manual_test_script'
            }
        });

    if (insertError) {
        console.error('Failed to create ai_run:', insertError);
        process.exit(1);
    }

    try {
        await translateText({
            callId,
            translationRunId,
            text: sourceText,
            fromLanguage,
            toLanguage,
            organizationId,
            recordingUrl,
            useVoiceCloning: false // Disable cloning for simple logic test
        });

        console.log('✅ translateText function returned. Polling for result...');
    } catch (e: any) {
        console.error('❌ translateText threw error:', e);
        process.exit(1);
    }

    // 3. Poll for result
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const { data: run } = await supabase
            .from('ai_runs')
            .select('status, output')
            .eq('id', translationRunId)
            .single();

        if (run) {
            console.log(`   Status: ${run.status}`);
            if (run.status === 'completed') {
                console.log('\n✅ Translation Completed!');
                console.log('Translated Text:', (run.output as any)?.translated_text);
                console.log('Audio URL:', (run.output as any)?.translated_audio_url || 'None');

                // Cleanup (optional)
                // await supabase.from('ai_runs').delete().eq('id', translationRunId);
                break;
            } else if (run.status === 'failed') {
                console.error('\n❌ Translation Failed!');
                console.error('Error:', (run.output as any)?.error);
                break;
            }
        }
    }
}

main().catch(console.error);
