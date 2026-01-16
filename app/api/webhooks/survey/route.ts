import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { parseRequestBody, xmlResponse } from '@/lib/api/utils'
import { sendEmail } from '@/app/services/emailService'
import { emitWebhookEvent } from '@/lib/webhookDelivery'
import type { SurveyQuestionConfig, SurveyQuestionType } from '@/types/tier1-features'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Survey Response Webhook Handler - processes DTMF survey responses
 * 
 * Per ARCH_DOCS standards:
 * - Receives DTMF digit responses from LaML <Gather>
 * - Maps responses to configured survey questions
 * - Marks results as 'completed' (not 'queued')
 * - Sends email to survey_webhook_email if configured
 */
export async function POST(req: Request) {
  // Parse URL params for question tracking
  const url = new URL(req.url)
  const callIdParam = url.searchParams.get('callId')
  const orgIdParam = url.searchParams.get('orgId')
  const questionIdx = parseInt(url.searchParams.get('q') || '1', 10)
  const totalQuestions = parseInt(url.searchParams.get('total') || '1', 10)
  
  // Process asynchronously but return LaML to continue call flow
  void processSurveyResponseAsync(req, callIdParam, orgIdParam, questionIdx, totalQuestions).catch((err) => {
    logger.error('survey webhook async processing error', err)
  })

  // Return empty response - LaML flow handles progression
  return xmlResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
}

