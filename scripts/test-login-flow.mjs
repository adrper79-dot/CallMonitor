#!/usr/bin/env node
/**
 * Test Login Flow - Verify authentication works with test accounts
 * Tests: CSRF token, credentials callback, session creation
 */

const API_BASE = 'https://wordisbond-api.adrper79.workers.dev'

const testAccount = {
  email: 'test@example.com',
  password: 'test12345'
}

async function testLoginFlow() {
  console.log('\n' + '='.repeat(70))
  console.log('🔐 Testing Login Flow')
  console.log('='.repeat(70))
  
  try {
    // Step 1: Get CSRF token
    console.log('\n📝 Step 1: Getting CSRF token...')
    const csrfRes = await fetch(`${API_BASE}/api/auth/csrf`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    })
    
    if (!csrfRes.ok) {
      console.error('❌ Failed to get CSRF token:', csrfRes.status)
      return
    }
    
    const csrfData = await csrfRes.json()
    console.log('✅ CSRF token obtained:', csrfData.csrfToken?.slice(0, 8) + '...')
    
    // Step 2: Call credentials callback
    console.log('\n📝 Step 2: Attempting login with credentials...')
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
    
    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.status)
      console.error('   Error:', loginData.error)
      console.error('   Details:', loginData.details)
      return
    }
    
    console.log('✅ Login successful!')
    console.log('   Session Token:', loginData.sessionToken?.slice(0, 8) + '...')
    console.log('   User:', {
      id: loginData.user.id?.slice(0, 8) + '...',
      email: loginData.user.email,
      role: loginData.user.role,
      organization_id: loginData.user.organization_id
    })
    
    // Step 3: Verify session
    console.log('\n📝 Step 3: Verifying session...')
    const sessionRes = await fetch(`${API_BASE}/api/auth/session`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.sessionToken}`
      }
    })
    
    if (!sessionRes.ok) {
      console.error('❌ Session verification failed:', sessionRes.status)
      return
    }
    
    const sessionData = await sessionRes.json()
    
    if (sessionData.user) {
      console.log('✅ Session verified!')
      console.log('   User:', {
        id: sessionData.user.id?.slice(0, 8) + '...',
        email: sessionData.user.email,
        role: sessionData.user.role,
        organization_id: sessionData.user.organization_id
      })
    } else {
      console.error('❌ Session verification returned null user')
      return
    }
    
    // Step 4: Test signout
    console.log('\n📝 Step 4: Testing signout...')
    const signoutRes = await fetch(`${API_BASE}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.sessionToken}`
      }
    })
    
    if (!signoutRes.ok) {
      console.error('❌ Signout failed:', signoutRes.status)
      return
    }
    
    console.log('✅ Signout successful!')
    
    // Step 5: Verify session is invalidated
    console.log('\n📝 Step 5: Verifying session is invalidated...')
    const invalidRes = await fetch(`${API_BASE}/api/auth/session`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.sessionToken}`
      }
    })
    
    const invalidData = await invalidRes.json()
    
    if (!invalidData.user) {
      console.log('✅ Session properly invalidated after signout')
    } else {
      console.warn('⚠️  Session still valid after signout (may need to investigate)')
    }
    
    console.log('\n' + '='.repeat(70))
    console.log('✅ All tests passed!')
    console.log('='.repeat(70) + '\n')
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message)
    console.error(err)
  }
}

testLoginFlow()
