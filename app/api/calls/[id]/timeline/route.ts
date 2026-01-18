/**
 * Call Timeline API
 * 
 * GET /api/calls/[id]/timeline - Get full timeline for a call
 * 
 * Per MASTER_ARCHITECTURE: Call is root object
 * Timeline aggregates all artifacts and events attached to a call
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { TimelineEvent, TimelineEventType, CallTimeline } from '@/types/tier1-features'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/calls/[id]/timeline
 * Get chronological timeline of all events for a call
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: callId } = await params
    
    // Authenticate
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    
    // Validate UUID format
    if (!callId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callId)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CALL_ID', message: 'Invalid call ID format' } },
        { status: 400 }
      )
    }
    
    // Get user's organization
    const { data: member, error: memberError } = await supabaseAdmin
      .from('org_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single()
    
    if (memberError || !member) {
      return NextResponse.json(
        { success: false, error: { code: 'ACCESS_DENIED', message: 'Organization membership not found' } },
        { status: 403 }
      )
    }
    
    // Get call with related data
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select(`
        *,
        created_by_user:users!calls_created_by_fkey (email),
        disposition_user:users!calls_disposition_set_by_fkey (email)
      `)
      .eq('id', callId)
      .eq('organization_id', member.organization_id)
      .single()
    
    if (callError || !call) {
      return NextResponse.json(
        { success: false, error: { code: 'CALL_NOT_FOUND', message: 'Call not found' } },
        { status: 404 }
      )
    }
    
    // Build timeline events
    const events: TimelineEvent[] = []
    
    // 1. Call started
    if (call.started_at) {
      events.push({
        id: `${callId}-started`,
        call_id: callId,
        event_type: 'call_started',
        timestamp: call.started_at,
        actor_id: call.created_by,
        actor_name: call.created_by_user?.email || null,
        details: {
          status: call.status
        }
      })
    }
    
    // 2. Call completed
    if (call.ended_at) {
      const duration = call.started_at 
        ? new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()
        : 0
      
      events.push({
        id: `${callId}-completed`,
        call_id: callId,
        event_type: 'call_completed',
        timestamp: call.ended_at,
        actor_id: null,
        actor_name: null,
        details: {
          status: call.status
        },
        metadata: {
          duration_ms: duration,
          status: call.status
        }
      })
    }
    
    // 3. Consent captured
    if (call.consent_timestamp) {
      events.push({
        id: `${callId}-consent`,
        call_id: callId,
        event_type: 'consent_captured',
        timestamp: call.consent_timestamp,
        actor_id: call.consent_verified_by,
        actor_name: null,
        details: {
          method: call.consent_method
        }
      })
    }
    
    // 4. Disposition set
    if (call.disposition_set_at) {
      events.push({
        id: `${callId}-disposition`,
        call_id: callId,
        event_type: 'disposition_set',
        timestamp: call.disposition_set_at,
        actor_id: call.disposition_set_by,
        actor_name: call.disposition_user?.email || null,
        details: {
          disposition: call.disposition,
          notes: call.disposition_notes
        }
      })
    }
    
    // 5. Get recordings
    const { data: recordings } = await supabaseAdmin
      .from('recordings')
      .select('*')
      .eq('call_sid', call.call_sid)
    
    let hasRecording = false
    let hasTranscript = false
    
    for (const recording of recordings || []) {
      hasRecording = true
      
      // Recording available
      events.push({
        id: `${recording.id}-recording`,
        call_id: callId,
        event_type: 'recording_completed',
        timestamp: recording.created_at,
        actor_id: null,
        actor_name: null,
        details: {
          recording_id: recording.id
        },
        metadata: {
          duration_ms: (recording.duration_seconds || 0) * 1000,
          artifact_id: recording.id
        }
      })
      
      // Transcript completed
      if (recording.transcript_json) {
        hasTranscript = true
        events.push({
          id: `${recording.id}-transcript`,
          call_id: callId,
          event_type: 'transcript_completed',
          timestamp: recording.updated_at,
          actor_id: null,
          actor_name: null,
          details: {},
          metadata: {
            artifact_id: recording.id
          }
        })
      }
    }
    
    // 6. Get AI runs (translations, etc)
    const { data: aiRuns } = await supabaseAdmin
      .from('ai_runs')
      .select('*')
      .eq('call_id', callId)
    
    let hasTranslation = false
    
    for (const run of aiRuns || []) {
      if (run.model?.includes('translation') && run.status === 'completed') {
        hasTranslation = true
        events.push({
          id: `${run.id}-translation`,
          call_id: callId,
          event_type: 'translation_completed',
          timestamp: run.completed_at || run.started_at,
          actor_id: null,
          actor_name: null,
          details: {
            model: run.model
          },
          metadata: {
            artifact_id: run.id
          }
        })
      }
    }
    
    // 7. Get notes
    const { data: notes } = await supabaseAdmin
      .from('call_notes')
      .select(`
        *,
        creator:users!call_notes_created_by_fkey (email)
      `)
      .eq('call_id', callId)
    
    for (const note of notes || []) {
      events.push({
        id: `${note.id}-note`,
        call_id: callId,
        event_type: 'note_added',
        timestamp: note.created_at,
        actor_id: note.created_by,
        actor_name: note.creator?.email || null,
        details: {
          tags: note.tags,
          note: note.note
        }
      })
    }
    
    // 8. Get scorecards
    const { data: scoredRecordings } = await supabaseAdmin
      .from('scored_recordings')
      .select('*')
      .in('recording_id', (recordings || []).map(r => r.id))
    
    let hasScorecard = false
    
    for (const scored of scoredRecordings || []) {
      hasScorecard = true
      events.push({
        id: `${scored.id}-scorecard`,
        call_id: callId,
        event_type: 'scorecard_generated',
        timestamp: scored.created_at,
        actor_id: null,
        actor_name: null,
        details: {
          total_score: scored.total_score
        },
        metadata: {
          artifact_id: scored.id
        }
      })
    }
    
    // 9. Get evidence exports
    const { data: manifests } = await supabaseAdmin
      .from('evidence_manifests')
      .select('*')
      .in('recording_id', (recordings || []).map(r => r.id))
    
    for (const manifest of manifests || []) {
      events.push({
        id: `${manifest.id}-export`,
        call_id: callId,
        event_type: 'evidence_exported',
        timestamp: manifest.created_at,
        actor_id: null,
        actor_name: null,
        details: {},
        metadata: {
          artifact_id: manifest.id
        }
      })
    }
    
    // 10. Get survey responses (if any)
    // Note: This would require a survey_responses table linked to calls
    let hasSurvey = false
    
    // Sort events by timestamp
    events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    
    // Calculate total duration
    const totalDuration = call.started_at && call.ended_at
      ? new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()
      : 0
    
    // Build timeline response
    const timeline: CallTimeline = {
      call_id: callId,
      events,
      summary: {
        total_events: events.length,
        duration_ms: totalDuration,
        has_recording: hasRecording,
        has_transcript: hasTranscript,
        has_translation: hasTranslation,
        has_survey: hasSurvey,
        has_scorecard: hasScorecard,
        disposition: call.disposition
      }
    }
    
    return NextResponse.json({
      success: true,
      timeline
    })
  } catch (error: any) {
    logger.error('[timeline GET] Error', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
