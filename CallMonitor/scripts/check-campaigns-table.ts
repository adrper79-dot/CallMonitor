import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCampaignsTable() {
  console.log('Checking campaigns table structure...\n');

  // Try to get one row to see column structure
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log(`❌ Error querying campaigns: ${error.message}`);
  } else if (data && data.length > 0) {
    console.log('✅ Campaigns table columns:', Object.keys(data[0]));
  } else {
    console.log('✅ Campaigns table exists but is empty');
    // Try to insert to see what columns are expected
    const { error: insertError } = await supabase
      .from('campaigns')
      .insert({})
      .select();
    
    if (insertError) {
      console.log('\nExpected error from empty insert (shows required columns):');
      console.log(insertError.message);
    }
  }
}

checkCampaignsTable().catch(console.error);
