
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

async function checkLatestCall() {
    console.log('Fetching latest call...');

    // Get latest call
    const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

    if (error || !calls || calls.length === 0) {
        console.error('❌ Failed to fetch calls:', error);
        return;
    }

    // Find the specific call
    const call = calls.find(c => c.id.startsWith('c03c32be')) || calls[0];
    console.log(`\n=== Call Details ===`);
    console.log(`ID: ${call.id}`);
    console.log(`Created: ${call.created_at}`);
    console.log(`Status: ${call.status}`);
    console.log(`SID: ${call.call_sid}`);

    // Get Recording
    const { data: recordings } = await supabase
        .from('recordings')
        .select('*')
        .eq('call_id', call.id);

    console.log(`\n=== Recordings ===`);
    if (recordings && recordings.length > 0) {
        recordings.forEach(r => {
            console.log(`ID: ${r.id}`);
            console.log(`Duration: ${r.duration_seconds}`);
            console.log(`URL: ${r.recording_url}`);
            console.log(`Status: ${r.status}`);
        });
    } else {
        console.log('❌ No recordings found');
    }

    // Get AI Runs
    const { data: runs } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('call_id', call.id);

    console.log(`\n=== AI Runs ===`);
    if (runs && runs.length > 0) {
        runs.forEach(r => {
            console.log(`ID: ${r.id}`);
            console.log(`Model: ${r.model}`);
            console.log(`Status: ${r.status}`);
            console.log(`Output:`, JSON.stringify(r.output).substring(0, 100));
        });
    } else {
        console.log('❌ No AI runs found');
    }
}

checkLatestCall().catch(console.error);
