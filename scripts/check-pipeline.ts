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

async function checkPipeline() {
    console.log('=== SUPABASE PIPELINE CHECK ===\n');

    // 1. Check organizations
    console.log('1. ORGANIZATIONS');
    const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, plan')
        .limit(5);
    console.table(orgs);

    // 2. Check voice_configs
    console.log('\n2. VOICE_CONFIGS');
    const { data: configs } = await supabase
        .from('voice_configs')
        .select('organization_id, transcribe, live_translate, translation_from, translation_to, record, survey')
        .limit(5);
    console.table(configs);

    // 3. Check recent recordings
    console.log('\n3. RECENT RECORDINGS (last 5)');
    const { data: recordings } = await supabase
        .from('recordings')
        .select('id, call_id, recording_url, duration_seconds, status, transcript_json, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    const recordingSummary = recordings?.map(r => ({
        id: r.id?.slice(0, 8) + '...',
        call_id: r.call_id?.slice(0, 8) + '...',
        has_url: !!r.recording_url,
        duration: r.duration_seconds,
        status: r.status,
        has_transcript: !!r.transcript_json,
        created: new Date(r.created_at).toLocaleString()
    }));
    console.table(recordingSummary);

    // 4. Check ai_runs
    console.log('\n4. AI_RUNS (last 10)');
    const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('id, call_id, model, status, output, created_at, started_at')
        .order('created_at', { ascending: false })
        .limit(10);

    const aiRunSummary = aiRuns?.map(r => ({
        id: r.id?.slice(0, 8) + '...',
        call_id: r.call_id?.slice(0, 8) + '...',
        model: r.model,
        status: r.status,
        has_output: !!r.output,
        job_id: (r.output as any)?.job_id?.slice(0, 12) || 'N/A',
        created: new Date(r.created_at).toLocaleString()
    }));
    console.table(aiRunSummary);

    // 5. Check if any ai_runs have job_id
    console.log('\n5. AI_RUNS WITH JOB_ID (AssemblyAI jobs)');
    const { data: jobRuns } = await supabase
        .from('ai_runs')
        .select('id, status, output')
        .eq('model', 'assemblyai-v1')
        .not('output', 'is', null)
        .limit(5);

    jobRuns?.forEach(r => {
        console.log(`  Run ${r.id.slice(0, 8)}: status=${r.status}, job_id=${(r.output as any)?.job_id || 'MISSING'}`);
    });

    // 6. Check recent calls
    console.log('\n6. RECENT CALLS (last 5)');
    const { data: calls } = await supabase
        .from('calls')
        .select('id, organization_id, status, type, started_at, ended_at')
        .order('created_at', { ascending: false })
        .limit(5);

    const callSummary = calls?.map(c => ({
        id: c.id?.slice(0, 8) + '...',
        org_id: c.organization_id?.slice(0, 8) + '...',
        status: c.status,
        type: c.type,
        duration: c.started_at && c.ended_at ?
            Math.round((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000) + 's' :
            'N/A'
    }));
    console.table(callSummary);

    // 7. Diagnosis
    console.log('\n=== DIAGNOSIS ===');

    const stuckJobs = aiRuns?.filter(r => r.model === 'assemblyai-v1' && r.status === 'queued');
    if (stuckJobs && stuckJobs.length > 0) {
        console.log(`⚠️  ${stuckJobs.length} AssemblyAI jobs stuck in 'queued' status`);
        console.log('   This means AssemblyAI webhook is NOT being received');
        console.log('   Possible causes:');
        console.log('   - AssemblyAI webhook URL is wrong');
        console.log('   - AssemblyAI API key is invalid');
        console.log('   - NEXT_PUBLIC_APP_URL not accessible from internet');
    }

    const noTranscripts = recordings?.filter(r => !r.transcript_json);
    if (noTranscripts && noTranscripts.length === recordings?.length) {
        console.log('❌ No recordings have transcripts');
    }

    const configMissing = configs?.filter(c => !c.translation_from || !c.translation_to);
    if (configMissing && configMissing.length > 0) {
        console.log('❌ Voice configs missing translation_from or translation_to');
        configMissing.forEach(c => {
            console.log(`   Org ${c.organization_id?.slice(0, 8)}: from=${c.translation_from || 'NULL'}, to=${c.translation_to || 'NULL'}`);
        });
    }
}

checkPipeline().catch(console.error);