async function processSurveyResponseAsync(
  req: Request, 
  callIdParam: string | null,
  orgIdParam: string | null,
  questionIdx: number,
  totalQuestions: number
) {
  try {
    const payload = await parseRequestBody(req)

    const callSid = payload.CallSid || payload.call_sid
    const digits = payload.Digits || payload.digits || payload.DTMF || payload.dtmf
    const from = payload.From || payload.from
    const to = payload.To || payload.to

    logger.info('survey webhook processing', { 
      hasCallSid: !!callSid, 
      hasDigits: !!digits,
      callIdParam,
      questionIdx,
      totalQuestions
    })

    // Find the call - try by callId param first, then by call_sid
    let call: { id: string; organization_id: string } | null = null
    
    if (callIdParam) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id')
        .eq('id', callIdParam)
        .limit(1)
      call = callRows?.[0] || null
    }
    
    if (!call && callSid) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id, organization_id')
        .eq('call_sid', callSid)
        .limit(1)
      call = callRows?.[0] || null
    }

    if (!call) {
      logger.warn('survey webhook: call not found', { callIdParam, callSid })
      return
    }

    // Load voice_configs for survey prompts and email
    const { data: vcRows } = await supabaseAdmin
      .from('voice_configs')
      .select('survey_prompts, survey_prompts_locales, survey_webhook_email, survey_question_types, translate_to')
      .eq('organization_id', call.organization_id)
      .limit(1)
    
    const voiceConfig = vcRows?.[0]
    const { prompts: surveyPrompts } = resolveSurveyPrompts(voiceConfig)
    const resolvedPrompts = surveyPrompts.length > 0
      ? surveyPrompts
      : ['On a scale of 1 to 5, how satisfied were you with this call?']
    
    // Get the question that was answered
    const questionText = resolvedPrompts[questionIdx - 1] || `Question ${questionIdx}`
    const questionTypes: SurveyQuestionConfig[] = Array.isArray(voiceConfig?.survey_question_types)
      ? voiceConfig.survey_question_types
      : []
    const questionType = questionTypes.find((q) => q.index === questionIdx - 1)?.type || 'scale_1_5'
    
    // Map digit to response value
    const responseValue = mapDigitToResponseByType(digits, questionType, questionText)

    const { data: systemsRows } = await supabaseAdmin
      .from('systems')
      .select('id')
      .eq('key', 'system-ai')
      .limit(1)

    const systemAiId = systemsRows?.[0]?.id
    if (!systemAiId) {
      logger.warn('survey webhook: system-ai not found')
      return
    }

    // Check if we already have a survey run for this call
    const { data: existingRuns } = await supabaseAdmin
      .from('ai_runs')
      .select('id, output, status')
      .eq('call_id', call.id)
      .eq('model', 'laml-dtmf-survey')
      .limit(1)
    
    const existingRun = existingRuns?.[0]
    const now = new Date().toISOString()
    
    if (existingRun) {
      // Update existing survey run with new response
      const existingOutput = (existingRun.output as any) || { type: 'dtmf_survey', responses: [] }
      const responses = existingOutput.responses || []
      
      // Add or update response for this question
      const existingIdx = responses.findIndex((r: any) => r.question_index === questionIdx)
      const newResponse = {
        question_index: questionIdx,
        question: questionText,
        digit: digits,
        value: responseValue,
        timestamp: now
      }
      
      if (existingIdx >= 0) {
        responses[existingIdx] = newResponse
      } else {
        responses.push(newResponse)
      }
      
      // Sort by question index
      responses.sort((a: any, b: any) => a.question_index - b.question_index)
      
      // Check if survey is complete
      const isComplete = responses.length >= totalQuestions
      const wasComplete = existingRun.status === 'completed'
      
      await supabaseAdmin
        .from('ai_runs')
        .update({
          status: isComplete ? 'completed' : 'in_progress',
          completed_at: isComplete ? now : null,
          output: {
            ...existingOutput,
            responses,
            total_questions: totalQuestions,
            questions_answered: responses.length,
            call_sid: callSid,
            from_number: from,
            to_number: to
          }
        })
        .eq('id', existingRun.id)
      
      logger.info('survey webhook: updated existing run', { 
        surveyRunId: existingRun.id, 
        callId: call.id,
        questionIdx,
        responsesCount: responses.length,
        isComplete
      })
      
      // Send email if survey is complete and email configured
      if (isComplete && voiceConfig?.survey_webhook_email) {
        await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
          callId: call.id,
          callSid,
          from,
          to,
          responses,
          prompts: resolvedPrompts
        })
      }

      // Emit webhook event when survey completes (once)
      if (isComplete && !wasComplete) {
        await emitWebhookEvent({
          organizationId: call.organization_id,
          eventType: 'survey.completed',
          eventId: existingRun.id,
          data: {
            survey_run_id: existingRun.id,
            call_id: call.id,
            call_sid: callSid,
            responses,
            total_questions: totalQuestions,
            questions_answered: responses.length,
            from_number: from,
            to_number: to,
            completed_at: now
          }
        })
      }
      
    } else {
      // Create new survey run
      const surveyRunId = uuidv4()
      const isComplete = totalQuestions === 1
      
      await supabaseAdmin.from('ai_runs').insert({
        id: surveyRunId, 
        call_id: call.id, 
        system_id: systemAiId,
        model: 'laml-dtmf-survey',
        status: isComplete ? 'completed' : 'in_progress',
        started_at: now,
        completed_at: isComplete ? now : null,
        output: { 
          type: 'dtmf_survey',
          responses: [{
            question_index: questionIdx,
            question: questionText,
            digit: digits,
            value: responseValue,
            timestamp: now
          }],
          total_questions: totalQuestions,
          questions_answered: 1,
          call_sid: callSid, 
          from_number: from,
          to_number: to
        }
      })

      logger.info('survey webhook: created new run', { 
        surveyRunId, 
        callId: call.id,
        questionIdx,
        isComplete 
      })
      
      // Send email if single-question survey and email configured
      if (isComplete && voiceConfig?.survey_webhook_email) {
        await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
          callId: call.id,
          callSid,
          from,
          to,
          responses: [{
            question_index: questionIdx,
            question: questionText,
            digit: digits,
            value: responseValue,
            timestamp: now
          }],
          prompts: resolvedPrompts
        })
      }

      // Emit webhook event when survey completes
      if (isComplete) {
        await emitWebhookEvent({
          organizationId: call.organization_id,
          eventType: 'survey.completed',
          eventId: surveyRunId,
          data: {
            survey_run_id: surveyRunId,
            call_id: call.id,
            call_sid: callSid,
            responses: [{
              question_index: questionIdx,
              question: questionText,
              digit: digits,
              value: responseValue,
              timestamp: now
            }],
            total_questions: totalQuestions,
            questions_answered: 1,
            from_number: from,
            to_number: to,
            completed_at: now
          }
        })
      }
    }

  } catch (err: any) {
    logger.error('survey webhook processing error', err)
  }
}

