export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const conferenceId = url.searchParams.get('conferenceId');
  const leg = url.searchParams.get('leg') || 'unknown';

  if (!conferenceId) {
    console.error('[webrtc-conference-swml] Missing conferenceId', null);
    return new Response(JSON.stringify({
      version: '1.0.0',
      sections: {
        main: [
          { answer: {} },
          {
            play: {
              url: 'say:Conference error. Goodbye.'
            }
          },
          { hangup: {} }
        ]
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log('[webrtc-conference-swml] Joining conference', { conferenceId, leg });

  // Smart conference termination:
  // - If PSTN leg exits → end conference (user hung up intentionally)
  // - If browser leg exits → keep conference open (might reconnect)
  // This prevents wasting money on abandoned conferences while allowing browser reconnects
  const endOnExit = leg === 'pstn';

  console.log('[webrtc-conference-swml] Conference settings', {
    conferenceId,
    leg,
    endConferenceOnExit: endOnExit
  });

  const swml = {
    version: '1.0.0',
    sections: {
      main: [
        { answer: {} },
        {
          conference: {
            name: conferenceId,
            beep: false,
            start_conference_on_enter: true,
            end_conference_on_exit: endOnExit,
            max_participants: 2,
            status_callback: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/signalwire?conferenceEvent=true&conferenceId=${conferenceId}`,
            status_callback_events: ['start', 'end', 'join', 'leave']
          }
        }
      ]
    }
  };

  return new Response(JSON.stringify(swml), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  // Handle POST requests the same way (SignalWire can use either)
  return onRequestGet({ request, env });
}