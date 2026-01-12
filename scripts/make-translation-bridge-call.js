const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  try {
    // Find the stepdadstrong organization
    console.log('🔍 Looking for "stepdadstrong" organization...')
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, plan')
      .ilike('name', '%stepdadstrong%')

    if (orgError) {
      console.error('❌ Error finding organization:', orgError.message)
      process.exit(1)
    }

    if (!orgs || orgs.length === 0) {
      console.error('❌ No organization found with name containing "stepdadstrong"')
      process.exit(1)
    }

    const org = orgs[0]
    console.log(`✅ Found organization: ${org.name} (${org.id})`)
    console.log(`   Plan: ${org.plan}`)

    // Check if plan supports translation (requires Global or Enterprise)
    if (org.plan?.toLowerCase() !== 'global' && org.plan?.toLowerCase() !== 'enterprise') {
      console.warn('⚠️  Translation requires Global or Enterprise plan')
      console.warn('   Current plan:', org.plan)
      console.warn('   Translation will be attempted but may fail plan check')
    }

    // Ensure voice_configs has record, transcribe, and translate enabled
    console.log('🔧 Configuring voice_configs for translation bridge call...')
    const { data: existingConfig } = await supabase
      .from('voice_configs')
      .select('id')
      .eq('organization_id', org.id)
      .limit(1)

    // For translation bridge, we'll use 'auto' detection or set specific languages
    // Since we want AI to detect languages, we'll set translate_from to 'auto' if supported
    // Otherwise, we'll need to specify languages (e.g., 'en' and 'es')
    const voiceConfig = {
      organization_id: org.id,
      record: true,
      transcribe: true,
      translate: true,
      // For auto-detection, we might need to handle this in the translation service
      // For now, let's set common language pairs - the AI will detect and translate
      translate_from: 'auto', // Will be detected from transcript
      translate_to: 'auto',   // Will be detected from transcript
      survey: false,
      synthetic_caller: false
    }

    if (existingConfig && existingConfig.length > 0) {
      // Update existing config
      const { error: updateError } = await supabase
        .from('voice_configs')
        .update(voiceConfig)
        .eq('organization_id', org.id)
      
      if (updateError) {
        console.error('❌ Error updating voice_configs:', updateError.message)
        process.exit(1)
      }
      console.log('✅ Updated voice_configs for translation bridge')
    } else {
      // Create new config
      const { error: insertError } = await supabase
        .from('voice_configs')
        .insert(voiceConfig)
      
      if (insertError) {
        console.error('❌ Error creating voice_configs:', insertError.message)
        process.exit(1)
      }
      console.log('✅ Created voice_configs for translation bridge')
    }

    // Get a user for this organization
    const { data: members, error: memberError } = await supabase
      .from('org_members')
      .select('user_id')
      .eq('organization_id', org.id)
      .limit(1)

    if (memberError) {
      console.error('❌ Error finding org member:', memberError.message)
      process.exit(1)
    }

    const userId = members?.[0]?.user_id || null
    console.log(`✅ Using user: ${userId || 'fallback user'}`)

    // Bridge call setup: two numbers
    // Caller leg: +17062677235 (the one initiating)
    // Called leg: +12392027345 (the one being called)
    const callerLeg = '+17062677235'   // Caller leg
    const calledLeg = '+12392027345'   // Called leg
    
    console.log(`🌉 Setting up translation bridge call:`)
    console.log(`   Caller Leg: ${callerLeg}`)
    console.log(`   Called Leg: ${calledLeg}`)
    console.log(`   Translation: Auto-detect languages and translate between them`)

    // Get SignalWire config
    const swProject = process.env.SIGNALWIRE_PROJECT_ID
    const swToken = process.env.SIGNALWIRE_TOKEN
    const swNumber = process.env.SIGNALWIRE_NUMBER
    const rawSpace = String(process.env.SIGNALWIRE_SPACE || '')
    const swSpace = rawSpace.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\.signalwire\.com$/i, '').trim()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (!(swProject && swToken && swNumber && swSpace)) {
      console.error('❌ Missing SignalWire configuration in .env.local')
      console.error('   Required: SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, SIGNALWIRE_NUMBER, SIGNALWIRE_SPACE')
      process.exit(1)
    }

    // Create call record in database
    const { v4: uuidv4 } = require('uuid')
    const callId = uuidv4()
    
    // Get systems
    const { data: systems } = await supabase
      .from('systems')
      .select('id, key')
      .in('key', ['system-cpid', 'system-ai'])

    const systemMap = {}
    ;(systems || []).forEach((s) => { systemMap[s.key] = s.id })
    const systemCpidId = systemMap['system-cpid']
    const systemAiId = systemMap['system-ai']

    // Insert call record
    const { error: callError } = await supabase
      .from('calls')
      .insert({
        id: callId,
        organization_id: org.id,
        system_id: systemCpidId,
        status: 'pending',
        created_by: userId
      })

    if (callError) {
      console.error('❌ Error creating call record:', callError.message)
      process.exit(1)
    }

    // Create bridge call: place two legs that join the same conference
    console.log('📞 Placing bridge call legs...')
    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    
    // Create a unique conference room name for this bridge call
    const conferenceName = `bridge-${callId.substring(0, 8)}`
    
    // Leg 1: Call to caller leg (+17062677235) - will join conference
    const params1 = new URLSearchParams()
    params1.append('From', swNumber)
    params1.append('To', callerLeg)
    // Pass callId and conference name to LaML endpoint
    params1.append('Url', `${appUrl}/api/voice/laml/outbound?callId=${callId}&conference=${encodeURIComponent(conferenceName)}&leg=1`)
    params1.append('StatusCallback', `${appUrl}/api/webhooks/signalwire`)

    const endpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
    
    console.log(`📞 Placing Leg 1 (Caller) to: ${callerLeg}`)
    const response1 = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: params1
    })

    const responseData1 = await response1.json()

    if (!response1.ok || !responseData1.sid) {
      console.error('❌ Failed to place caller leg:', response1.status, responseData1)
      process.exit(1)
    }

    console.log(`✅ Caller Leg placed: ${responseData1.sid.substring(0, 10)}... (calling ${callerLeg})`)

    // Wait a moment before placing second leg to avoid any potential conflicts
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Leg 2: Call to called leg (+12392027345) - will join same conference
    const params2 = new URLSearchParams()
    params2.append('From', swNumber)
    params2.append('To', calledLeg)
    // Pass callId and conference name to LaML endpoint
    params2.append('Url', `${appUrl}/api/voice/laml/outbound?callId=${callId}&conference=${encodeURIComponent(conferenceName)}&leg=2`)
    params2.append('StatusCallback', `${appUrl}/api/webhooks/signalwire`)
    
    console.log(`📞 Placing Leg 2 (Called) to: ${calledLeg}`)

    const response2 = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: params2
    })

    const responseData2 = await response2.json()

    if (!response2.ok || !responseData2.sid) {
      console.error('❌ Failed to place called leg:', response2.status, responseData2)
      process.exit(1)
    }

    console.log(`✅ Called Leg placed: ${responseData2.sid.substring(0, 10)}... (calling ${calledLeg})`)
    console.log(`   Conference room: ${conferenceName}`)

    // Update call record
    await supabase
      .from('calls')
      .update({ status: 'in-progress' })
      .eq('id', callId)

    // Create AI runs for transcription (one per leg, but we'll create one for the call)
    if (systemAiId) {
      // Transcription job
      await supabase
        .from('ai_runs')
        .insert({
          id: uuidv4(),
          call_id: callId,
          system_id: systemAiId,
          model: 'assemblyai-v1',
          status: 'queued',
          meta: {
            call_type: 'bridge',
            leg1_sid: responseData1.sid,
            leg2_sid: responseData2.sid
          }
        })

      // Translation job (will be triggered after transcription completes)
      await supabase
        .from('ai_runs')
        .insert({
          id: uuidv4(),
          call_id: callId,
          system_id: systemAiId,
          model: 'assemblyai-translation',
          status: 'queued',
          meta: {
            translate_from: 'auto',
            translate_to: 'auto',
            bridge_call: true
          }
        })

      console.log('✅ Transcription and translation jobs queued')
    }

    console.log(`\n✅ Translation bridge call initiated successfully!`)
    console.log(`   Call ID: ${callId}`)
    console.log(`   Caller Leg: ${callerLeg} (SID: ${responseData1.sid.substring(0, 10)}...)`)
    console.log(`   Called Leg: ${calledLeg} (SID: ${responseData2.sid.substring(0, 10)}...)`)
    console.log(`   Recording: Enabled on conference`)
    console.log(`   Transcription: Queued (will process after recording)`)
    console.log(`   Translation: Queued (will process after transcription)`)
    console.log(`\n📝 Note: Real-time translation requires Phase 2 (FreeSWITCH) infrastructure.`)
    console.log(`   Current setup: Post-call translation after transcription completes.`)
    console.log(`   The AI will detect languages from transcripts and translate between them.`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
