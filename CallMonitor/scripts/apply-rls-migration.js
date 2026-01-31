const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyRLS() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERROR: Missing Supabase credentials');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  console.log('Applying RLS policies migration...');
  console.log('Supabase URL:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
  
  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'migrations', '2026-01-11-add-rls-policies.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('\n=================================================');
  console.log('RLS MIGRATION - CRITICAL SECURITY UPDATE');
  console.log('=================================================\n');
  
  // For Supabase, we need to execute the SQL directly
  // The service role key bypasses RLS, so we can set it up
  console.log('Note: This migration will be applied via Supabase SQL Editor or psql');
  console.log('Reason: Node.js Supabase client does not support DDL operations\n');
  
  console.log('INSTRUCTIONS:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Copy the contents of: migrations/2026-01-11-add-rls-policies.sql');
  console.log('3. Paste and execute in SQL Editor');
  console.log('4. Verify success: All tables should show RLS enabled\n');
  
  console.log('ALTERNATIVE (if you have psql):');
  console.log('psql $DATABASE_URL < migrations/2026-01-11-add-rls-policies.sql\n');
  
  console.log('Migration file location:');
  console.log(migrationPath);
  console.log('\nMigration preview (first 500 chars):');
  console.log('---');
  console.log(sql.substring(0, 500) + '...');
  console.log('---\n');
  
  console.log('SUCCESS: Migration script is ready to apply');
  console.log('Please apply it manually via Supabase Dashboard SQL Editor');
}

applyRLS().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
