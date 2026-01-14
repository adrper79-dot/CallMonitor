/**
 * Fix Stuck Transcriptions
 * 
 * This script polls AssemblyAI for stuck transcription jobs and completes them.
 * Run: node scripts/fix-stuck-transcriptions.js
 * 
 * Requires: ASSEMBLYAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ASSEMBLYAI_API_KEY) {
  console.error('❌ ASSEMBLYAI_API_KEY not set');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials not set');
  process.exit(1);
}

async function main() {
  console.log('🔍 Fetching stuck transcription jobs...\n');

  // Get stuck jobs from Supabase
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ai_runs?model=eq.assemblyai-v1&status=eq.queued&select=id,output,call_id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch ai_runs:', await response.text());
    process.exit(1);
  }

  const stuckJobs = await response.json();
  console.log(`Found ${stuckJobs.length} stuck jobs\n`);

  for (const job of stuckJobs) {
    const jobId = job.output?.job_id;
    if (!jobId) {
      console.log(`⚠️  Job ${job.id} has no AssemblyAI job_id, skipping`);
      continue;
    }

    console.log(`📝 Checking AssemblyAI job: ${jobId}`);

    // Poll AssemblyAI for status
    const aaiResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
      headers: { 'Authorization': ASSEMBLYAI_API_KEY }
    });

    if (!aaiResponse.ok) {
      console.log(`   ❌ AssemblyAI API error: ${aaiResponse.status}`);
      continue;
    }

    const transcript = await aaiResponse.json();
    console.log(`   Status: ${transcript.status}`);

    if (transcript.status === 'completed') {
      console.log(`   ✅ Transcript ready! Updating database...`);

      // Update ai_runs with transcript
      const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${job.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output: {
            ...job.output,
            transcript: {
              text: transcript.text,
              confidence: transcript.confidence,
              words: transcript.words?.slice(0, 100), // First 100 words
              language_code: transcript.language_code
            },
            status: 'completed'
          }
        })
      });

      if (updateResponse.ok) {
        console.log(`   ✅ Database updated!`);

        // Also update recordings table if we have call_id
        if (job.call_id) {
          // Get call_sid from calls table
          const callRes = await fetch(`${SUPABASE_URL}/rest/v1/calls?id=eq.${job.call_id}&select=call_sid`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
          });
          const callData = await callRes.json();
          const callSid = callData?.[0]?.call_sid;

          if (callSid) {
            // Update recording with transcript
            await fetch(`${SUPABASE_URL}/rest/v1/recordings?call_sid=eq.${callSid}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                transcript_json: {
                  text: transcript.text,
                  confidence: transcript.confidence,
                  language_code: transcript.language_code,
                  completed_at: new Date().toISOString()
                }
              })
            });
            console.log(`   ✅ Recording transcript updated!`);
          }
        }
      } else {
        console.log(`   ❌ Failed to update database: ${await updateResponse.text()}`);
      }
    } else if (transcript.status === 'error') {
      console.log(`   ❌ Transcription failed: ${transcript.error}`);
      
      // Mark as failed
      await fetch(`${SUPABASE_URL}/rest/v1/ai_runs?id=eq.${job.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'failed',
          completed_at: new Date().toISOString(),
          output: { ...job.output, error: transcript.error, status: 'error' }
        })
      });
    } else {
      console.log(`   ⏳ Still processing...`);
    }

    console.log('');
  }

  console.log('✅ Done!');
}

main().catch(console.error);
