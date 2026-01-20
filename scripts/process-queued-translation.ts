
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

async function processTranslation() {
    console.log(`Processing queued translation for call: ${CALL_ID}`);

    // 1. Find Queued Run
    const { data: runs } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('call_id', CALL_ID)
        .eq('model', 'assemblyai-translation-v1') // or 'assemblyai-translation' - script showed 'assemblyai-translation-v1'
        .eq('status', 'queued')
        .limit(1);

    if (!runs || runs.length === 0) {
        console.log('No queued translation run found.');
        return;
    }
    const run = runs[0];
    console.log(`Found Run ID: ${run.id}`);

    // 2. Get Transcript Text from Completed Run
    const { data: transcriptRuns } = await supabase
        .from('ai_runs')
        .select('output')
        .eq('call_id', CALL_ID)
        .eq('status', 'completed')
        .neq('model', 'assemblyai-translation-v1') // Exclude translation itself
        .limit(1);

    if (!transcriptRuns || transcriptRuns.length === 0) {
        console.log('No completed transcript found.');
        return;
    }
    const transcriptText = transcriptRuns[0].output?.transcript?.text || transcriptRuns[0].output?.text;
    if (!transcriptText) {
        console.log('No text in transcript output.');
        return;
    }
    console.log(`Transcript Length: ${transcriptText.length} chars`);

    // 3. Call OpenAI
    const fromLang = run.output?.from_language || 'en';
    const toLang = run.output?.to_language || 'es';
    console.log(`Translating ${fromLang} -> ${toLang}`);

    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY missing');
        return;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Use fast model
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional translator. Translate the following text from ${fromLang} to ${toLang}. Only return the translated text, no explanations.`
                    },
                    { role: 'user', content: transcriptText }
                ],
                temperature: 0.3
            })
        });

        if (!response.ok) {
            console.error('OpenAI Error:', await response.text());
            return;
        }

        const data = await response.json();
        const translatedText = data.choices[0].message.content.trim();
        console.log('Translation received.');

        // 4. Update DB
        const { error: updateError } = await supabase
            .from('ai_runs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                output: {
                    ...run.output,
                    translated_text: translatedText,
                    provider: 'openai',
                    status: 'completed'
                }
            })
            .eq('id', run.id);

        if (updateError) {
            console.error('DB Update Error:', updateError);
        } else {
            console.log('DB Updated Successfully!');
        }

    } catch (e: any) {
        console.error('Translation Exception:', e.message);
    }
}

processTranslation().catch(console.error);
