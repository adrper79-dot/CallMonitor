import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { sendEmail } from '@/app/services/emailService'

// Force dynamic rendering - webhooks must be processed dynamically
export const dynamic = 'force-dynamic'

/**
 * POST /api/survey/ai-results
 * 
 * Receives AI Survey results from SignalWire post_prompt_url webhook.
 * Stores results in ai_runs and sends email if configured.
 * 
 * SignalWire sends conversation data including:
 * - conversation: Array of {role, content} messages
 * - summary: AI-generated summary
 * - call: {sid, from, to, duration, ...}
 * - params: Custom params we passed (callmonitor_call_id, etc.)
 */
export async function POST(req: NextRequest) {
  // Return 200 OK immediately to acknowledge receipt
  void processResultsAsync(req).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('survey/ai-results async processing error', { error: err?.message ?? String(err) })
  })

  return NextResponse.json({ ok: true, received: true })
}

async function processResultsAsync(req: NextRequest) {
  try {
    const results = await req.json()
    
    // Extract query params
    const url = new URL(req.url)
    const configId = url.searchParams.get('configId')
    const callIdParam = url.searchParams.get('callId')

    // Extract data from SignalWire response
    const conversation = results.conversation || results.messages || []
    const summary = results.summary || results.ai_summary || null
    const callMetadata = results.call || {}
    const customParams = results.params || {}
    
    const callSid = callMetadata.sid || customParams.callmonitor_call_id || callIdParam
    const organizationId = customParams.callmonitor_org_id || null

    // eslint-disable-next-line no-console
    console.log('survey/ai-results: processing', {
      configId,
      callSid: callSid ? '[REDACTED]' : null,
      messageCount: conversation.length,
      hasSummary: !!summary
    })

    // Get voice_configs for email recipient
    let voiceConfig: any = null
    if (configId) {
      const { data: vcRows } = await supabaseAdmin
        .from('voice_configs')
        .select('id, organization_id, survey_webhook_email, survey_prompts')
        .eq('id', configId)
        .limit(1)
      
      voiceConfig = vcRows?.[0]
    }

    const finalOrgId = organizationId || voiceConfig?.organization_id || null

    // Find or create call record
    let callId: string | null = null
    if (callSid) {
      const { data: callRows } = await supabaseAdmin
        .from('calls')
        .select('id')
        .eq('call_sid', callSid)
        .limit(1)
      
      if (callRows && callRows.length > 0) {
        callId = callRows[0].id
        
        // Update call status to completed
        await supabaseAdmin
          .from('calls')
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString()
          })
          .eq('id', callId)
      }
    }

    // Extract survey responses from conversation
    const surveyResponses = extractSurveyResponses(conversation, voiceConfig?.survey_prompts || [])

    // Store results in ai_runs
    const aiRunId = uuidv4()
    await supabaseAdmin.from('ai_runs').insert({
      id: aiRunId,
      call_id: callId,
      system_id: null,
      model: 'signalwire-ai-survey',
      status: 'completed',
      started_at: callMetadata.start_time || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      output: {
        type: 'ai_survey',
        survey_responses: surveyResponses,
        conversation: conversation,
        summary: summary,
        call_metadata: {
          sid: callSid,
          from: callMetadata.from,
          to: callMetadata.to,
          duration: callMetadata.duration,
          start_time: callMetadata.start_time,
          end_time: callMetadata.end_time
        },
        organization_id: finalOrgId,
        config_id: configId,
        prompts_used: voiceConfig?.survey_prompts || []
      }
    })

    // eslint-disable-next-line no-console
    console.log('survey/ai-results: stored in ai_runs', { aiRunId, callId, responseCount: surveyResponses.length })

    // Send email if configured
    if (voiceConfig?.survey_webhook_email) {
      try {
        const emailResult = await sendSurveyResultsEmail(
          voiceConfig.survey_webhook_email,
          {
            callSid,
            from: callMetadata.from,
            to: callMetadata.to,
            duration: callMetadata.duration,
            prompts: voiceConfig.survey_prompts || [],
            responses: surveyResponses,
            summary,
            conversation
          }
        )
        
        // eslint-disable-next-line no-console
        console.log('survey/ai-results: email sent', { 
          to: voiceConfig.survey_webhook_email,
          success: emailResult.success
        })
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.error('survey/ai-results: email failed', { error: (emailErr as any)?.message })
      }
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        id: uuidv4(),
        organization_id: finalOrgId,
        user_id: null,
        system_id: null,
        resource_type: 'ai_runs',
        resource_id: aiRunId,
        action: 'create',
        before: null,
        after: { type: 'ai_survey', call_sid: callSid },
        created_at: new Date().toISOString()
      })
    } catch {
      // Best effort
    }

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('survey/ai-results processing error', { error: err?.message ?? String(err) })
  }
}

