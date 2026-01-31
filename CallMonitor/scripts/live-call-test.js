#!/usr/bin/env node
/**
 * LIVE CALL TEST - Direct API Testing
 * 
 * Usage: node scripts/live-call-test.js [ORG_ID]
 * 
 * This script:
 * 1. Creates a voice target
 * 2. Configures modulations (record, transcribe, translate)
 * 3. Executes a real call
 * 4. Polls for completion
 * 5. Triggers artifact email
 */

const BASE_URL = process.env.BASE_URL || 'https://voxsouth.online'

// Test Configuration
const CONFIG = {
  fromNumber: '+17062677235',        // Agent/caller number
  toNumber: '+12392027345',          // Target number to call
  translateFrom: 'en',               // English
  translateTo: 'de',                 // German
  artifactEmail: 'adrper79@gmail.com',
  surveyPrompts: [
    'On a scale of 1 to 5, how satisfied were you with our service?',
    'Would you recommend us to a friend?',
    'Any additional feedback?'
  ],
  shopperScript: `Hello, I'm calling to inquire about your services.

I'd like to schedule a consultation for next week. What availability do you have?

That sounds good. Can you tell me about your pricing?

One more question - do you offer any guarantees on your work?

Thank you for the information. I'll get back to you soon. Have a great day!`
}

// Get org ID from command line or environment
const ORG_ID = process.argv[2] || process.env.ORG_ID

