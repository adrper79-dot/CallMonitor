import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac-server'
import { sendArtifactEmail } from '@/app/services/emailService'
import { logger } from '@/lib/logger'
import { query } from '@/lib/pgClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/calls/[id]/email
 * 
 * Send call artifacts (recording, transcript, translation) via email
 * Attachments are sent directly, not as links
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params

    const session = await requireRole('viewer')
    const userId = session.user.id
    const organizationId = session.user.organizationId

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
    const { rows: callRows } = await query(
      `SELECT id, organization_id FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [callId, organizationId]
    )

    if (callRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Call not found' },
        { status: 404 }
      )
    }

    const call = callRows[0]

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
      if (result.error === 'NO_ARTIFACTS') {
        return NextResponse.json(
          { success: false, error: 'No artifacts available (recording/transcript still processing or disabled)' },
          { status: 404 }
        )
      }
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
    logger.error('POST /api/calls/[id]/email error', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
