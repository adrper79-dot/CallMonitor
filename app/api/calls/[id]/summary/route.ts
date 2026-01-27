/**
 * Call Summary API (AI-Assisted)
 * 
 * POST /api/calls/[id]/summary - Generate AI summary from call transcript
 * 
 * Per AI Role Policy (ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md):
 * - AI GENERATES summaries, humans VERIFY and CONFIRM
 * - Summaries are marked as AI-generated until human confirms
 * - "The AI proposes. The human decides."
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/calls/[id]/summary
 * Generate AI summary from call transcript
 * 
 * Per AI Role Policy: AI generates, human verifies
 */
export async function POST(
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

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      use_call_transcript = true,
      include_structured_extraction = true,
      custom_transcript,
    } = body

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

    // Get call with transcript
    const { data: call, error: callError } = await supabaseAdmin
      .from('calls')
      .select(`
        id,
        organization_id,
        direction,
        status,
        ai_summary,
        transcription,
        caller_phone_number,
        destination_phone_number,
        started_at,
        ended_at
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

    // Get transcript text
    let transcriptText = custom_transcript || ''
    
    if (use_call_transcript && !custom_transcript) {
      if (call.transcription) {
        // Handle different transcription formats
        if (typeof call.transcription === 'string') {
          transcriptText = call.transcription
        } else if (call.transcription.text) {
          transcriptText = call.transcription.text
        } else if (call.transcription.transcript) {
          transcriptText = call.transcription.transcript
        } else if (Array.isArray(call.transcription)) {
          // Array of utterances
          transcriptText = call.transcription.map((u: any) => 
            `${u.speaker || 'Unknown'}: ${u.text || ''}`
          ).join('\n')
        }
      }
    }

    if (!transcriptText || transcriptText.trim().length < 20) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NO_TRANSCRIPT', 
            message: 'Insufficient transcript content. A minimum of 20 characters is required.' 
          } 
        },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      logger.error('AI Summary failed: OPENAI_API_KEY not configured', { callId })
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'CONFIG_ERROR', 
            message: 'AI summarization is not configured. Please contact your administrator.' 
          } 
        },
        { status: 503 }
      )
    }

    // Build the AI prompt
    const systemPrompt = include_structured_extraction
      ? `You are an expert call analyst. Analyze the following call transcript and provide:
1. A concise summary (2-4 sentences) of what was discussed and any decisions made
2. A list of specific items/topics that were AGREED upon (if any)
3. A list of concerns or objections raised (if any)
4. Recommended follow-up actions (if any)

Format your response as JSON with these keys:
- "summary_text": string (the summary)
- "topics_discussed": string[] (main topics)
- "potential_agreements": string[] (things that seemed agreed upon)
- "potential_concerns": string[] (concerns, objections, or unclear items)
- "recommended_followup": string[] (suggested next steps)
- "sentiment": "positive" | "neutral" | "negative" | "mixed"

IMPORTANT: You are analyzing, not deciding. The human operator will review and confirm all extracted items. Be conservative - if something is unclear, note it as a concern rather than an agreement.`
      : `You are an expert call analyst. Provide a concise summary (2-4 sentences) of the following call transcript. Focus on what was discussed and any decisions or commitments made. Be factual and neutral.`

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Call Transcript:\n\n${transcriptText.slice(0, 12000)}` }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: include_structured_extraction ? { type: 'json_object' } : undefined
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      logger.error('OpenAI API error', { callId, status: openaiResponse.status, error: errorText })
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'AI_ERROR', 
            message: 'Failed to generate AI summary. Please try again.' 
          } 
        },
        { status: 502 }
      )
    }

    const openaiData = await openaiResponse.json()
    const aiContent = openaiData.choices?.[0]?.message?.content?.trim()

    if (!aiContent) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'AI_EMPTY', 
            message: 'AI returned an empty response. Please try again.' 
          } 
        },
        { status: 502 }
      )
    }

    // Parse the AI response
    let summaryResult: any
    
    if (include_structured_extraction) {
      try {
        summaryResult = JSON.parse(aiContent)
      } catch {
        // If JSON parsing fails, treat as plain text
        summaryResult = {
          summary_text: aiContent,
          topics_discussed: [],
          potential_agreements: [],
          potential_concerns: [],
          recommended_followup: [],
          sentiment: 'neutral'
        }
      }
    } else {
      summaryResult = {
        summary_text: aiContent,
        topics_discussed: [],
        potential_agreements: [],
        potential_concerns: [],
        recommended_followup: [],
        sentiment: 'neutral'
      }
    }

    // Store in ai_summaries table for audit
    const { data: aiSummary, error: insertError } = await supabaseAdmin
      .from('ai_summaries')
      .insert({
        call_id: callId,
        organization_id: member.organization_id,
        summary_text: summaryResult.summary_text,
        topics_discussed: summaryResult.topics_discussed || [],
        potential_agreements: summaryResult.potential_agreements || [],
        potential_concerns: summaryResult.potential_concerns || [],
        recommended_followup: summaryResult.recommended_followup || [],
        confidence_score: 0.85, // Default confidence
        model_used: 'gpt-4-turbo-preview',
        generated_by_user_id: userId,
        review_status: 'pending',
        input_length: transcriptText.length,
      })
      .select()
      .single()

    if (insertError) {
      logger.error('Failed to store AI summary', { callId, error: insertError })
      // Continue anyway - return the summary even if storage fails
    }

    logger.info('AI summary generated', { 
      callId, 
      aiSummaryId: aiSummary?.id,
      summaryLength: summaryResult.summary_text?.length,
      generatedBy: userId
    })

    return NextResponse.json({
      success: true,
      data: {
        ...summaryResult,
        ai_summary_id: aiSummary?.id,
        review_status: 'pending',
        _ai_role_notice: 'This summary was generated by AI and requires human review before confirmation.',
      },
    })

  } catch (error: any) {
    logger.error('Summary POST error', { error: error?.message || error })
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