if (!ORG_ID) {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  LIVE CALL TEST')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('  Usage: node scripts/live-call-test.js <ORG_ID>')
  console.log('')
  console.log('  Get your ORG_ID from Supabase SQL:')
  console.log('    SELECT organization_id FROM users WHERE email = \'stepdadstrong@gmail.com\';')
  console.log('')
  console.log('  Or set ORG_ID environment variable:')
  console.log('    set ORG_ID=your-uuid-here')
  console.log('    node scripts/live-call-test.js')
  console.log('')
  process.exit(1)
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`
  console.log(`  → ${method} ${url}`)
  
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  try {
    const res = await fetch(url, options)
    const data = await res.json()
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { error: { message: err.message } } }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  LIVE CALL TEST - REAL API CALLS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Organization: ${ORG_ID}`)
  console.log(`  From: ${CONFIG.fromNumber}`)
  console.log(`  To: ${CONFIG.toNumber}`)
  console.log(`  Translation: ${CONFIG.translateFrom} → ${CONFIG.translateTo}`)
  console.log(`  Artifact Email: ${CONFIG.artifactEmail}`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  let targetId = null
  let callId = null
  
  // Step 1: Health Check
  console.log('\n🔍 Step 1: Health Check')
  const health = await apiCall('/api/health')
  console.log(`    Status: ${health.ok ? '✅ Healthy' : '❌ Unhealthy'}`)
  
  // Step 2: Create Voice Target
  console.log('\n📞 Step 2: Create Voice Target')
  const target = await apiCall('/api/voice/targets', 'POST', {
    organization_id: ORG_ID,
    phone_number: CONFIG.toNumber,
    name: 'Live Test Target',
    description: `Created ${new Date().toISOString()}`
  })
  
  if (target.data.success) {
    targetId = target.data.target.id
    console.log(`    ✅ Target created: ${targetId}`)
  } else {
    console.log(`    ❌ Failed: ${target.data.error?.message || 'Unknown error'}`)
  }
  
  // Step 3: Update Voice Config
  console.log('\n⚙️ Step 3: Configure Voice Settings')
  const config = await apiCall('/api/voice/config', 'PUT', {
    orgId: ORG_ID,
    modulations: {
      record: true,
      transcribe: true,
      translate: true,
      translate_from: CONFIG.translateFrom,
      translate_to: CONFIG.translateTo,
      target_id: targetId,
      survey_webhook_email: CONFIG.artifactEmail
    }
  })
  
  if (config.data.success) {
    console.log('    ✅ Voice config updated')
    console.log('       Recording: ON')
    console.log('       Transcription: ON')
    console.log(`       Translation: ${CONFIG.translateFrom} → ${CONFIG.translateTo}`)
  } else {
    console.log(`    ⚠️ Config issue: ${config.data.error?.message || 'Unknown'}`)
  }
  
  // Step 4: Execute Call
  console.log('\n📲 Step 4: EXECUTE LIVE CALL')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('    ⚠️  THIS WILL MAKE A REAL PHONE CALL')
  console.log(`       From: ${CONFIG.fromNumber}`)
  console.log(`       To: ${CONFIG.toNumber}`)
  console.log('═══════════════════════════════════════════════════════════════')
  
  const call = await apiCall('/api/voice/call', 'POST', {
    organization_id: ORG_ID,
    phone_to: CONFIG.toNumber,
    from_number: CONFIG.fromNumber,
    modulations: {
      record: true,
      transcribe: true,
      translate: true
    }
  })
  
  if (call.data.success) {
    callId = call.data.call_id
    console.log(`    ✅ Call initiated!`)
    console.log(`       Call ID: ${callId}`)
    console.log(`       Call SID: ${call.data.call_sid}`)
  } else {
    console.log(`    ❌ Call failed: ${call.data.error?.message || 'Unknown error'}`)
    process.exit(1)
  }
  
  // Step 5: Poll Status
  console.log('\n⏳ Step 5: Polling Call Status')
  for (let i = 1; i <= 60; i++) {
    await sleep(5000)
    const status = await apiCall(`/api/calls/${callId}`)
    
    if (status.data.call) {
      const callStatus = status.data.call.status
      process.stdout.write(`\r    [${i}/60] Status: ${callStatus}                    `)
      
      if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(callStatus)) {
        console.log('')
        if (callStatus === 'completed') {
          console.log('    ✅ Call completed successfully!')
        } else {
          console.log(`    ⚠️ Call ended with status: ${callStatus}`)
        }
        break
      }
    }
  }
  
  // Step 6: Wait for Processing
  console.log('\n⏳ Step 6: Waiting for artifact processing (30 seconds)...')
  await sleep(30000)
  
  // Step 7: Check Artifacts
  console.log('\n📦 Step 7: Checking Artifacts')
  const artifacts = await apiCall(`/api/calls/${callId}`)
  
  if (artifacts.data.call) {
    const c = artifacts.data.call
    console.log(`    Recording: ${c.recording_url ? '✅ Available' : '⏳ Processing'}`)
    console.log(`    Transcript: ${c.transcript ? '✅ Available' : '⏳ Processing'}`)
    console.log(`    Translation: ${c.translation ? '✅ Available' : '⏳ Processing'}`)
    
    if (c.transcript) {
      console.log('\n    --- TRANSCRIPT PREVIEW ---')
      const preview = typeof c.transcript === 'string' 
        ? c.transcript.substring(0, 500) 
        : JSON.stringify(c.transcript).substring(0, 500)
      console.log(`    ${preview}...`)
    }
    
    if (c.translation) {
      console.log('\n    --- TRANSLATION PREVIEW ---')
      const preview = typeof c.translation === 'string'
        ? c.translation.substring(0, 500)
        : JSON.stringify(c.translation).substring(0, 500)
      console.log(`    ${preview}...`)
    }
  }
  
  // Step 8: Trigger Email
  console.log('\n📧 Step 8: Trigger Artifact Email')
  const email = await apiCall(`/api/calls/${callId}/email`, 'POST', {
    email: CONFIG.artifactEmail,
    include_recording: true,
    include_transcript: true,
    include_translation: true
  })
  
  if (email.data.success) {
    console.log(`    ✅ Email sent to ${CONFIG.artifactEmail}`)
  } else {
    console.log(`    ⚠️ Email may have been sent automatically`)
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  TEST COMPLETE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  📞 Call ID: ${callId}`)
  console.log(`  🔗 View at: ${BASE_URL}/voice?call=${callId}`)
  console.log(`  📧 Artifacts sent to: ${CONFIG.artifactEmail}`)
  console.log('')
  console.log('  To view Vercel logs:')
  console.log(`    vercel logs ${BASE_URL} --follow`)
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
