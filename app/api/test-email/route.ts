import { NextResponse } from 'next/server'
import { sendEmail } from '@/app/services/emailService'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/test-email
 * 
 * Send a test email to verify Resend is working
 * Query params:
 *   - to: email address (required)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const to = url.searchParams.get('to')
  
  if (!to) {
    return NextResponse.json({
      success: false,
      error: 'Email address required. Use ?to=your@email.com'
    }, { status: 400 })
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    return NextResponse.json({
      success: false,
      error: 'Invalid email address format'
    }, { status: 400 })
  }
  
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'RESEND_API_KEY not configured',
      hint: 'Set RESEND_API_KEY in your environment variables'
    }, { status: 503 })
  }
  
  try {
    const result = await sendEmail({
      to,
      subject: '✅ CallMonitor Test Email - Resend Working!',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px;">
            <h1 style="margin: 0; font-size: 24px;">✅ Email Test Successful!</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">CallMonitor email service is working correctly.</p>
          </div>
          
          <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">What this means:</h2>
            <ul style="color: #475569;">
              <li>Resend API is configured correctly ✅</li>
              <li>Email delivery is working ✅</li>
              <li>Call artifacts will be emailed as attachments ✅</li>
            </ul>
            
            <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin-top: 16px;">
              <p style="color: #1e40af; margin: 0; font-weight: 600;">Next Steps:</p>
              <p style="color: #1e3a8a; margin: 8px 0 0 0;">When a call completes with transcription, you'll receive an email with:</p>
              <ul style="color: #1e3a8a; margin: 8px 0 0 0;">
                <li>Recording (MP3 audio file)</li>
                <li>Transcript (TXT file)</li>
                <li>Translation (if enabled)</li>
              </ul>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
              Sent: ${new Date().toLocaleString()}<br>
              From: CallMonitor Email Service
            </p>
          </div>
        </div>
      `
    })
    
    if (result.success) {
      console.log('Test email sent successfully', { to, messageId: result.messageId })
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${to}`,
        messageId: result.messageId
      })
    } else {
      console.error('Test email failed', { to, error: result.error })
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send email'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Test email error', { to, error: error?.message })
    return NextResponse.json({
      success: false,
      error: error?.message || 'Internal error'
    }, { status: 500 })
  }
}

/**
 * POST /api/test-email
 * 
 * Send a test email with custom content
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { to, subject, message } = body
    
    if (!to) {
      return NextResponse.json({
        success: false,
        error: 'Email address required'
      }, { status: 400 })
    }
    
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not configured'
      }, { status: 503 })
    }
    
    const result = await sendEmail({
      to,
      subject: subject || 'CallMonitor Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>CallMonitor Test</h2>
          <p>${message || 'This is a test email from CallMonitor.'}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">Sent: ${new Date().toLocaleString()}</p>
        </div>
      `
    })
    
    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to send email'
    }, { status: 500 })
  }
}
