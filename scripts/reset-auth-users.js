/**
 * Reset Authentication Users Script
 * 
 * This script:
 * 1. Lists current users in auth.users
 * 2. Optionally clears all users and organizations
 * 3. Creates test users with proper passwords
 * 4. Sets up proper organization memberships
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fiijrhpjpebevfavzlhu.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_lRUy5ZWTCzCNPTuOP9K9Rg_Nh-nEClF';

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const shouldCreateUsers = args.includes('--create');

async function listUsers() {
  console.log('\n📋 Listing current users...\n');
  
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  
  const data = await res.json();
  
  if (data.users && data.users.length > 0) {
    console.log(`Found ${data.users.length} users:\n`);
    data.users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
      console.log(`    Created: ${user.created_at}`);
      console.log(`    Last sign in: ${user.last_sign_in_at || 'Never'}`);
      console.log('');
    });
  } else {
    console.log('No users found.\n');
  }
  
  return data.users || [];
}

async function clearAllUsers(users) {
  console.log('\n🗑️  Clearing all users...\n');
  
  for (const user of users) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        }
      });
      
      if (res.ok) {
        console.log(`  ✅ Deleted user: ${user.email}`);
      } else {
        console.log(`  ❌ Failed to delete user: ${user.email} (${res.status})`);
      }
    } catch (error) {
      console.error(`  ❌ Error deleting user ${user.email}:`, error.message);
    }
  }
  
  console.log('\n🗑️  Clearing organizations and org_members...\n');
  
  // Clear org_members first (due to foreign keys)
  const { error: membersError } = await supabase
    .from('org_members')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (membersError) {
    console.error('  ❌ Error clearing org_members:', membersError.message);
  } else {
    console.log('  ✅ Cleared org_members');
  }
  
  // Clear organizations
  const { error: orgsError } = await supabase
    .from('organizations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (orgsError) {
    console.error('  ❌ Error clearing organizations:', orgsError.message);
  } else {
    console.log('  ✅ Cleared organizations');
  }
  
  // Clear users table
  const { error: usersError } = await supabase
    .from('users')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (usersError) {
    console.error('  ❌ Error clearing users:', usersError.message);
  } else {
    console.log('  ✅ Cleared users table');
  }
}

async function createTestUsers() {
  console.log('\n👤 Creating test users...\n');
  
  const testUsers = [
    {
      email: 'admin@callmonitor.local',
      password: 'CallMonitor2026!',
      role: 'admin',
      name: 'Admin User'
    },
    {
      email: 'user@callmonitor.local',
      password: 'CallMonitor2026!',
      role: 'member',
      name: 'Test User'
    }
  ];
  
  const createdUsers = [];
  
  for (const userData of testUsers) {
    try {
      // Create user in auth.users
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            name: userData.name,
            email_verified: true
          }
        })
      });
      
      const authUser = await res.json();
      
      if (!res.ok) {
        console.error(`  ❌ Failed to create auth user ${userData.email}:`, authUser);
        continue;
      }
      
      console.log(`  ✅ Created auth user: ${userData.email} (ID: ${authUser.id})`);
      createdUsers.push({ ...userData, authId: authUser.id });
      
    } catch (error) {
      console.error(`  ❌ Error creating user ${userData.email}:`, error.message);
    }
  }
  
  // Create default organization
  console.log('\n🏢 Creating default organization...\n');
  
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: 'Test Organization',
      plan: 'professional',
      plan_status: 'active',
      created_by: createdUsers[0]?.authId
    })
    .select()
    .single();
  
  if (orgError) {
    console.error('  ❌ Error creating organization:', orgError.message);
    return;
  }
  
  console.log(`  ✅ Created organization: ${org.name} (ID: ${org.id})`);
  
  // Create users in public.users and org_members
  console.log('\n👥 Setting up users and memberships...\n');
  
  for (const userData of createdUsers) {
    // Create user in public.users
    const { data: publicUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: userData.authId,
        email: userData.email,
        organization_id: org.id,
        role: userData.role,
        is_admin: userData.role === 'admin'
      })
      .select()
      .single();
    
    if (userError) {
      console.error(`  ❌ Error creating public user ${userData.email}:`, userError.message);
      continue;
    }
    
    console.log(`  ✅ Created public user: ${userData.email}`);
    
    // Create org membership
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        organization_id: org.id,
        user_id: userData.authId,
        role: userData.role === 'admin' ? 'owner' : 'member'
      });
    
    if (memberError) {
      console.error(`  ❌ Error creating org membership for ${userData.email}:`, memberError.message);
    } else {
      console.log(`  ✅ Added ${userData.email} to organization as ${userData.role}`);
    }
  }
  
  console.log('\n✅ Test users created successfully!\n');
  console.log('You can now log in with:');
  console.log('  - Email: admin@callmonitor.local');
  console.log('  - Password: CallMonitor2026!');
  console.log('  OR');
  console.log('  - Email: user@callmonitor.local');
  console.log('  - Password: CallMonitor2026!');
  console.log('');
}

async function testAuthentication() {
  console.log('\n🔐 Testing authentication...\n');
  
  const testEmail = 'admin@callmonitor.local';
  const testPassword = 'CallMonitor2026!';
  
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('  ✅ Authentication successful!');
      console.log(`  - User: ${data.user.email}`);
      console.log(`  - Access token: ${data.access_token.substring(0, 20)}...`);
    } else {
      const error = await res.json();
      console.log('  ❌ Authentication failed:', error);
    }
  } catch (error) {
    console.error('  ❌ Error testing authentication:', error.message);
  }
}

async function main() {
  console.log('🔧 CallMonitor Authentication Reset Script');
  console.log('==========================================\n');
  
  // List current users
  const users = await listUsers();
  
  if (shouldClear) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise((resolve) => {
      readline.question(`\n⚠️  Are you sure you want to delete ${users.length} users and all organizations? (yes/no): `, (answer) => {
        readline.close();
        if (answer.toLowerCase() === 'yes') {
          clearAllUsers(users).then(resolve);
        } else {
          console.log('\n❌ Aborted.');
          process.exit(0);
        }
      });
    });
  }
  
  if (shouldCreateUsers) {
    await createTestUsers();
    await testAuthentication();
  }
  
  if (!shouldClear && !shouldCreateUsers) {
    console.log('\nUsage:');
    console.log('  node scripts/reset-auth-users.js --clear          Clear all users and organizations');
    console.log('  node scripts/reset-auth-users.js --create         Create test users');
    console.log('  node scripts/reset-auth-users.js --clear --create Clear and create fresh test users');
    console.log('');
  }
}

main().catch(console.error);
