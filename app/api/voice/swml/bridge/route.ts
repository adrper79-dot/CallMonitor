import { NextResponse, NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)

    const callId        = searchParams.get('callId')
    const conferenceName = searchParams.get('conferenceName')
    const leg            = searchParams.get('leg') // 'first' or 'second'
    const toNumber       = searchParams.get('toNumber') // only needed for first leg

    if (!callId || !conferenceName || !leg) {
        return NextResponse.json({ error: 'Missing required params' }, { status: 400 })
    }

    const translationEnabled = searchParams.get('translationEnabled') === 'true'
    const fromLang = searchParams.get('fromLang') || 'en'
    const toLang   = searchParams.get('toLang')   || 'es'

    // Base SWML structure
    const swml = {
        version: "1.0.0",
        sections: {
            main: [
                { answer: {} },
                {
                    say: {
                        text: translationEnabled
                            ? "Connecting your call with real-time translation. Please wait."
                            : "Connecting your call. Please wait."
                    }
                },
                { record_call: { format: "wav", stereo: true } },
            ]
        }
    }

    // Add translation if enabled (SWML supports this natively)
    if (translationEnabled) {
        swml.sections.main.push({
            live_translate: {
                action: {
                    start: {
                        webhook: `https://${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/live-translate?callId=${callId}`,
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

    // Leg-specific logic
    if (leg === 'first') {
        // Agent leg: connect to customer
        if (!toNumber) {
            return NextResponse.json({ error: 'toNumber required for first leg' }, { status: 400 })
        }
        swml.sections.main.push({
            connect: {
                from: process.env.SIGNALWIRE_NUMBER || '+15550100666',
                to: decodeURIComponent(toNumber)
            }
        })
    } else if (leg === 'second') {
        // Customer leg: just answer and join conference (if using conference model)
        swml.sections.main.push({
            say: { text: "Connecting you now." }
        })
        // If using conference instead of connect, add:
        // { conference: { name: decodeURIComponent(conferenceName), ... } }
    }

    return NextResponse.json(swml, {
        headers: { 'Content-Type': 'application/json' }
    })
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
