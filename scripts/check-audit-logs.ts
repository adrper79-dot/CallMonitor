
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

const CALL_ID = '2bc51928-2ecd-4661-91f4-6e8edb8f0845';

async function checkAuditLogs() {
    console.log(`Checking Audit Logs for call: ${CALL_ID}`);

    const { data: audits, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource_id', CALL_ID)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching audit logs:', error);
        return;
    }

    if (audits && audits.length > 0) {
        console.log(`Found ${audits.length} audit logs:`);
        audits.forEach(log => {
            console.log(`[${log.created_at}] ${log.action}:`, JSON.stringify(log.after, null, 2));
        });
    } else {
        console.log('No audit logs found for this call ID.');
    }
}

checkAuditLogs().catch(console.error);
