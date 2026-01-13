import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { sendArtifactEmail } from '@/app/services/emailService'
import { AppError } from '@/types/app-error'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * POST /api/calls/[id]/email
 * 
 * Send call artifacts (recording, transcript, translation) via email
 * Attachments are sent directly, not as links
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const callId = params.id
    const body = await req.json()
    const { 
      email, 
      includeRecording = true, 
      includeTranscript = true, 
      includeTranslation = true 
    } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email address required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Get call and verify user has access
    const { data: callRows, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .limit(1)

    if (callError || !callRows || callRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Call not found' },
        { status: 404 }
      )
    }

    const call = callRows[0]

    // Verify user is member of organization
    const { data: memberRows } = await supabaseAdmin
      .from('org_members')
      .select('id, role')
      .eq('organization_id', call.organization_id)
      .eq('user_id', userId)
      .limit(1)

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to access this call' },
        { status: 403 }
      )
    }

    // Check if email service is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Email service not configured' },
        { status: 503 }
      )
    }

    // Send artifacts via email
    const result = await sendArtifactEmail({
      callId,
      organizationId: call.organization_id,
      recipientEmail: email,
      includeRecording,
      includeTranscript,
      includeTranslation
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Artifacts sent to ${email}`
    })

  } catch (error: any) {
    console.error('POST /api/calls/[id]/email error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