/**
 * Map DTMF digit to meaningful response value
 */
function mapDigitToResponse(digit: string | undefined, question: string): string {
  if (!digit) return 'No response'
  
  const d = parseInt(digit, 10)
  
  // For scale questions (1-5 or 1-10)
  if (question.toLowerCase().includes('scale') || question.toLowerCase().includes('1 to')) {
    if (d >= 1 && d <= 5) {
      const labels = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
      return `${d}/5 - ${labels[d - 1]}`
    }
    if (d >= 1 && d <= 10) {
      return `${d}/10`
    }
  }
  
  // For yes/no questions
  if (question.toLowerCase().includes('yes') || question.toLowerCase().includes('would you')) {
    if (d === 1) return 'Yes'
    if (d === 2) return 'No'
  }
  
  // Default: return the digit
  return digit
}

function mapDigitToResponseByType(
  digit: string | undefined,
  questionType: SurveyQuestionType,
  questionText: string
): string {
  if (!digit) return 'No response'
  const d = parseInt(digit, 10)

  if (questionType === 'yes_no') {
    if (d === 1) return 'Yes'
    if (d === 2) return 'No'
    return 'No response'
  }

  if (questionType === 'scale_1_10') {
    if (Number.isNaN(d)) return 'No response'
    return `${d}/10`
  }

  if (questionType === 'multiple_choice') {
    if (Number.isNaN(d)) return 'No response'
    return `Option ${d}`
  }

  if (questionType === 'open_ended') {
    return digit
  }

  return mapDigitToResponse(digit, questionText)
}

function resolveSurveyPrompts(voiceConfig: any): { prompts: string[]; locale: string } {
  const promptLocale = voiceConfig?.translate_to || 'en'
  const localized = voiceConfig?.survey_prompts_locales?.[promptLocale]
  if (Array.isArray(localized) && localized.length > 0) {
    return { prompts: localized, locale: promptLocale }
  }

  const defaultPrompts = Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts : []
  return { prompts: defaultPrompts, locale: promptLocale }
}

/**
 * Send survey results email using existing email service
 */
async function sendSurveyResultsEmail(to: string, data: {
  callId: string
  callSid?: string
  from?: string
  to?: string
  responses: Array<{ question_index: number; question: string; digit?: string; value: string; timestamp: string }>
  prompts: string[]
}) {
  const callDate = new Date().toLocaleDateString()
  const callTime = new Date().toLocaleTimeString()

  const responsesHtml = data.responses.length > 0
    ? data.responses.map((r) => `
        <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Q${r.question_index}: ${escapeHtml(r.question)}</p>
          <p style="margin: 0; color: #334155; font-size: 18px;">${escapeHtml(r.value)}</p>
          ${r.digit ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">DTMF input: ${r.digit}</p>` : ''}
        </div>
      `).join('')
    : '<p style="color: #64748b;">No responses captured.</p>'

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Survey Results</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${callDate} at ${callTime}</p>
      </div>
      <div style="background: #f8fafc; padding: 16px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0;"><strong>Call ID:</strong> ${data.callId.substring(0, 8)}...</p>
        ${data.from ? `<p style="margin: 4px 0 0 0;"><strong>From:</strong> ${data.from}</p>` : ''}
        ${data.to ? `<p style="margin: 4px 0 0 0;"><strong>To:</strong> ${data.to}</p>` : ''}
      </div>
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h3 style="margin: 0 0 16px 0; color: #1e293b;">Responses (${data.responses.length}/${data.prompts.length})</h3>
        ${responsesHtml}
      </div>
      <p style="margin-top: 16px; color: #64748b; font-size: 12px; text-align: center;">
        Sent by Word Is Bond Survey System
      </p>
    </div>
  `

  try {
    const result = await sendEmail({ 
      to, 
      subject: `Survey Results - ${callDate} ${callTime}`, 
      html 
    })
    logger.info('survey webhook: email sent', { success: result.success, to })
    return result
  } catch (err: any) {
    logger.error('survey webhook: email send failed', err)
    return { success: false, error: err?.message }
  }
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
