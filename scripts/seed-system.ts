
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

async function seedSystem() {
    console.log('Checking system-ai...');

    // Check if exists
    const { data: existing } = await supabase
        .from('systems')
        .select('*')
        .eq('key', 'system-ai')
        .limit(1);

    if (existing && existing.length > 0) {
        console.log('✅ system-ai already exists:', existing[0].id);
        return;
    }

    console.log('Seeding system-ai...');

    const { data: inserted, error } = await supabase
        .from('systems')
        .insert({
            id: uuidv4(),
            key: 'system-ai',
            description: 'AI System for Transcription and Translation'
        })
        .select();

    if (error) {
        console.error('❌ Failed to seed:', error);
    } else {
        console.log('✅ Created system-ai:', inserted[0].id);
    }
}

seedSystem().catch(console.error);
