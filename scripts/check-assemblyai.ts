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

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAssemblyAI() {
    console.log('=== ASSEMBLYAI TRANSCRIPTION DEBUG ===\n');

    // 1. Check environment
    console.log('1. ENVIRONMENT');
    console.log(`   ASSEMBLYAI_API_KEY: ${ASSEMBLYAI_API_KEY ? `${ASSEMBLYAI_API_KEY.slice(0, 8)}...` : '❌ MISSING'}`);
    console.log(`   NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL || '❌ MISSING'}`);
    console.log(`   Webhook URL would be: ${NEXT_PUBLIC_APP_URL}/api/webhooks/assemblyai`);

    // 2. Check recent ai_runs for AssemblyAI jobs
    console.log('\n2. RECENT ASSEMBLYAI JOBS');
    const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('id, call_id, model, status, output, started_at, created_at')
        .eq('model', 'assemblyai-v1')
        .order('created_at', { ascending: false })
        .limit(5);

    if (aiRuns && aiRuns.length > 0) {
        aiRuns.forEach((run, i) => {
            const output = run.output as any;
            console.log(`\n   Job ${i + 1}:`);
            console.log(`     ID: ${run.id}`);
            console.log(`     Call: ${run.call_id}`);
            console.log(`     Status: ${run.status}`);
            console.log(`     AssemblyAI Job ID: ${output?.job_id || output?.id || 'NOT SET'}`);
            console.log(`     Created: ${run.created_at}`);
            if (output?.error) {
                console.log(`     Error: ${output.error}`);
            }
        });
    } else {
        console.log('   No AssemblyAI jobs found');
    }

    // 3. Test AssemblyAI API connectivity
    console.log('\n3. TESTING ASSEMBLYAI API');
    if (!ASSEMBLYAI_API_KEY) {
        console.log('   ❌ Cannot test - API key missing');
        return;
    }

    try {
        // Check API key validity by getting account info
        const response = await fetch('https://api.assemblyai.com/v2/transcript?limit=1', {
            method: 'GET',
            headers: {
                'Authorization': ASSEMBLYAI_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ API key is valid');
            console.log(`   Recent transcripts in account: ${data.transcripts?.length || 0}`);

            // Check the most recent transcript
            if (data.transcripts && data.transcripts.length > 0) {
                const recent = data.transcripts[0];
                console.log(`\n   Most recent AssemblyAI transcript:`);
                console.log(`     ID: ${recent.id}`);
                console.log(`     Status: ${recent.status}`);
                console.log(`     Created: ${recent.created}`);
                console.log(`     Audio URL: ${recent.audio_url?.slice(0, 50)}...`);
            }
        } else {
            const error = await response.text();
            console.log(`   ❌ API error: ${response.status}`);
            console.log(`   Response: ${error}`);
        }
    } catch (err: any) {
        console.log(`   ❌ Connection error: ${err.message}`);
    }

    // 4. Check a specific queued job
    console.log('\n4. CHECKING SPECIFIC QUEUED JOB');
    const queuedJob = aiRuns?.find(r => r.status === 'queued' || r.status === 'processing');
    if (queuedJob) {
        const output = queuedJob.output as any;
        const jobId = output?.job_id || output?.id;

        if (jobId) {
            console.log(`   Checking job: ${jobId}`);
            try {
                const jobResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
                    headers: { 'Authorization': ASSEMBLYAI_API_KEY }
                });

                if (jobResponse.ok) {
                    const jobData = await jobResponse.json();
                    console.log(`   AssemblyAI Status: ${jobData.status}`);
                    console.log(`   Error: ${jobData.error || 'None'}`);

                    if (jobData.status === 'completed') {
                        console.log(`   ⚠️  Job is COMPLETED on AssemblyAI but webhook not received!`);
                        console.log(`   This indicates webhook URL issue.`);
                    } else if (jobData.status === 'error') {
                        console.log(`   ❌ Job FAILED: ${jobData.error}`);
                    }
                } else {
                    console.log(`   ❌ Could not fetch job: ${jobResponse.status}`);
                }
            } catch (err: any) {
                console.log(`   ❌ Error: ${err.message}`);
            }
        } else {
            console.log('   ⚠️  Job has no AssemblyAI job_id - submission may have failed');
        }
    } else {
        console.log('   No queued jobs to check');
    }

    // 5. Diagnosis
    console.log('\n=== DIAGNOSIS ===');

    const stuckJobs = aiRuns?.filter(r => r.status === 'queued');
    const hasJobIds = stuckJobs?.filter(r => (r.output as any)?.job_id);

    if (stuckJobs && stuckJobs.length > 0) {
        if (hasJobIds && hasJobIds.length === 0) {
            console.log('⚠️  Jobs exist but have no job_id - AssemblyAI submission is failing');
            console.log('   Check: Recording URL accessibility from your server');
        } else if (hasJobIds && hasJobIds.length > 0) {
            console.log('⚠️  Jobs have job_ids but remain queued - webhook not received');
            console.log('   Possible causes:');
            console.log('   1. NEXT_PUBLIC_APP_URL is not accessible from internet');
            console.log('   2. Firewall blocking incoming webhooks');
            console.log('   3. Webhook endpoint has an error');
        }
    }
}

checkAssemblyAI().catch(console.error);
