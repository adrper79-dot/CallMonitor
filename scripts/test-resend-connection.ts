/**
 * Test Resend Connection Script
 * 
 * Usage: npx ts-node -r tsconfig-paths/register scripts/test-resend-connection.ts
 * 
 * This script tests your Resend API connection by sending a test email.
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv'
import * as path from 'path'

// Try to load .env.local first, then .env
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

async function testResendConnection() {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@example.com'
  const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'

  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set in environment variables')
    console.log('\nTo set it up:')
    console.log('1. Get your API key from https://resend.com/api-keys')
    console.log('2. Add to .env file: RESEND_API_KEY=re_xxxxxxxxxxxxx')
    console.log('3. Add EMAIL_FROM (must be verified domain): EMAIL_FROM=noreply@yourdomain.com')
    process.exit(1)
  }

  console.log('🔗 Testing Resend API connection...')
  console.log(`From: ${EMAIL_FROM}`)
  console.log(`To: ${TEST_EMAIL}`)
  console.log(`API Key: ${RESEND_API_KEY.substring(0, 10)}...`)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [TEST_EMAIL],
        subject: 'Test Email - Resend Connection Verified',
        html: `
          <h2>✅ Resend Connection Successful!</h2>
          <p>This is a test email to verify your Resend API connection is working correctly.</p>
          <p>If you received this email, your Resend integration is properly configured.</p>
          <hr>
          <p><small>Sent from: ${EMAIL_FROM}</small></p>
        `
      })
    })

    if (res.ok) {
      const data = await res.json()
      console.log('\n✅ SUCCESS! Email sent successfully!')
      console.log('Email ID:', data.id)
      console.log('\n📧 Check your inbox at:', TEST_EMAIL)
      console.log('📊 View email logs at: https://resend.com/emails')
    } else {
      const error = await res.text()
      console.error('\n❌ FAILED to send email')
      console.error('Status:', res.status)
      console.error('Error:', error)
      
      if (res.status === 401) {
        console.error('\n💡 Tip: Check that your RESEND_API_KEY is correct and not revoked')
      } else if (res.status === 422) {
        console.error('\n💡 Tip: Verify your EMAIL_FROM domain is verified in Resend Dashboard')
        console.error('   Go to: https://resend.com/domains')
      }
    }
  } catch (err: any) {
    console.error('\n❌ Connection error:', err.message)
    console.error('💡 Check your internet connection and API key')
  }
}

testResendConnection()
