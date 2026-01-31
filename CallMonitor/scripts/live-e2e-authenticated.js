#!/usr/bin/env node
/**
 * LIVE E2E TEST - Authenticated via Service Key
 * 
 * Prerequisites:
 * 1. Set SERVICE_API_KEY in Vercel environment variables
 * 2. Deploy the updated code to Vercel
 * 3. Run with: node scripts/live-e2e-authenticated.js <ORG_ID> <SERVICE_API_KEY>
 * 
 * Or set environment variables:
 *   $env:ORG_ID = "your-org-id"
 *   $env:SERVICE_API_KEY = "your-service-key"
 *   node scripts/live-e2e-authenticated.js
 */

const BASE_URL = process.env.BASE_URL || 'https://voxsouth.online'

const CONFIG = {
  fromNumber: '+17062677235',        // Agent/caller number
  toNumber: '+12392027345',          // Target number to call
  translateFrom: 'en',               // English
  translateTo: 'de',                 // German
  artifactEmail: 'adrper79@gmail.com'
}

const ORG_ID = process.argv[2] || process.env.ORG_ID || '143a4ad7-403c-4933-a0e6-553b05ca77a2'
const SERVICE_KEY = process.argv[3] || process.env.SERVICE_API_KEY

if (!SERVICE_KEY) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUTHENTICATED E2E TEST')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('  This test requires a SERVICE_API_KEY to authenticate.')
  console.log('')
  console.log('  Step 1: Add SERVICE_API_KEY to Vercel environment variables')
  console.log('          (any random 32+ character string)')
  console.log('')
  console.log('  Step 2: Deploy the latest code to Vercel')
  console.log('')
  console.log('  Step 3: Run this script:')
  console.log('    $env:SERVICE_API_KEY = "your-key-from-vercel"')
  console.log(`    node scripts/live-e2e-authenticated.js ${ORG_ID}`)
  console.log('')
  console.log('  Or pass as argument:')
  console.log(`    node scripts/live-e2e-authenticated.js ${ORG_ID} your-service-key`)
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  process.exit(1)
}

async function apiCall(action, params = {}) {
  const url = `${BASE_URL}/api/test/e2e`
  console.log(`  → POST ${url} (action: ${action})`)
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': SERVICE_KEY
      },
      body: JSON.stringify({
        action,
        organization_id: ORG_ID,
        params
      })
    })
    
    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUTHENTICATED LIVE E2E TEST')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Organization: ${ORG_ID}`)
  console.log(`  From: ${CONFIG.fromNumber}`)
  console.log(`  To: ${CONFIG.toNumber}`)
  console.log(`  Translation: ${CONFIG.translateFrom} → ${CONFIG.translateTo}`)
  console.log(`  Email: ${CONFIG.artifactEmail}`)
  console.log('═══════════════════════════════════════════════════════════════')

  // Step 1: Check endpoint availability
  console.log('\n🔍 Step 1: Check E2E Endpoint')
  try {
    const checkRes = await fetch(`${BASE_URL}/api/test/e2e`)
    const checkData = await checkRes.json()
    if (checkData.service_key_configured) {
      console.log('    ✅ E2E endpoint ready, service key configured')
    } else {
      console.log('    ❌ SERVICE_API_KEY not configured in Vercel')
      console.log('    → Add SERVICE_API_KEY to Vercel environment variables')
      console.log('    → Redeploy the application')
      process.exit(1)
    }
  } catch (err) {
    console.log(`    ❌ E2E endpoint not available: ${err.message}`)
    console.log('    → Make sure the latest code is deployed to Vercel')
    process.exit(1)
  }

  // Step 2: Full Pipeline Test
  console.log('\n📲 Step 2: EXECUTE FULL PIPELINE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('    ⚠️  THIS WILL MAKE A REAL PHONE CALL')
  console.log(`       From: ${CONFIG.fromNumber}`)
  console.log(`       To: ${CONFIG.toNumber}`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  const pipeline = await apiCall('full_pipeline', {
    phone_to: CONFIG.toNumber,
    from_number: CONFIG.fromNumber,
    translate_from: CONFIG.translateFrom,
    translate_to: CONFIG.translateTo,
    email: CONFIG.artifactEmail
  })

  if (!pipeline.ok) {
    console.log(`    ❌ Pipeline failed: ${pipeline.data.error || 'Unknown error'}`)
    if (pipeline.status === 401) {
      console.log('    → Check that SERVICE_API_KEY matches between your env and Vercel')
    }
    process.exit(1)
  }

  console.log('\n    Pipeline actions:')
  for (const action of pipeline.data.actions || []) {
    const icon = action.success ? '✅' : '❌'
    const msg = action.success ? 'OK' : (action.error || 'Unknown error')
    console.log(`    ${icon} ${action.action}: ${msg}`)
  }
  
  // Show full error details if available
  if (pipeline.data.error_details) {
    console.log('\n    📋 Error Details:')
    console.log(JSON.stringify(pipeline.data.error_details, null, 2))
  }

  if (!pipeline.data.call_id) {
    console.log('\n    ❌ Call was not initiated')
    process.exit(1)
  }

  console.log(`\n    📞 Call ID: ${pipeline.data.call_id}`)
  console.log(`    📞 Call SID: ${pipeline.data.call_sid}`)

  // Step 3: Poll for call completion
  console.log('\n⏳ Step 3: Polling Call Status (max 5 minutes)')
  const callId = pipeline.data.call_id
  
  for (let i = 1; i <= 60; i++) {
    await sleep(5000)
    const status = await apiCall('get_call', { call_id: callId })
    
    if (status.data.call) {
      const callStatus = status.data.call.status
      process.stdout.write(`\r    [${i}/60] Status: ${callStatus}                    `)
      
      if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(callStatus)) {
        console.log('')
        if (callStatus === 'completed') {
          console.log('    ✅ Call completed successfully!')
          
          // Check artifacts
          const call = status.data.call
          const recording = call.recordings?.[0]
          const aiRun = call.ai_runs?.[0]
          
          console.log(`\n    📦 Artifacts:`)
          console.log(`       Recording: ${recording?.recording_url ? '✅ Available' : '⏳ Processing'}`)
          console.log(`       Transcription: ${aiRun?.output?.transcript ? '✅ Available' : '⏳ Processing'}`)
          console.log(`       Translation: ${aiRun?.output?.translation ? '✅ Available' : '⏳ Processing'}`)
          
          if (aiRun?.output?.transcript) {
            const preview = typeof aiRun.output.transcript === 'string'
              ? aiRun.output.transcript.substring(0, 200)
              : JSON.stringify(aiRun.output.transcript).substring(0, 200)
            console.log(`\n    📝 Transcript preview:`)
            console.log(`       ${preview}...`)
          }
        } else {
          console.log(`    ⚠️ Call ended with status: ${callStatus}`)
        }
        break
      }
    }
    
    if (i === 60) {
      console.log('\n    ⚠️ Polling timeout - check Vercel logs for status')
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  TEST COMPLETE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  📞 Call ID: ${callId}`)
  console.log(`  🔗 View at: ${BASE_URL}/voice?call=${callId}`)
  console.log(`  📧 Artifacts will be emailed to: ${CONFIG.artifactEmail}`)
  console.log('')
  console.log('  📋 Check Vercel logs for detailed trace:')
  console.log(`     vercel logs ${BASE_URL} --follow`)
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
