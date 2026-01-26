import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/pgClient'
import { parseRequestBody, xmlResponse } from '@/lib/api/utils'
import { sendEmail } from '@/app/services/emailService'
import { emitWebhookEvent } from '@/lib/webhookDelivery'
import type { SurveyQuestionConfig, SurveyQuestionType } from '@/types/tier1-features'
import { logger } from '@/lib/logger'
import { withRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

async function handleSurveyWebhook(req: Request) {
  const url = new URL(req.url)
  const callIdParam = url.searchParams.get('callId')
  const orgIdParam = url.searchParams.get('orgId')
  const questionIdx = parseInt(url.searchParams.get('q') || '1', 10)
  const totalQuestions = parseInt(url.searchParams.get('total') || '1', 10)

  void processSurveyResponseAsync(req, callIdParam, orgIdParam, questionIdx, totalQuestions).catch((err) => {
    logger.error('survey webhook async processing error', err)
  })

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

    logger.info('survey webhook processing', { hasCallSid: !!callSid, hasDigits: !!digits, questionIdx })

    let call: { id: string; organization_id: string } | null = null

    if (callIdParam) {
      const res = await query(`SELECT id, organization_id FROM calls WHERE id = $1 LIMIT 1`, [callIdParam])
      call = res.rows[0] || null
    }

    if (!call && callSid) {
      const res = await query(`SELECT id, organization_id FROM calls WHERE call_sid = $1 LIMIT 1`, [callSid])
      call = res.rows[0] || null
    }

    if (!call) return

    const vcRes = await query(
      `SELECT survey_prompts, survey_prompts_locales, survey_webhook_email, survey_question_types, translate_to FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
      [call.organization_id]
    )

    const voiceConfig = vcRes.rows[0]
    const { prompts: surveyPrompts } = resolveSurveyPrompts(voiceConfig)
    const resolvedPrompts = surveyPrompts.length > 0 ? surveyPrompts : ['On a scale of 1 to 5, how satisfied were you with this call?']

    const questionText = resolvedPrompts[questionIdx - 1] || `Question ${questionIdx}`
    const questionTypes: SurveyQuestionConfig[] = Array.isArray(voiceConfig?.survey_question_types) ? voiceConfig.survey_question_types : []
    const questionType = questionTypes.find((q) => q.index === questionIdx - 1)?.type || 'scale_1_5'

    const responseValue = mapDigitToResponseByType(digits, questionType, questionText)

    const sysRes = await query(`SELECT id FROM systems WHERE key = 'system-ai' LIMIT 1`, [])
    const systemAiId = sysRes.rows[0]?.id

    if (!systemAiId) return

    const runRes = await query(
      `SELECT id, output, status FROM ai_runs WHERE call_id = $1 AND model = 'laml-dtmf-survey' LIMIT 1`,
      [call.id]
    )

    const existingRun = runRes.rows[0]
    const now = new Date().toISOString()

    if (existingRun) {
      const existingOutput = (existingRun.output as any) || { type: 'dtmf_survey', responses: [] }
      const responses = existingOutput.responses || []

      const existingIdx = responses.findIndex((r: any) => r.question_index === questionIdx)
      const newResponse = {
        question_index: questionIdx, question: questionText, digit: digits, value: responseValue, timestamp: now
      }

      if (existingIdx >= 0) responses[existingIdx] = newResponse
      else responses.push(newResponse)

      responses.sort((a: any, b: any) => a.question_index - b.question_index)

      const isComplete = responses.length >= totalQuestions
      const wasComplete = existingRun.status === 'completed'

      await query(
        `UPDATE ai_runs SET status = $1, completed_at = $2, produced_by = 'model', is_authoritative = true, output = $3 WHERE id = $4`,
        [isComplete ? 'completed' : 'in_progress', isComplete ? now : null, JSON.stringify({
          ...existingOutput,
          responses,
          total_questions: totalQuestions,
          questions_answered: responses.length,
          call_sid: callSid,
          from_number: from,
          to_number: to
        }), existingRun.id]
      )

      if (isComplete && voiceConfig?.survey_webhook_email) {
        await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
          callId: call.id, callSid, from, to, responses, prompts: resolvedPrompts
        })
      }

      if (isComplete && !wasComplete) {
        try {
          await query(
            `INSERT INTO audit_logs (id, organization_id, action, resource_type, resource_id, actor_type, actor_label, after, created_at)
                VALUES ($1, $2, 'survey_completed', 'ai_run', $3, 'vendor', 'signalwire-survey-ai', $4, NOW())`,
            [uuidv4(), call.organization_id, existingRun.id, JSON.stringify({ call_id: call.id, responses_count: responses.length, total_questions: totalQuestions })]
          )
        } catch (e) { }

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
      const surveyRunId = uuidv4()
      const isComplete = totalQuestions === 1

      await query(
        `INSERT INTO ai_runs (id, call_id, system_id, model, status, started_at, completed_at, produced_by, is_authoritative, output)
         VALUES ($1, $2, $3, 'laml-dtmf-survey', $4, NOW(), $5, 'model', true, $6)`,
        [surveyRunId, call.id, systemAiId, isComplete ? 'completed' : 'in_progress', isComplete ? now : null, JSON.stringify({
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
        })]
      )

      if (isComplete && voiceConfig?.survey_webhook_email) {
        await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
          callId: call.id, callSid, from, to,
          responses: [{ question_index: questionIdx, question: questionText, digit: digits, value: responseValue, timestamp: now }],
          prompts: resolvedPrompts
        })
      }

      if (isComplete) {
        // Audit log insert omitted for brevity
        await emitWebhookEvent({
          organizationId: call.organization_id,
          eventType: 'survey.completed',
          eventId: surveyRunId,
          data: {
            survey_run_id: surveyRunId, call_id: call.id, call_sid: callSid,
            responses: [{ question_index: questionIdx, question: questionText, digit: digits, value: responseValue, timestamp: now }],
            total_questions: totalQuestions, questions_answered: 1,
            from_number: from, to_number: to, completed_at: now
          }
        })
      }
    }

  } catch (err: any) {
    logger.error('survey webhook processing error', err)
  }
}

function mapDigitToResponse(digit: string | undefined, question: string): string {
  if (!digit) return 'No response'
  const d = parseInt(digit, 10)
  if (question.toLowerCase().includes('scale') || question.toLowerCase().includes('1 to')) {
    if (d >= 1 && d <= 5) return `${d}/5`
    if (d >= 1 && d <= 10) return `${d}/10`
  }
  if (question.toLowerCase().includes('yes') || question.toLowerCase().includes('would you')) {
    if (d === 1) return 'Yes'
    if (d === 2) return 'No'
  }
  return digit
}

function mapDigitToResponseByType(digit: string | undefined, questionType: SurveyQuestionType, questionText: string): string {
  if (!digit) return 'No response'
  const d = parseInt(digit, 10)
  if (questionType === 'yes_no') {
    if (d === 1) return 'Yes'
    if (d === 2) return 'No'
    return 'No response'
  }
  if (questionType === 'scale_1_10') return isNaN(d) ? 'No response' : `${d}/10`
  if (questionType === 'multiple_choice') return isNaN(d) ? 'No response' : `Option ${d}`
  if (questionType === 'open_ended') return digit
  return mapDigitToResponse(digit, questionText)
}

function resolveSurveyPrompts(voiceConfig: any): { prompts: string[]; locale: string } {
  const promptLocale = voiceConfig?.translate_to || 'en'
  const localized = voiceConfig?.survey_prompts_locales?.[promptLocale]
  if (Array.isArray(localized) && localized.length > 0) return { prompts: localized, locale: promptLocale }
  const defaultPrompts = Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts : []
  return { prompts: defaultPrompts, locale: promptLocale }
}

async function sendSurveyResultsEmail(to: string, data: any) {
  const callDate = new Date().toLocaleDateString()
  const callTime = new Date().toLocaleTimeString()
  // Simplified email construction for brevity
  const html = `<p>Survey Results for Call ${data.callId}</p>`
  try {
    const result = await sendEmail({ to, subject: `Survey Results - ${callDate}`, html })
    return result
  } catch (err: any) {
    logger.error('survey webhook: email send failed', err)
    return { success: false, error: err?.message }
  }
}

export const POST = withRateLimit(handleSurveyWebhook, {
  identifier: (req) => `webhook-survey-${getClientIP(req)}`,
  config: { maxAttempts: 1000, windowMs: 60 * 1000, blockMs: 5 * 60 * 1000 }
})