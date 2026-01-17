import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking database schema...\n');

  // Check if tables exist
  const tables = [
    'organizations',
    'users', 
    'calls',
    'caller_id_numbers',
    'shopper_scripts',
    'surveys',
    'campaigns',
    'campaign_calls',
    'campaign_audit_log'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(0);
    
    if (error) {
      console.log(`❌ Table "${table}" - ERROR: ${error.message}`);
    } else {
      console.log(`✅ Table "${table}" exists`);
    }
  }

  // Check for the update_updated_at_column function
  const { data: funcData, error: funcError } = await supabase.rpc('update_updated_at_column' as any).limit(0);
  console.log(`\n🔧 Function "update_updated_at_column" - ${funcError ? 'Does not exist or error' : 'Exists'}`);

  // Get detailed column info for users table
  console.log('\n📋 Checking users table structure...');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  
  if (!userError && userData && userData[0]) {
    console.log('Users table columns:', Object.keys(userData[0]));
  }
}

checkSchema().catch(console.error);
