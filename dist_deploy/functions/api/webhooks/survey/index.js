import { neon } from '@neondatabase/serverless'

export async function onRequestPost(context) {
  const { env, request } = context

  try {
    const sql = neon(env.NEON_CONNECTION_STRING)
    const url = new URL(request.url)
    const callIdParam = url.searchParams.get('callId')
    const questionIdx = parseInt(url.searchParams.get('q') || '1', 10)

    // Parse the request body (SignalWire webhook format)
    const payload = await request.json()
    const callSid = payload.CallSid || payload.call_sid
    const digits = payload.Digits || payload.digits || payload.DTMF || payload.dtmf

    if (!digits) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    let call = null

    // Find call by callId parameter or callSid
    if (callIdParam) {
      const result = await sql`SELECT id, organization_id FROM calls WHERE id = ${callIdParam} LIMIT 1`
      call = result[0]
    } else if (callSid) {
      const result = await sql`SELECT id, organization_id FROM calls WHERE call_sid = ${callSid} LIMIT 1`
      call = result[0]
    }

    if (!call) {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    // Get voice config for survey prompts
    const vcResult = await sql`
      SELECT survey_prompts, survey_question_types FROM voice_configs
      WHERE organization_id = ${call.organization_id} LIMIT 1
    `
    const voiceConfig = vcResult[0]

    // Simple digit mapping (1-5 scale)
    let responseValue = digits
    if (['1', '2', '3', '4', '5'].includes(digits)) {
      responseValue = `${digits}/5`
    }

    // Find existing survey run or create new one
    const runResult = await sql`
      SELECT id, output FROM ai_runs
      WHERE call_id = ${call.id} AND model = 'laml-dtmf-survey' LIMIT 1
    `

    const now = new Date().toISOString()
    const questionText = `Question ${questionIdx}` // Simplified

    if (runResult.length > 0) {
      // Update existing survey run
      const existingRun = runResult[0]
      const existingOutput = existingRun.output || { responses: [] }
      const responses = existingOutput.responses || []

      // Update or add response
      const existingIdx = responses.findIndex((r) => r.question_index === questionIdx)
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

      await sql`
        UPDATE ai_runs SET
          status = 'completed',
          completed_at = ${now},
          produced_by = 'model',
          is_authoritative = true,
          output = ${JSON.stringify({
            ...existingOutput,
            responses,
            total_questions: 1,
            questions_answered: responses.length
          })}
        WHERE id = ${existingRun.id}
      `
    } else {
      // Create new survey run
      const surveyRunId = crypto.randomUUID()

      await sql`
        INSERT INTO ai_runs (
          id, call_id, system_id, model, status, started_at, completed_at,
          produced_by, is_authoritative, output
        ) VALUES (
          ${surveyRunId}, ${call.id}, 'system-ai', 'laml-dtmf-survey', 'completed',
          ${now}, ${now}, 'model', true,
          ${JSON.stringify({
            type: 'dtmf_survey',
            responses: [{
              question_index: questionIdx,
              question: questionText,
              digit: digits,
              value: responseValue,
              timestamp: now
            }],
            total_questions: 1,
            questions_answered: 1
          })}
        )
      `
    }

    // Return TwiML response
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })

  } catch (error) {
    console.error('Survey webhook error:', error)
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'application/xml' }
    })
  }
}