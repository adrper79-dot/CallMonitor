#!/usr/bin/env node
/**
 * Test API Calls - Verify API endpoints work with authenticated owner accounts
 * Tests: organization access, audit logs, analytics, etc.
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

const testAccount = {
  email: 'test@example.com',
  password: 'test12345'
}

async function getSessionToken() {
  // Get CSRF token
  const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })
  
  const csrfData = await csrfRes.json()
  
  // Login
  const loginRes = await fetch(`${API_BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      username: testAccount.email,
      password: testAccount.password,
      csrfToken: csrfData.csrfToken
    })
  })
  
  const loginData = await loginRes.json()
  return loginData.sessionToken
}

async function testApiCalls() {
  console.log('\n' + '='.repeat(70))
  console.log('🚀 Testing API Calls with Owner Account')
  console.log('='.repeat(70))
  
  try {
    // Get session token
    console.log('\n📝 Getting session token...')
    const sessionToken = await getSessionToken()
    console.log('✅ Session token obtained')
    
    // Test 1: Get current user
    console.log('\n📝 Test 1: Getting current user info...')
    const userRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    
    if (!userRes.ok) {
      console.error('❌ Failed to get user info:', userRes.status)
    } else {
      const userData = await userRes.json()
      console.log('✅ User info retrieved:', {
        id: userData.id?.slice(0, 8) + '...',
        email: userData.email,
        role: userData.role
      })
    }
    
    // Test 2: Get organizations
    console.log('\n📝 Test 2: Getting organizations...')
    const orgsRes = await fetch(`${API_BASE}/api/organizations`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    
    if (!orgsRes.ok) {
      console.error('❌ Failed to get organizations:', orgsRes.status)
      const errData = await orgsRes.json()
      console.error('   Error:', errData)
    } else {
      const orgsData = await orgsRes.json()
      console.log('✅ Organizations retrieved:', {
        count: orgsData.length,
        orgs: orgsData.slice(0, 2).map(o => ({ id: o.id?.slice(0, 8) + '...', name: o.name }))
      })
    }
    
    // Test 3: Get audit logs
    console.log('\n📝 Test 3: Getting audit logs...')
    const auditRes = await fetch(`${API_BASE}/api/audit-logs?limit=5`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    
    if (!auditRes.ok) {
      console.error('❌ Failed to get audit logs:', auditRes.status)
      const errData = await auditRes.json()
      console.error('   Error:', errData)
    } else {
      const auditData = await auditRes.json()
      console.log('✅ Audit logs retrieved:', {
        count: auditData.length,
        latest: auditData[0] ? {
          action: auditData[0].action,
          timestamp: auditData[0].created_at?.slice(0, 19)
        } : null
      })
    }
    
    // Test 4: Get settings
    console.log('\n📝 Test 4: Getting settings...')
    const settingsRes = await fetch(`${API_BASE}/api/settings`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    
    if (!settingsRes.ok) {
      console.error('❌ Failed to get settings:', settingsRes.status)
      const errData = await settingsRes.json()
      console.error('   Error:', errData)
    } else {
      const settingsData = await settingsRes.json()
      console.log('✅ Settings retrieved:', {
        keys: Object.keys(settingsData).slice(0, 3)
      })
    }
    
    // Test 5: Get analytics
    console.log('\n📝 Test 5: Getting analytics...')
    const analyticsRes = await fetch(`${API_BASE}/api/analytics`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })
    
    if (!analyticsRes.ok) {
      console.error('❌ Failed to get analytics:', analyticsRes.status)
      const errData = await analyticsRes.json()
      console.error('   Error:', errData)
    } else {
      const analyticsData = await analyticsRes.json()
      console.log('✅ Analytics retrieved:', {
        status: analyticsData.status || 'ok'
      })
    }
    
    console.log('\n' + '='.repeat(70))
    console.log('✅ API tests completed!')
    console.log('='.repeat(70) + '\n')
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message)
    console.error(err)
  }
}

testApiCalls()
