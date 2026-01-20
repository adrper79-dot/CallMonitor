
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

async function markFailed() {
    console.log(`Marking run ${RUN_ID} as failed...`);
    const { error } = await supabase
        .from('ai_runs')
        .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            output: {
                error: 'OpenAI Insufficient Quota',
                details: 'You exceeded your current quota, please check your plan and billing details.'
            }
        })
        .eq('id', RUN_ID);

    if (error) {
        console.error('Error updating run:', error);
    } else {
        console.log('Run updated to failed.');
    }
}

markFailed().catch(console.error);
