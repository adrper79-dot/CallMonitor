import { NextResponse } from 'next/server'
import { sendEmail } from '@/app/services/emailService'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/test-email - Send a test email to verify Resend is working
 * SECURITY: Requires authentication and disabled in production
 */
export async function GET(req: Request) {
  // SECURITY: Disable in production - testing endpoints should not be exposed
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      success: false, 
      error: 'Test email endpoint disabled in production' 
    }, { status: 403 })
  }

  // SECURITY: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ 
      success: false, 
      error: 'Authentication required' 
    }, { status: 401 })
  }

  const url = new URL(req.url)
  const to = url.searchParams.get('to')
  
  if (!to) {
    return NextResponse.json({ success: false, error: 'Email address required. Use ?to=your@email.com' }, { status: 400 })
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(to)) {
    return NextResponse.json({ success: false, error: 'Invalid email address format' }, { status: 400 })
  }
  
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: false, error: 'RESEND_API_KEY not configured', hint: 'Set RESEND_API_KEY in your environment variables' }, { status: 503 })
  }
  
  try {
    const result = await sendEmail({
      to,
      subject: '✅ Word Is Bond Test Email - Resend Working!',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px;">
            <h1 style="margin: 0; font-size: 24px;">✅ Email Test Successful!</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Word Is Bond email service is working correctly.</p>
          </div>
          <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1e293b; margin-top: 0;">What this means:</h2>
            <ul style="color: #475569;">
              <li>Resend API is configured correctly ✅</li>
              <li>Email delivery is working ✅</li>
              <li>Call artifacts will be emailed as attachments ✅</li>
            </ul>
            <p style="color: #64748b; font-size: 14px; margin-top: 24px;">Sent: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    })
    
    if (result.success) {
      logger.info('Test email sent successfully', { messageId: result.messageId })
      return NextResponse.json({ success: true, message: `Test email sent to ${to}`, messageId: result.messageId })
    } else {
      logger.error('Test email failed', result.error)
      return NextResponse.json({ success: false, error: result.error || 'Failed to send email' }, { status: 500 })
    }
  } catch (error: any) {
    logger.error('Test email error', error)
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  // SECURITY: Disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Disabled in production' }, { status: 403 })
  }

  // SECURITY: Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { to, subject, message } = body
    
    if (!to) {
      return NextResponse.json({ success: false, error: 'Email address required' }, { status: 400 })
    }
    
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: false, error: 'RESEND_API_KEY not configured' }, { status: 503 })
    }
    
    const result = await sendEmail({
      to, subject: subject || 'Word Is Bond Test Email',
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Word Is Bond Test</h2><p>${message || 'This is a test email from Word Is Bond.'}</p><hr><p style="color: #666; font-size: 12px;">Sent: ${new Date().toLocaleString()}</p></div>`
    })
    
    return NextResponse.json({ success: result.success, messageId: result.messageId, error: result.error })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send email' }, { status: 500 })
  }
}
