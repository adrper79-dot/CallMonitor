
import { NextResponse, NextRequest } from 'next/server'
import { query } from '@/lib/pgClient'
import { logger } from '@/lib/logger'
import { swmlJsonResponse } from '@/lib/api/utils'
import { isLiveTranslationPreviewEnabled } from '@/lib/env-validation'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET(request: NextRequest) {
    // Feature flag check for live translation preview
    if (!isLiveTranslationPreviewEnabled()) {
        logger.warn('[SWML Bridge] Live translation preview disabled')
        return swmlJsonResponse({
            version: '1.0.0',
            sections: {
                main: [
                    { answer: {} },
                    { say: { text: 'Live translation is not available for your plan.' } },
                    { hangup: {} }
                ]
            }
        })
    }

    try {
        const { searchParams } = new URL(request.url)
        const callId = searchParams.get('callId')
        const conferenceName = searchParams.get('conferenceName')
        let leg = searchParams.get('leg') // '1', '2', 'agent', 'customer', etc.

        if (!callId || !conferenceName || !leg) {
            return swmlJsonResponse({
                version: '1.0.0',
                sections: {
                    main: [
                        { answer: {} },
                        { say: { text: 'Invalid call parameters. Hanging up.' } },
                        { hangup: {} }
                    ]
                }
            })
        }

        // Normalize leg for readability
        const isAgentLeg = leg === '1' || leg === 'agent' || leg === 'first'

        // Fetch call → org
        let call: any = null
        try {
            const { rows } = await query(
                `SELECT organization_id FROM calls WHERE id = $1 LIMIT 1`,
                [callId]
            )
            call = rows[0]
        } catch (callErr: any) {
            logger.warn('[SWML Bridge] Call not found or no org', { callId, error: callErr?.message })
        }

        if (!call?.organization_id) {
            // Proceed without translation
        }

        // Fetch voice config for translation
        let translationEnabled = false
        let fromLang = 'en-US'
        let toLang = 'es'

        if (call?.organization_id) {
            const { rows: voiceConfigRows } = await query(
                `SELECT live_translate, translate_from, translate_to FROM voice_configs WHERE organization_id = $1 LIMIT 1`,
                [call.organization_id]
            )
            const voiceConfig = voiceConfigRows?.[0]

            translationEnabled = !!voiceConfig?.live_translate &&
                !!voiceConfig?.translate_from &&
                !!voiceConfig?.translate_to

            if (translationEnabled && voiceConfig) {
                fromLang = voiceConfig.translate_from
                toLang = voiceConfig.translate_to
            }
        }

        logger.info('[SWML Bridge] Generating SWML', {
            callId,
            conferenceName,
            leg,
            isAgentLeg,
            translationEnabled,
            languages: translationEnabled ? `${fromLang} → ${toLang}` : 'none'
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
        const webhookUrl = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`

        // Build main sections
        const sections: any[] = [
            { answer: {} },
            {
                record_call: {
                    format: 'wav',
                    stereo: true
                }
            }
        ]

        // Greeting
        if (isAgentLeg) {
            sections.push({
                say: {
                    text: translationEnabled
                        ? "Connecting your call with real-time translation. Please wait."
                        : "Connecting your call. Please wait."
                }
            })
        } else {
            sections.push({
                say: { text: "Connecting you now. Please wait." }
            })
        }

        // === LIVE TRANSLATION (top-level method) ===
        if (translationEnabled) {
            sections.push({
                live_translate: {
                    action: "start",
                    webhook: webhookUrl,
                    from_lang: fromLang,
                    to_lang: toLang,
                    // Optional: customize voices (ElevenLabs, etc.)
                    // from_voice: "elevenlabs.rachel",
                    // to_voice: "elevenlabs.matthew",
                    direction: ["local-caller", "remote-caller"], // translate both directions
                    live_events: true,
                    ai_summary: true
                }
            })
        }

        // Hold music for agent leg
        if (isAgentLeg) {
            sections.push({
                play: {
                    url: 'https://cdn.signalwire.com/default-music/waiting.wav'
                }
            })
        }

        // Join conference
        sections.push({
            conference: {
                name: decodeURIComponent(conferenceName),
                beep: false,
                start_conference_on_enter: true,
                end_conference_on_exit: true,
                record: true,
                recording_status_callback: webhookUrl
            }
        })

        const swml = {
            version: '1.0.0',
            sections: {
                main: sections
            }
        }

        return swmlJsonResponse(swml)

    } catch (err: any) {
        logger.error('[SWML Bridge] Error generating SWML', err)
        return swmlJsonResponse({
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
