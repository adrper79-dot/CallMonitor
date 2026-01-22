import { NextResponse, NextRequest } from 'next/server'
import supabaseAdmin from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        const callId        = searchParams.get('callId')
        const conferenceName = searchParams.get('conferenceName')
        const leg            = searchParams.get('leg') // 'first' or 'second'
        const toNumber       = searchParams.get('toNumber') // for first leg if needed

        if (!callId || !conferenceName || !leg) {
            return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
        }

        // Fetch call to get organization_id
        const { data: call } = await supabaseAdmin
            .from('calls')
            .select('organization_id')
            .eq('id', callId)
            .single()

        if (!call?.organization_id) {
            logger.warn('[SWML Bridge] Call not found or no org', { callId })
            // Proceed without translation
        }

        // Fetch translation config
        let translationEnabled = false
        let fromLang = 'en'
        let toLang   = 'es'

        if (call?.organization_id) {
            const { data: voiceConfig } = await supabaseAdmin
                .from('voice_configs')
                .select('live_translate, translate_from, translate_to')
                .eq('organization_id', call.organization_id)
                .single()

            translationEnabled = voiceConfig?.live_translate === true &&
                voiceConfig?.translate_from &&
                voiceConfig?.translate_to

            if (translationEnabled) {
                fromLang = voiceConfig.translate_from
                toLang   = voiceConfig.translate_to
            }
        }

        logger.info('[SWML Bridge] Generating SWML', {
            callId,
            conferenceName,
            leg,
            translationEnabled,
            languages: translationEnabled ? `${fromLang} → ${toLang}` : 'none'
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

        // Greeting (first leg only)
        if (leg === 'first') {
            sections.push({
                say: {
                    text: translationEnabled
                        ? "Connecting your call with real-time translation. Please wait."
                        : "Connecting your call. Please wait."
                }
            })
        } else if (leg === 'second') {
            // Customer leg: minimal greeting or hold
            sections.push({
                say: { text: "Connecting you now. Please wait." }
            })
        }

        // Add live translation if enabled
        if (translationEnabled) {
            sections.push({
                live_translate: {
                    action: {
                        start: {
                            webhook: webhookUrl,
                            from_lang: fromLang,
                            to_lang: toLang,
                            direction: ["local-caller", "remote-caller"],
                            live_events: true,
                            ai_summary: true
                        }
                    }
                }
            })
        }

        // Join the conference (both legs)
        sections.push({
            conference: {
                name: decodeURIComponent(conferenceName),
                beep: false,
                start_conference_on_enter: true,
                end_conference_on_exit: true
            }
        })

        const swml = {
            version: '1.0.0',
            sections: {
                main: sections
            }
        }

        return NextResponse.json(swml, {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        logger.error('[SWML Bridge] Error generating SWML', err)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
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
