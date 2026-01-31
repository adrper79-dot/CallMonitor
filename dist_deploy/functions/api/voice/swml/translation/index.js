export async function onRequestPost({ request, env }) {
  // Feature flag
  if (!env.TRANSLATION_LIVE_ASSIST_PREVIEW || env.TRANSLATION_LIVE_ASSIST_PREVIEW !== 'true') {
    console.warn('SWML translation: Live translation preview is disabled');
    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'Live translation is not available for your plan.' } },
          { hangup: {} }
        ]
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const callId = url.searchParams.get('callId');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const orgId = url.searchParams.get('orgId');
    const conference = url.searchParams.get('conference');
    const leg = url.searchParams.get('leg'); // optional: '1', '2', 'agent', 'customer'

    // Required params validation
    if (!callId || !from || !to || !orgId) {
      console.warn('SWML translation endpoint missing required params', {
        callId, from, to, orgId, conference, leg
      });
      return new Response(JSON.stringify({
        version: '1.0.0',
        sections: {
          main: [
            { answer: {} },
            { say: { text: 'Invalid configuration. Ending call.' } },
            { hangup: {} }
          ]
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://voxsouth.online';
    const translationWebhook = `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=live_translate`;

    const isFirstLeg = !leg || leg === '1' || leg === 'agent' || leg === 'first';

    const sections = [
      { answer: {} },
      {
        record_call: {
          format: 'wav',
          stereo: true
        }
      }
    ];

    // Greeting (only first leg / agent side)
    if (isFirstLeg) {
      sections.push({
        say: {
          text: 'Connecting your call with real-time translation. Please hold.'
        }
      });
    }

    // Start live translation (correct structure)
    sections.push({
      live_translate: {
        action: 'start',
        webhook: translationWebhook,
        from_lang: from,
        to_lang: to,
        // from_voice: 'elevenlabs.rachel', // optional, recommended for quality
        // to_voice: 'elevenlabs.matthew',
        direction: ['local-caller', 'remote-caller'],
        live_events: true,
        ai_summary: true
      }
    });

    // Connect / join logic
    if (conference) {
      // Join existing conference (bridge mode)
      sections.push({
        conference: {
          name: decodeURIComponent(conference),
          beep: false,
          start_conference_on_enter: true,
          end_conference_on_exit: true,
          record: true,
          recording_status_callback: `${appUrl}/api/webhooks/signalwire?callId=${callId}&type=recording`
        }
      });
    } else {
      // No conference → direct outbound/AI/secret shopper call
      sections.push(
        { say: { text: 'Connected. This call is being monitored with translation.' } },
        { pause: { length: 5 } },
        { hangup: {} }
      );
    }

    const swml = {
      version: '1.0.0',
      sections: {
        main: sections
      }
    };

    console.log('SWML translation generated', {
      callId,
      languages: `${from} → ${to}`,
      conference: conference || 'none',
      leg,
      webhook: translationWebhook
    });

    return new Response(JSON.stringify(swml), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error generating translation SWML', {
      error: err.message,
      stack: err.stack
    });
    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          { say: { text: 'System error. Ending call.' } },
          { hangup: {} }
        ]
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}