
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

async function checkRuns() {
    console.log('Fetching last 10 AI runs...');
    const { data, error } = await supabase
        .from('ai_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching runs:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No AI runs found.');
        return;
    }

    data.forEach(run => {
        console.log('------------------------------------------------');
        console.log(`ID: ${run.id}`);
        console.log(`Call ID: ${run.call_id}`);
        console.log(`Model: ${run.model}`);
        console.log(`Status: ${run.status}`);
        console.log(`Created: ${run.created_at}`);
        console.log(`Output:`, JSON.stringify(run.output).substring(0, 100) + '...');
    });
}

checkRuns().catch(console.error);
