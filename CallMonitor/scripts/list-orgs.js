#!/usr/bin/env node
/**
 * List organizations in the database
 * Run with: node scripts/list-orgs.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function listOrganizations() {
  console.log('\n=== Organizations in Database ===\n')

  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, plan, tool_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching organizations:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No organizations found in database')
      console.log('\nYou may need to create an organization first.')
      process.exit(0)
    }

    console.log(`Found ${data.length} organization(s):\n`)
    data.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name || '(unnamed)'}`)
      console.log(`   ID: ${org.id}`)
      console.log(`   Plan: ${org.plan || '(none)'}`)
      console.log(`   Tool ID: ${org.tool_id || '(none)'}`)
      console.log('')
    })

    console.log('✅ Use one of these organization IDs for testing')
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

listOrganizations()
