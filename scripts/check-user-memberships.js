#!/usr/bin/env node
/**
 * Check which organizations a user is a member of
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const FALLBACK_ACTOR_ID = '28d68e05-ab20-40ee-b935-b19e8927ae68'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUserMemberships() {
  console.log(`\n=== Checking memberships for user: ${FALLBACK_ACTOR_ID} ===\n`)

  try {
    const { data, error } = await supabase
      .from('org_members')
      .select('organization_id, role, organizations(id, name, plan)')
      .eq('user_id', FALLBACK_ACTOR_ID)

    if (error) {
      console.error('❌ Error fetching memberships:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      console.log('⚠️  User is not a member of any organizations')
      console.log('\nTo fix this, you need to either:')
      console.log('1. Add this user to an existing organization, OR')
      console.log('2. Use a different user ID that is a member')
      process.exit(0)
    }

    console.log(`Found ${data.length} membership(s):\n`)
    data.forEach((membership, index) => {
      const org = membership.organizations
      console.log(`${index + 1}. Organization ID: ${membership.organization_id}`)
      console.log(`   Name: ${org?.name || '(unnamed)'}`)
      console.log(`   Plan: ${org?.plan || '(none)'}`)
      console.log(`   Role: ${membership.role}`)
      console.log('')
    })

    console.log('✅ Use one of these organization IDs for testing')
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

checkUserMemberships()
