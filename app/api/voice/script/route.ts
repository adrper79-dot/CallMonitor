import { NextResponse } from 'next/server'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { swmlResponse } from '@/lib/api/utils'
import { ApiErrors } from '@/lib/errors/apiHandler'

// Force dynamic rendering - uses request.url
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * Dynamic SWML Script Endpoint
 *
 * Returns dynamic SWML JSON for a specific call based on callSid.
 * This endpoint is referenced by the SWML outbound handler as a fallback
 * for dynamic script generation.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const callSid = searchParams.get('callSid')

    if (!callSid) {
      return ApiErrors.badRequest('callSid query parameter required')
    }

    // Find call by call_sid to get organization_id
    const { rows: callRows } = await query(
      `SELECT organization_id, to_number FROM calls WHERE call_sid = $1 LIMIT 1`,
      [callSid]
    )

    if (!callRows || callRows.length === 0) {
      // Call not found - return empty response
      return new NextResponse('', { status: 404 })
    }

    const { organization_id: organizationId, to_number: toNumber } = callRows[0]

    // Get voice_configs for this organization
    const { rows: vcRows } = await query(
      `SELECT record, transcribe, live_translate, translate_from, translate_to, survey, synthetic_caller, shopper_script 
         FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
      [organizationId]
    )

    const voiceConfig = vcRows?.[0] || null

    // Generate SWML JSON based on voice_configs
    const sections: any[] = []

    // Answer the call
    sections.push({ answer: {} })

    // Secret Shopper script
    if (voiceConfig?.synthetic_caller) {
      const script = voiceConfig.shopper_script ||
        'Hello, I\'m calling to inquire about your services. Do you have any availability this week?'

      const scriptLines = (script || '').split(/\n|\|/).filter((line: string) => line.trim())

      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i].trim()
        if (line) {
          sections.push({
            say: {
              text: line,
              voice: 'alice'
            }
          })
          if (i < scriptLines.length - 1) {
            sections.push({ pause: { length: 2 } })
          }
        }
      }
    }

    // Survey prompts
    if (voiceConfig?.survey) {
      sections.push({
        say: {
          text: 'Thank you for your time. Before we end, I have a quick survey.',
          voice: 'alice'
        }
      })
      sections.push({ pause: { length: 1 } })
      sections.push({
        say: {
          text: 'On a scale of 1 to 5, how satisfied were you with this call?'
        }
      })
      sections.push({
        gather: {
          num_digits: 1,
          action: '/api/webhooks/survey',
          method: 'POST',
          timeout: 10
        }
      })
    }

    // Main call flow - Dial to destination
    if (toNumber) {
      const recordingEnabled = voiceConfig?.record === true
      const recordingStatusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire`

      if (recordingEnabled) {
        sections.push({
          dial: {
            record: 'record-from-answer',
            recording_status_callback: recordingStatusCallback,
            recording_status_callback_event: 'completed',
            number: toNumber
          }
        })
      } else {
        sections.push({
          dial: {
            number: toNumber
          }
        })
      }
    } else {
      // Fallback: conference bridge
      const confName = callSid || `conf-${Date.now()}`
      sections.push({
        conference: {
          name: confName
        }
      })
    }

    // Closing message for secret shopper
    if (voiceConfig?.synthetic_caller) {
      sections.push({
        say: {
          text: 'Thank you for your time. Goodbye.',
          voice: 'alice'
        }
      })
    }

    const swml = {
      version: '1.0.0',
      sections: {
        main: sections
      }
    }

    return swmlResponse(swml)

  } catch (err: any) {
    logger.error('voice/script endpoint error', err)
    return swmlResponse({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'System error. Please try again.' } },
          { hangup: {} }
        ]
      }
    })
  }
}
