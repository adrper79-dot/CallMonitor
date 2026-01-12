import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import startCallHandler from '../app/actions/calls/startCallHandler.js'

dotenv.config({ path: '.env.local' })

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

    // Make the call
    const phoneNumber = '+17062677235'
    console.log(`📞 Initiating call to ${phoneNumber}...`)

    const result = await startCallHandler(
      {
        organization_id: org.id,
        phone_number: phoneNumber,
        modulations: {
          record: true,
          transcribe: true
        }
      },
      {
        supabaseAdmin: supabase as any,
        getSession: async () => ({ user: { id: userId } }),
        env: process.env
      }
    )

    if (result.success) {
      console.log(`✅ Call initiated successfully!`)
      console.log(`   Call ID: ${result.call_id}`)
    } else {
      console.error('❌ Call failed:', (result as any).error)
      process.exit(1)
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) console.error(error.stack)
    process.exit(1)
  }
}

main()
