/**
 * Cleanup Orphaned Data Script
 * 
 * This script cleans up orphaned records left over from incomplete deletions
 * Handles foreign key constraints in the correct order
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fiijrhpjpebevfavzlhu.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function cleanupOrphanedData() {
  console.log('🧹 Word Is Bond - Cleanup Orphaned Data');
  console.log('======================================\n');
  
  // Step 1: Clear dependent tables first (reverse order of dependencies)
  console.log('📋 Step 1: Clearing dependent tables...\n');
  
  const dependentTables = [
    'access_grants_archived',
    'role_capabilities_archived',
    'roles_archived',
    'capabilities_archived',
    'tool_access_archived',
    'tool_team_members',
    'tool_settings',
    'org_members',
    'test_statistics',
    'test_results',
    'kpi_logs',
    'number_kpi_logs',
    'number_kpi_snapshot',
    'test_frequency_config',
    'monitored_numbers',
    'report_schedules',
    'alerts',
    'alert_acknowledgements',
    'scored_recordings',
    'scorecards',
    'evidence_manifests',
    'ai_runs',
    'recordings',
    'calls',
    'audit_logs',
    'voice_configs',
    'surveys',
    'campaigns',
    'voice_targets',
    'shopper_results',
    'shopper_jobs_archive',
    'shopper_campaigns_archive',
    'test_configs'
  ];
  
  for (const table of dependentTables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.log(`  ⚠️  ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ Cleared ${table}`);
      }
    } catch (error) {
      console.log(`  ⚠️  ${table}: ${error.message}`);
    }
  }
  
  // Step 2: Clear users table
  console.log('\n📋 Step 2: Clearing users table...\n');
  
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log('  ✅ Cleared users table');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  // Step 3: Clear organizations table
  console.log('\n📋 Step 3: Clearing organizations table...\n');
  
  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else {
      console.log('  ✅ Cleared organizations table');
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  console.log('\n✅ Cleanup complete!\n');
}

async function verifyCleanup() {
  console.log('🔍 Verifying cleanup...\n');
  
  const tables = ['users', 'organizations', 'org_members', 'calls', 'recordings'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        console.log(`  ⚠️  ${table}: Could not verify`);
      } else {
        const count = data?.length || 0;
        if (count === 0) {
          console.log(`  ✅ ${table}: Empty`);
        } else {
          console.log(`  ⚠️  ${table}: Still has ${count}+ records`);
        }
      }
    } catch (error) {
      console.log(`  ⚠️  ${table}: Error checking`);
    }
  }
}

async function main() {
  await cleanupOrphanedData();
  await verifyCleanup();
}

main().catch(console.error);
