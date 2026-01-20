
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

async function checkLiveConfig() {
    console.log(`Checking Live Translation Config for call: ${CALL_ID}`);

    const { data: call } = await supabase.from('calls').select('organization_id').eq('id', CALL_ID).single();

    if (call) {
        const { data: org } = await supabase.from('organizations').select('plan, id').eq('id', call.organization_id).single();
        const { data: vc } = await supabase.from('voice_configs').select('*').eq('organization_id', call.organization_id).single();

        console.log('--- Configuration Status ---');
        console.log(`Organization Plan: ${org?.plan}`);
        console.log(`Voice Config 'translate' (Post-Call): ${vc?.translate}`);
        console.log(`Voice Config 'live_translate' (AI Agent): ${vc?.live_translate}`);

        if (vc) {
            console.log(`Translate From: ${vc.translate_from}`);
            console.log(`Translate To: ${vc.translate_to}`);
        }
    } else {
        console.log('Call not found');
    }
}

checkLiveConfig().catch(console.error);