/**
 * Extract question-response pairs from AI conversation
 */
function extractSurveyResponses(
  conversation: Array<{ role: string; content: string }>,
  prompts: string[]
): Array<{ question: string; answer: string }> {
  const responses: Array<{ question: string; answer: string }> = []
  
  // Find assistant questions and user responses
  for (let i = 0; i < conversation.length - 1; i++) {
    const current = conversation[i]
    const next = conversation[i + 1]
    
    // If assistant asks something and user responds
    if (current.role === 'assistant' && next.role === 'user') {
      // Check if the assistant message contains a question
      if (current.content.includes('?')) {
        responses.push({
          question: current.content.trim(),
          answer: next.content.trim()
        })
      }
    }
  }
  
  // If no responses extracted, try matching with configured prompts
  if (responses.length === 0 && prompts.length > 0) {
    const userMessages = conversation.filter(m => m.role === 'user')
    prompts.forEach((prompt, i) => {
      if (userMessages[i]) {
        responses.push({
          question: prompt,
          answer: userMessages[i].content.trim()
        })
      }
    })
  }
  
  return responses
}

/**
 * Send survey results via email with formatted HTML
 */
async function sendSurveyResultsEmail(
  to: string,
  data: {
    callSid?: string
    from?: string
    to?: string
    duration?: number
    prompts: string[]
    responses: Array<{ question: string; answer: string }>
    summary?: string
    conversation: Array<{ role: string; content: string }>
  }
) {
  const callDate = new Date().toLocaleDateString()
  const callTime = new Date().toLocaleTimeString()
  const durationMinutes = data.duration ? Math.ceil(data.duration / 60) : 0

  // Build responses HTML
  const responsesHtml = data.responses.length > 0
    ? data.responses.map((r, i) => `
        <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Q${i + 1}: ${escapeHtml(r.question)}</p>
          <p style="margin: 0; color: #334155;">${escapeHtml(r.answer)}</p>
        </div>
      `).join('')
    : '<p style="color: #64748b;">No responses captured.</p>'

  // Build conversation HTML
  const conversationHtml = data.conversation.length > 0
    ? data.conversation.map(m => `
        <div style="margin-bottom: 8px; padding: 8px; background: ${m.role === 'user' ? '#dbeafe' : '#f1f5f9'}; border-radius: 6px;">
          <span style="font-weight: 600; color: ${m.role === 'user' ? '#1e40af' : '#475569'};">
            ${m.role === 'user' ? '👤 Caller' : '🤖 AI'}:
          </span>
          <span style="color: #334155;"> ${escapeHtml(m.content)}</span>
        </div>
      `).join('')
    : '<p style="color: #64748b;">No conversation recorded.</p>'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📞 Survey Results</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${callDate} at ${callTime}</p>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Call ID:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #334155;">${data.callSid?.substring(0, 12) || 'N/A'}...</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">From:</td>
            <td style="padding: 8px 0; color: #334155;">${data.from || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Duration:</td>
            <td style="padding: 8px 0; color: #334155;">${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}</td>
          </tr>
        </table>
      </div>
      
      ${data.summary ? `
        <div style="background: #fef3c7; padding: 16px; border: 1px solid #fcd34d; border-top: none;">
          <h3 style="margin: 0 0 8px 0; color: #92400e;">📝 Summary</h3>
          <p style="margin: 0; color: #78350f;">${escapeHtml(data.summary)}</p>
        </div>
      ` : ''}
      
      <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
        <h3 style="margin: 0 0 16px 0; color: #1e293b;">📋 Survey Responses</h3>
        ${responsesHtml}
      </div>
      
      <details style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <summary style="cursor: pointer; color: #64748b; font-weight: 600;">View Full Conversation</summary>
        <div style="margin-top: 16px;">
          ${conversationHtml}
        </div>
      </details>
      
      <p style="margin-top: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
        Sent by CallMonitor AI Survey Bot
      </p>
    </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `📞 Survey Results - ${callDate} ${callTime}`,
    html
  })
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * GET /api/survey/ai-results
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    ok: true, 
    route: '/api/survey/ai-results', 
    description: 'Webhook for SignalWire AI Survey results (post_prompt_url)'
  })
}
