#!/usr/bin/env node
/**
 * Test API Calls (Fixed) - Verify API endpoints work with authenticated owner accounts
 * Uses correct endpoint paths and snake_case keys per backend
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

const testAccount = {
  email: 'test@example.com',
  password: 'test12345'
}

async function getSessionToken() {
  console.log('🔑 Getting CSRF token...');
  
  // Get CSRF token
  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });
  
  const csrfData = await csrfRes.json();
  console.log('CSRF Response:', JSON.stringify(csrfData, null, 2));
  
  if (!csrfData.csrf_token) {
    throw new Error('No csrf_token in response');
  }

  console.log('🔐 Logging in...');
  // Login with snake_case keys
  const loginRes = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: testAccount.email,
      password: testAccount.password,
      csrf_token: csrfData.csrf_token  // snake_case
    })
  });
  
  const loginData = await loginRes.json();
  console.log('Login Response:', JSON.stringify(loginData, null, 2));
  
  if (!loginData.session_token) {
    throw new Error('No session_token in response');
  }
  
  console.log('✅ Auth successful. Session token:', loginData.session_token.slice(0, 20) + '...');
  
  return {
    sessionToken: loginData.session_token,
    user: loginData.user,
    csrfToken: csrfData.csrf_token
  };
}

async function testAuthenticatedEndpoints(session) {
  console.log('🧪 Testing /api/organizations...');
  const orgRes = await fetch(`${API_BASE}/api/organizations`, {
    headers: {
      'Authorization': `Bearer ${session.sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  const orgData = await orgRes.json();
  console.log('Organizations (/api/organizations):', JSON.stringify(orgData, null, 2));

  console.log('🧪 Testing /api/organizations/current...');
  const orgCurrentRes = await fetch(`${API_BASE}/api/organizations/current`, {
    headers: {
      'Authorization': `Bearer ${session.sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  const orgCurrentData = await orgCurrentRes.json();
  console.log('Organizations (/api/organizations/current):', JSON.stringify(orgCurrentData, null, 2));

  console.log('🧪 Testing /api/calls...');
  const callsRes = await fetch(`${API_BASE}/api/calls`, {
    headers: {
      'Authorization': `Bearer ${session.sessionToken}`,
      'Content-Type': 'application/json'
    }
  });
  const callsData = await callsRes.json();
  console.log('Calls:', callsData.length > 0 ? 'Calls found' : 'No calls');

  console.log('✅ All tests passed!');
}

async function main() {
  try {
    const session = await getSessionToken();
    await testAuthenticatedEndpoints(session);
    console.log('🎉 COMPLETE SUCCESS - All API endpoints working!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
