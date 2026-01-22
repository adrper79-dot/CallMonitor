import { NextRequest, NextResponse } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/voice/swml/bridge
 * Returns SWML for conference bridge with optional live translation
 * 
 * Query params:
 * - callId: Call ID for tracking
 * - conferenceName: Conference room name
 * - leg: 'first' or 'second' (determines if greeting is played)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const callId = searchParams.get('callId')
        const conferenceName = searchParams.get('conferenceName')
        const leg = searchParams.get('leg') || 'first'

        if (!callId || !conferenceName) {
            return NextResponse.json(
                { error: 'Missing callId or conferenceName' },
                { status: 400 }
            )
        }

        // Get call record to find organization
        const { data: call } = await supabaseAdmin
            .from('calls')
            .select('organization_id')
            .eq('id', callId)
            .single()

        if (!call) {
            logger.warn('[SWML Bridge] Call not found', { callId })
            // Return basic SWML without translation
            return NextResponse.json({
                version: '1.0.0',
                sections: {
                    main: [
                        { answer: {} },
                        {
                            connect: {
                                to: `conference:${conferenceName}`,
                                beep: false,
                                startConferenceOnEnter: true,
                                endConferenceOnExit: true
                            }
                        }
                    ]
                }
            })
        }

        // Check if translation is enabled
        const { data: voiceConfig } = await supabaseAdmin
            .from('voice_configs')
            .select('live_translate, translate_from, translate_to')
            .eq('organization_id', call.organization_id)
            .single()

        const translationEnabled = voiceConfig?.live_translate === true &&
            voiceConfig?.translate_from &&
            voiceConfig?.translate_to

        logger.info('[SWML Bridge] Generating SWML', {
            callId,
            conferenceName,
            leg,
            translationEnabled,
            languages: translationEnabled ? `${voiceConfig.translate_from} → ${voiceConfig.translate_to}` : 'none'
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online'
        const webhookUrl = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`

        // Build SWML sections
        const sections: any[] = [
            { answer: {} },
            {
                record_call: {
                    format: 'wav',
                    stereo: true
                }
            }
        ]

        // Add greeting for first leg only
        if (leg === 'first') {
            sections.push({
                play: {
                    url: translationEnabled
                        ? 'say:Connecting your call with real-time translation.'
                        : 'say:Connecting your call. Please wait.'
                }
            })
        }

        // Add live translation if enabled
        if (translationEnabled) {
            sections.push({
                live_translate: {
                    action: {
                        start: {
                            webhook: webhookUrl,
                            from_lang: voiceConfig.translate_from,
                            to_lang: voiceConfig.translate_to,
                            direction: ['local-caller', 'remote-caller'],
                            live_events: true,
                            ai_summary: true
                        }
                    }
                }
            })
        }

        // Connect to conference
        sections.push({
            connect: {
                to: `conference:${conferenceName}`,
                beep: false,
                startConferenceOnEnter: true,
                endConferenceOnExit: true
            }
        })

        const swml = {
            version: '1.0.0',
            sections: {
                main: sections
            }
        }

        return NextResponse.json(swml, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

    } catch (err: any) {
        logger.error('[SWML Bridge] Error generating SWML', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
