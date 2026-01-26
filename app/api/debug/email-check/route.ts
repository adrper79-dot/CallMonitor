import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/email-check?callId=xxx
 * 
 * Debug endpoint to check if a call has all the artifacts needed for email
 */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const callId = url.searchParams.get('callId')

        if (!callId) {
            return NextResponse.json({
                error: 'Missing callId parameter',
                usage: '/api/debug/email-check?callId=YOUR_CALL_ID'
            }, { status: 400 })
        }

        // Check call exists
        const { data: callRows } = await supabaseAdmin
            .from('calls')
            .select('id, organization_id, status, started_at, ended_at')
            .eq('id', callId)
            .limit(1)

        const call = callRows?.[0]
        if (!call) {
            return NextResponse.json({ error: 'Call not found', callId }, { status: 404 })
        }

        // Check recording
        const { data: recRows } = await supabaseAdmin
            .from('recordings')
            .select('id, recording_url, duration_seconds, status, transcript_json')
            .eq('call_id', callId)
            .limit(1)

        const recording = recRows?.[0]
        const hasRecording = !!recording?.recording_url
        const hasTranscript = !!recording?.transcript_json

        // Check translations
        const { data: aiRows } = await supabaseAdmin
            .from('ai_runs')
            .select('id, model, status, output')
            .eq('call_id', callId)
            .in('model', ['assemblyai-translation', 'openai-translation'])
            .eq('status', 'completed')
            .limit(1)

        const translation = aiRows?.[0]
        const hasTranslation = !!translation?.output

        // Check Resend config
        const resendConfigured = !!process.env.RESEND_API_KEY
        const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'Wordis Bond <onboarding@resend.dev>'

        // Test recording URL accessibility
        let recordingAccessible = false
        let recordingError: string | null = null
        if (recording?.recording_url) {
            try {
                const testResponse = await fetch(recording.recording_url, { method: 'HEAD' })
                recordingAccessible = testResponse.ok
                if (!testResponse.ok) {
                    recordingError = `HTTP ${testResponse.status}`
                }
            } catch (err: any) {
                recordingError = err?.message || 'Fetch failed'
            }
        }

        return NextResponse.json({
            callId,
            call: {
                status: call.status,
                started_at: call.started_at,
                ended_at: call.ended_at
            },
            artifacts: {
                hasRecording,
                hasTranscript,
                hasTranslation,
                recordingUrl: recording?.recording_url ? '[PRESENT]' : null,
                recordingAccessible,
                recordingError,
                recordingDuration: recording?.duration_seconds,
                transcriptWordCount: recording?.transcript_json?.words?.length || null,
                translationModel: translation?.model || null
            },
            email: {
                resendConfigured,
                fromAddress: resendFromEmail
            },
            canSendEmail: hasRecording || hasTranscript || hasTranslation,
            hint: !hasRecording && !hasTranscript ?
                'No recording or transcript found. The call may not have completed or transcription may have failed.' :
                'Artifacts are available for email.'
        })

    } catch (error: any) {
        logger.error('Debug email-check error', error)
        return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
    }
}
