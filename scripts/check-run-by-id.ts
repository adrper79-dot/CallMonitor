
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

async function checkRun() {
    console.log(`Checking AI Run: ${RUN_ID}`);
    const { data: run, error } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('id', RUN_ID)
        .single();

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    if (run) {
        console.log('Run Found!');
        console.log('Call ID:', run.call_id);
        console.log('Status:', run.status);
    } else {
        console.log('Run NOT found');
    }
}

checkRun().catch(console.error);
