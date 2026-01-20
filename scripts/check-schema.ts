
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

async function checkConfigs() {
    console.log('Checking voice_configs columns...');

    // Test select with both new and old column names
    const { data, error } = await supabase
        .from('voice_configs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        const row = data[0];
        console.log('Schema Check:');
        console.log('- translate_from exists:', 'translate_from' in row);
        console.log('- translate_to exists:', 'translate_to' in row);
        console.log('- translation_from exists:', 'translation_from' in row);
        console.log('- translation_to exists:', 'translation_to' in row);

        console.log('\nActual Data (first row):');
        console.log(JSON.stringify(row, null, 2));
    } else {
        console.log('No data found in voice_configs');
    }
}

checkConfigs().catch(console.error);
