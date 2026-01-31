/**
 * Test Translation with Voice Cloning
 * 
 * Tests English to German translation with voice cloning enabled
 * Places call from +12392027345 to +17062677235
 * Sends artifacts to adrper79@gmail.com
 * 
 * Usage: node scripts/test-translation-with-voice-cloning.js
 */

// Try to load .env.local if dotenv is available
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv not available, continue with process.env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Test configuration
const TEST_CONFIG = {
  fromNumber: '+12392027345',
  toNumber: '+17062677235',
  recipientEmail: 'adrper79@gmail.com',
  translateFrom: 'en',
  translateTo: 'de', // German
  useVoiceCloning: true,
  record: true,
  transcribe: true,
  translate: true,
}

async function createTestUserAndOrg() {
  console.log('\n🔧 Creating test user and organization...\n')
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  // Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      email: 'test-translation@callmonitor.local',
      password: 'TestTranslation2026!',
      email_confirm: true,
      user_metadata: {
        name: 'Translation Test User',
        email_verified: true
      }
    })
  })

  if (!authRes.ok) {
    const error = await authRes.json()
    // If user already exists, try to get existing user
    if (error.message?.includes('already registered')) {
      console.log('  ℹ️  Test user already exists, fetching...')
      const getRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=test-translation@callmonitor.local`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      })
      const users = await getRes.json()
      if (users.users && users.users.length > 0) {
        return { userId: users.users[0].id, isNew: false }
      }
    }
    throw new Error(`Failed to create auth user: ${JSON.stringify(error)}`)
  }

  const authUser = await authRes.json()
  const userId = authUser.id
  console.log(`  ✅ Created auth user: ${authUser.email} (ID: ${userId})`)

  // Create organization
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // Check if org already exists for this user
  const { data: existingOrgs } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('created_by', userId)
    .limit(1)

  let orgId
  if (existingOrgs && existingOrgs.length > 0) {
    orgId = existingOrgs[0].id
    console.log(`  ℹ️  Using existing organization: ${existingOrgs[0].name} (ID: ${orgId})`)
  } else {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Translation Test Organization',
        plan: 'business', // Business plan required for translation + voice cloning
        plan_status: 'active',
        created_by: userId
      })
      .select()
      .single()

    if (orgError) {
      throw new Error(`Failed to create organization: ${orgError.message}`)
    }

    orgId = org.id
    console.log(`  ✅ Created organization: ${org.name} (ID: ${orgId})`)
  }

  // Create user in public.users if not exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existingUser) {
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: 'test-translation@callmonitor.local',
        organization_id: orgId
      })

    if (userError) {
      console.warn(`  ⚠️  Failed to create public user: ${userError.message}`)
    } else {
      console.log(`  ✅ Created public user record`)
    }
  }

  // Create org membership if not exists
  const { data: existingMember } = await supabase
    .from('org_members')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()

  if (!existingMember) {
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: 'owner'
      })

    if (memberError) {
      console.warn(`  ⚠️  Failed to create org membership: ${memberError.message}`)
    } else {
      console.log(`  ✅ Added user to organization as owner`)
    }
  }

  // Create or update voice target
  const { data: existingTarget } = await supabase
    .from('voice_targets')
    .select('id')
    .eq('organization_id', orgId)
    .eq('phone_number', TEST_CONFIG.toNumber)
    .single()

  let targetId
  if (existingTarget) {
    targetId = existingTarget.id
    console.log(`  ℹ️  Using existing target: ${TEST_CONFIG.toNumber}`)
  } else {
    const { data: target, error: targetError } = await supabase
      .from('voice_targets')
      .insert({
        organization_id: orgId,
        phone_number: TEST_CONFIG.toNumber,
        name: 'Test Target (German Translation)',
        is_active: true
      })
      .select()
      .single()

    if (targetError) {
      throw new Error(`Failed to create target: ${targetError.message}`)
    }

    targetId = target.id
    console.log(`  ✅ Created voice target: ${TEST_CONFIG.toNumber}`)
  }

  return { userId, orgId, targetId, isNew: true }
}

async function configureVoiceSettings(orgId, targetId) {
  console.log('\n⚙️  Configuring voice settings for translation...\n')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // Configure voice settings (target_id is stored separately, not in voice_configs)
  const config = {
    organization_id: orgId,
    record: TEST_CONFIG.record,
    transcribe: TEST_CONFIG.transcribe,
    translate: TEST_CONFIG.translate,
    translate_from: TEST_CONFIG.translateFrom,
    translate_to: TEST_CONFIG.translateTo,
    use_voice_cloning: TEST_CONFIG.useVoiceCloning,
    survey: false,
    synthetic_caller: false
  }

  // Check if config exists
  const { data: existingConfig } = await supabase
    .from('voice_configs')
    .select('id')
    .eq('organization_id', orgId)
    .single()

  if (existingConfig) {
    const { error: updateError } = await supabase
      .from('voice_configs')
      .update(config)
      .eq('organization_id', orgId)

    if (updateError) {
      throw new Error(`Failed to update voice config: ${updateError.message}`)
    }
    console.log('  ✅ Updated voice configuration')
  } else {
    const { error: insertError } = await supabase
      .from('voice_configs')
      .insert({
        id: crypto.randomUUID(),
        ...config
      })

    if (insertError) {
      throw new Error(`Failed to create voice config: ${insertError.message}`)
    }
    console.log('  ✅ Created voice configuration')
  }

  console.log(`  📋 Settings:`)
  console.log(`     - Recording: ${TEST_CONFIG.record ? '✅' : '❌'}`)
  console.log(`     - Transcription: ${TEST_CONFIG.transcribe ? '✅' : '❌'}`)
  console.log(`     - Translation: ${TEST_CONFIG.translate ? '✅' : '❌'}`)
  console.log(`     - From Language: ${TEST_CONFIG.translateFrom} (English)`)
  console.log(`     - To Language: ${TEST_CONFIG.translateTo} (German)`)
  console.log(`     - Voice Cloning: ${TEST_CONFIG.useVoiceCloning ? '✅' : '❌'}`)
  console.log(`     - Target: ${TEST_CONFIG.toNumber}`)

  return config
}

async function placeCall(orgId, targetId) {
  console.log('\n📞 Placing call...\n')

  // The API uses voice_configs from the database, so we just need to pass modulations
  // The translate_from, translate_to, and use_voice_cloning are already in voice_configs
  const response = await fetch(`${APP_URL}/api/voice/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: orgId,
      phone_to: TEST_CONFIG.toNumber,
      phone_from: TEST_CONFIG.fromNumber,
      target_id: targetId,
      modulations: {
        record: TEST_CONFIG.record,
        transcribe: TEST_CONFIG.transcribe,
        translate: TEST_CONFIG.translate,
        survey: false,
        synthetic_caller: false
      }
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to place call: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  console.log(`  ✅ Call placed successfully!`)
  console.log(`     Call ID: ${result.call_id}`)
  console.log(`     Status: ${result.status || 'initiated'}`)

  return result.call_id
}

async function waitForCallCompletion(callId, maxWaitMinutes = 10) {
  console.log(`\n⏳ Waiting for call to complete (max ${maxWaitMinutes} minutes)...\n`)

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const startTime = Date.now()
  const maxWait = maxWaitMinutes * 60 * 1000
  let lastStatus = 'initiated'

  while (Date.now() - startTime < maxWait) {
    const { data: call, error } = await supabase
      .from('calls')
      .select('id, status, ended_at, started_at')
      .eq('id', callId)
      .single()

    if (error) {
      console.error(`  ❌ Error checking call status: ${error.message}`)
      await new Promise(resolve => setTimeout(resolve, 5000))
      continue
    }

    if (call.status !== lastStatus) {
      console.log(`  📊 Status update: ${lastStatus} → ${call.status}`)
      lastStatus = call.status
    }

    if (call.ended_at) {
      console.log(`  ✅ Call completed!`)
      console.log(`     Started: ${call.started_at}`)
      console.log(`     Ended: ${call.ended_at}`)
      return true
    }

    // Check for failed statuses
    if (['failed', 'no-answer', 'busy', 'canceled'].includes(call.status)) {
      console.log(`  ⚠️  Call ended with status: ${call.status}`)
      return false
    }

    await new Promise(resolve => setTimeout(resolve, 5000)) // Check every 5 seconds
  }

  console.log(`  ⏱️  Max wait time reached. Call may still be in progress.`)
  return false
}

async function waitForArtifacts(callId, maxWaitMinutes = 15) {
  console.log(`\n📦 Waiting for artifacts to be generated (max ${maxWaitMinutes} minutes)...\n`)

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const startTime = Date.now()
  const maxWait = maxWaitMinutes * 60 * 1000
  let hasRecording = false
  let hasTranscript = false
  let hasTranslation = false

  while (Date.now() - startTime < maxWait) {
    // Check for recording
    if (!hasRecording) {
      const { data: recording } = await supabase
        .from('recordings')
        .select('id, recording_url')
        .eq('call_id', callId)
        .single()

      if (recording && recording.recording_url) {
        hasRecording = true
        console.log(`  ✅ Recording available: ${recording.recording_url.substring(0, 50)}...`)
      }
    }

    // Check for transcript
    if (!hasTranscript) {
      const { data: transcript } = await supabase
        .from('recordings')
        .select('id, transcript')
        .eq('call_id', callId)
        .not('transcript', 'is', null)
        .single()

      if (transcript && transcript.transcript) {
        hasTranscript = true
        console.log(`  ✅ Transcript available`)
      }
    }

    // Check for translation
    if (!hasTranslation) {
      const { data: translation } = await supabase
        .from('ai_runs')
        .select('id, output')
        .eq('call_id', callId)
        .eq('type', 'translation')
        .not('output', 'is', null)
        .single()

      if (translation && translation.output) {
        hasTranslation = true
        console.log(`  ✅ Translation available`)
      }
    }

    if (hasRecording && hasTranscript && hasTranslation) {
      console.log(`  ✅ All artifacts ready!`)
      return true
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const status = [
      hasRecording ? '✅' : '⏳',
      hasTranscript ? '✅' : '⏳',
      hasTranslation ? '✅' : '⏳'
    ].join(' ')
    process.stdout.write(`\r  ${status} Recording | Transcript | Translation (${elapsed}s)`)

    await new Promise(resolve => setTimeout(resolve, 10000)) // Check every 10 seconds
  }

  console.log(`\n  ⏱️  Max wait time reached. Some artifacts may still be processing.`)
  console.log(`     Recording: ${hasRecording ? '✅' : '⏳'}`)
  console.log(`     Transcript: ${hasTranscript ? '✅' : '⏳'}`)
  console.log(`     Translation: ${hasTranslation ? '✅' : '⏳'}`)
  
  return hasRecording && hasTranscript && hasTranslation
}

async function sendArtifacts(callId) {
  console.log(`\n📧 Sending artifacts to ${TEST_CONFIG.recipientEmail}...\n`)

  const response = await fetch(`${APP_URL}/api/calls/${callId}/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: TEST_CONFIG.recipientEmail,
      includeRecording: true,
      includeTranscript: true,
      includeTranslation: true
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to send artifacts: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  console.log(`  ✅ ${result.message}`)
  return result
}

async function main() {
  try {
    console.log('🚀 Starting Translation with Voice Cloning Test\n')
    console.log('=' .repeat(60))
    console.log('Test Configuration:')
    console.log(`  From: ${TEST_CONFIG.fromNumber}`)
    console.log(`  To: ${TEST_CONFIG.toNumber}`)
    console.log(`  Translation: ${TEST_CONFIG.translateFrom} → ${TEST_CONFIG.translateTo}`)
    console.log(`  Voice Cloning: ${TEST_CONFIG.useVoiceCloning ? 'Enabled' : 'Disabled'}`)
    console.log(`  Email: ${TEST_CONFIG.recipientEmail}`)
    console.log('=' .repeat(60))
    
    // Check required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('\n❌ Missing required environment variables:')
      if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
      if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
      console.error('\nPlease set these in .env.local or export them before running the script.')
      process.exit(1)
    }

    // Step 1: Create test user and org
    const { userId, orgId, targetId } = await createTestUserAndOrg()

    // Step 2: Configure voice settings
    await configureVoiceSettings(orgId, targetId)

    // Step 3: Place call
    const callId = await placeCall(orgId, targetId)

    // Step 4: Wait for call to complete
    const callCompleted = await waitForCallCompletion(callId)
    if (!callCompleted) {
      console.log('\n⚠️  Call did not complete normally. Artifacts may still be generated.')
    }

    // Step 5: Wait for artifacts
    const artifactsReady = await waitForArtifacts(callId)
    if (!artifactsReady) {
      console.log('\n⚠️  Not all artifacts are ready. Attempting to send what is available...')
    }

    // Step 6: Send artifacts via email
    await sendArtifacts(callId)

    console.log('\n' + '='.repeat(60))
    console.log('✅ Test completed successfully!')
    console.log(`📧 Artifacts sent to: ${TEST_CONFIG.recipientEmail}`)
    console.log(`📞 Call ID: ${callId}`)
    console.log(`🔗 View call: ${APP_URL}/voice?callId=${callId}`)
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the test
if (require.main === module) {
  main()
}

module.exports = { main, TEST_CONFIG }
