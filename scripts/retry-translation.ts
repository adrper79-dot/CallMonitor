
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

const RUN_ID = '6b7ce756-1401-4d7a-b423-f48267ee3228';
const CALL_ID = 'b64559c9-1c7b-47d0-b947-a80b2765ffdd';

async function retryTranslation() {
    console.log(`Retrying translation for Run ID: ${RUN_ID}`);

    // 1. Get the Run
    const { data: runs, error: runError } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('id', RUN_ID)
        .single();

    if (runError || !runs) {
        console.error('Run not found:', runError);
        return;
    }
    const run = runs;
    console.log(`Current Status: ${run.status}`);

    // 2. Get Transcript Text from Completed Run DOING THE TRANSCRIPTION
    const { data: transcriptRuns } = await supabase
        .from('ai_runs')
        .select('output')
        .eq('call_id', CALL_ID)
        .eq('status', 'completed')
        .neq('model', 'assemblyai-translation-v1')
        .limit(1);

    if (!transcriptRuns || transcriptRuns.length === 0) {
        console.log('No completed transcript found to translate.');
        return;
    }
    const transcriptText = transcriptRuns[0].output?.transcript?.text || transcriptRuns[0].output?.text;
    console.log(`Transcript found (${transcriptText.length} chars).`);

    // 3. Call OpenAI
    const fromLang = run.output?.from_language || 'en';
    const toLang = run.output?.to_language || 'es';
    console.log(`Translating ${fromLang} -> ${toLang} using OpenAI (Chatbot)...`);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
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
        console.log('Translation Success!');
        console.log('Snippet:', translatedText.substring(0, 50) + '...');

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
                    status: 'completed',
                    error: null // clear previous error
                }
            })
            .eq('id', RUN_ID);

        if (updateError) {
            console.error('DB Update Error:', updateError);
        } else {
            console.log('DB Updated: Translation Saved.');
        }

    } catch (e: any) {
        console.error('Translation Exception:', e.message);
    }
}

retryTranslation().catch(console.error);
