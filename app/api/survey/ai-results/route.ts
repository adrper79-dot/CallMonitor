import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { sendEmail } from '@/app/services/emailService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/survey/ai-results - Receives AI Survey results from SignalWire
 */
export async function POST(req: NextRequest) {
  void processResultsAsync(req).catch((err) => {
    logger.error('survey/ai-results async processing error', err)
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processResultsAsync(req: NextRequest) {
  try {
    const results = await req.json()
    
    const url = new URL(req.url)
    const configId = url.searchParams.get('configId')
    const callIdParam = url.searchParams.get('callId')

    const conversation = results.conversation || results.messages || []
    const summary = results.summary || results.ai_summary || null
    const callMetadata = results.call || {}
    const customParams = results.params || {}
    
    const callSid = callMetadata.sid || customParams.callmonitor_call_id || callIdParam
    const organizationId = customParams.callmonitor_org_id || null

    logger.info('survey/ai-results: processing', {
      configId, messageCount: conversation.length, hasSummary: !!summary
    })

    let voiceConfig: any = null
    if (configId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
      .select('id, organization_id, survey_webhook_email, survey_prompts, survey_prompts_locales, translate_to')
        .eq('id', configId)
        .limit(1)
      
      voiceConfig = vcRows?.[0]
    }

    const finalOrgId = organizationId || voiceConfig?.organization_id || null

    let callId: string | null = null
    if (callSid) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id')
        .eq('call_sid', callSid)
        .limit(1)
      
      if (callRows?.[0]) {
        callId = callRows[0].id
        await supabaseAdmin.from('calls')
          .update({ status: 'completed', ended_at: new Date().toISOString() })
          .eq('id', callId)
      }
    }

    const { prompts: resolvedPrompts } = resolveSurveyPrompts(voiceConfig)
    const surveyResponses = extractSurveyResponses(conversation, resolvedPrompts)

    const aiRunId = uuidv4()
    await supabaseAdmin.from('ai_runs').insert({
      id: aiRunId, call_id: callId, system_id: null,
      model: 'signalwire-ai-survey', status: 'completed',
      started_at: callMetadata.start_time || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      produced_by: 'model',
      is_authoritative: true,
      output: {
        type: 'ai_survey', survey_responses: surveyResponses,
        conversation, summary, call_metadata: {
          sid: callSid, from: callMetadata.from, to: callMetadata.to,
          duration: callMetadata.duration
        }, organization_id: finalOrgId, config_id: configId
      }
    })

    logger.info('survey/ai-results: stored', { aiRunId, callId, responseCount: surveyResponses.length })

    if (voiceConfig?.survey_webhook_email) {
      try {
        const emailResult = await sendSurveyResultsEmail(voiceConfig.survey_webhook_email, {
          callSid, from: callMetadata.from, to: callMetadata.to,
          duration: callMetadata.duration, prompts: resolvedPrompts,
          responses: surveyResponses, summary, conversation
        })
        logger.info('survey/ai-results: email sent', { success: emailResult.success })
      } catch (emailErr: any) {
        logger.error('survey/ai-results: email failed', emailErr)
      }
    }

    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(), organization_id: finalOrgId, user_id: null, system_id: null,
        resource_type: 'ai_runs', resource_id: aiRunId, action: 'create',
        actor_type: 'vendor',
        actor_label: 'signalwire-ai-survey',
        before: null, after: { type: 'ai_survey', call_sid: callSid },
        created_at: new Date().toISOString()
      })
    } catch { /* Best effort */ }

  } catch (err: any) {
    logger.error('survey/ai-results processing error', err)
  }
}

function extractSurveyResponses(
  conversation: Array<{ role: string; content: string }>,
  prompts: string[]
): Array<{ question: string; answer: string }> {
  const responses: Array<{ question: string; answer: string }> = []
  
  for (let i = 0; i < conversation.length - 1; i++) {
    const current = conversation[i]
    const next = conversation[i + 1]
    
    if (current.role === 'assistant' && next.role === 'user' && current.content.includes('?')) {
      responses.push({ question: current.content.trim(), answer: next.content.trim() })
    }
  }
  
  if (responses.length === 0 && prompts.length > 0) {
    const userMessages = conversation.filter(m => m.role === 'user')
    prompts.forEach((prompt, i) => {
      if (userMessages[i]) {
        responses.push({ question: prompt, answer: userMessages[i].content.trim() })
      }
    })
  }
  
  return responses
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

async function sendSurveyResultsEmail(to: string, data: {
  callSid?: string; from?: string; to?: string; duration?: number
  prompts: string[]; responses: Array<{ question: string; answer: string }>
  summary?: string; conversation: Array<{ role: string; content: string }>
}) {
  const callDate = new Date().toLocaleDateString()
  const callTime = new Date().toLocaleTimeString()
  const durationMinutes = data.duration ? Math.ceil(data.duration / 60) : 0

  const responsesHtml = data.responses.length > 0
    ? data.responses.map((r, i) => `
        <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Q${i + 1}: ${escapeHtml(r.question)}</p>
          <p style="margin: 0; color: #334155;">${escapeHtml(r.answer)}</p>
        </div>
      `).join('')
    : '<p style="color: #64748b;">No responses captured.</p>'

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📞 Survey Results</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${callDate} at ${callTime}</p>
      </div>
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
        <p><strong>Duration:</strong> ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}</p>
      </div>
      ${data.summary ? `<div style="background: #fef3c7; padding: 16px; border: 1px solid #fcd34d; border-top: none;"><h3>📝 Summary</h3><p>${escapeHtml(data.summary)}</p></div>` : ''}
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h3>📋 Survey Responses</h3>
        ${responsesHtml}
      </div>
    </div>
  `

  return sendEmail({ to, subject: `📞 Survey Results - ${callDate} ${callTime}`, html })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/survey/ai-results', description: 'SignalWire AI Survey webhook' })
}
