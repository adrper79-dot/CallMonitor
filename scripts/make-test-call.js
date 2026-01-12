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
      .select('id, name')
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

    // Ensure voice_configs has record and transcribe enabled
    console.log('🔧 Checking/updating voice_configs for recording and transcription...')
    const { data: existingConfig } = await supabase
      .from('voice_configs')
      .select('id')
      .eq('organization_id', org.id)
      .limit(1)

    if (existingConfig && existingConfig.length > 0) {
      // Update existing config
      const { error: updateError } = await supabase
        .from('voice_configs')
        .update({
          record: true,
          transcribe: true
        })
        .eq('organization_id', org.id)
      
      if (updateError) {
        console.error('❌ Error updating voice_configs:', updateError.message)
        process.exit(1)
      }
      console.log('✅ Updated voice_configs: record=true, transcribe=true')
    } else {
      // Create new config
      const { error: insertError } = await supabase
        .from('voice_configs')
        .insert({
          organization_id: org.id,
          record: true,
          transcribe: true,
          translate: false,
          survey: false,
          synthetic_caller: false
        })
      
      if (insertError) {
        console.error('❌ Error creating voice_configs:', insertError.message)
        process.exit(1)
      }
      console.log('✅ Created voice_configs: record=true, transcribe=true')
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

    // Make the call via SignalWire API directly
    const phoneNumber = '+17062677235'
    console.log(`📞 Initiating call to ${phoneNumber}...`)

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

    // Create call record in database first
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

    // Make SignalWire API call with recording enabled
    const auth = Buffer.from(`${swProject}:${swToken}`).toString('base64')
    const params = new URLSearchParams()
    params.append('From', swNumber)
    params.append('To', phoneNumber)
    params.append('Url', `${appUrl}/api/voice/laml/outbound`)
    params.append('StatusCallback', `${appUrl}/api/webhooks/signalwire`)
    params.append('Record', 'true') // Enable recording
    params.append('RecordingStatusCallback', `${appUrl}/api/webhooks/signalwire`) // Get recording status updates

    const endpoint = `https://${swSpace}.signalwire.com/api/laml/2010-04-01/Accounts/${swProject}/Calls.json`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/x-www-form-urlencoded' 
      },
      body: params
    })

    const responseData = await response.json()

    if (response.ok && responseData.sid) {
      // Update call record with status
      await supabase
        .from('calls')
        .update({ status: 'in-progress' })
        .eq('id', callId)

      // Create AI run for transcription (will be processed when recording completes)
      const { v4: uuidv4 } = require('uuid')
      const { data: systems } = await supabase
        .from('systems')
        .select('id, key')
        .in('key', ['system-ai'])

      const systemAiId = systems?.[0]?.id
      if (systemAiId) {
        await supabase
          .from('ai_runs')
          .insert({
            id: uuidv4(),
            call_id: callId,
            system_id: systemAiId,
            model: 'assemblyai-v1',
            status: 'queued'
          })
        console.log('✅ Transcription job queued (will process when recording completes)')
      }

      console.log(`✅ Call initiated successfully with recording and transcription!`)
      console.log(`   Call ID: ${callId}`)
      console.log(`   SignalWire SID: ${responseData.sid.substring(0, 10)}...`)
      console.log(`   Recording: Enabled`)
      console.log(`   Transcription: Queued (will process after recording)`)
    } else {
      console.error('❌ SignalWire call failed:', response.status, responseData)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
