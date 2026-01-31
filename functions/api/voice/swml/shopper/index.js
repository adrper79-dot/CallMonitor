import { neon } from '@neondatabase/serverless';

// QA Evaluation disclosure for AI Role compliance
const QA_EVALUATION_DISCLOSURE = `This is an automated quality assurance evaluation call. This call is for internal evaluation purposes only and does not constitute any service agreement or commitment.`;

/**
 * Map language/locale to SignalWire voice ID
 */
function getSignalWireVoice(voiceId) {
  const voiceMap = {
    'en': 'rime.spore',
    'en-US': 'rime.spore',
    'en-female': 'rime.kira',
    'en-male': 'rime.spore',
    'es': 'rime.alberto',
    'es-US': 'rime.alberto',
    'fr': 'rime.viola',
    'de': 'rime.stella',
    'it': 'rime.paola',
    'pt': 'rime.luana',
    'ja': 'rime.akari',
    'zh': 'rime.ling',
    'ko': 'rime.yeonjun'
  };

  // If voiceId is already a rime voice or custom voice, use it directly
  if (voiceId?.startsWith('rime.') || voiceId?.includes('.')) {
    return voiceId;
  }

  return voiceMap[voiceId || 'en'] || 'rime.spore';
}

/**
 * Build the AI prompt for the secret shopper agent
 */
function buildShopperPrompt(script, persona, targetName) {
  const personaDescription = persona || 'a typical customer who is polite but has specific needs';
  const target = targetName || 'the representative';

  return `You are an AI conducting a quality assurance evaluation call. You are role-playing as ${personaDescription}.

YOUR SCRIPT AND OBJECTIVES:
${script}

IMPORTANT GUIDELINES:
1. Stay in character throughout the call - you ARE the customer
2. Follow the script naturally, adapting to responses while hitting key points
3. Don't reveal you're an AI or conducting an evaluation
4. React naturally to what ${target} says - if they answer a question, acknowledge it
5. If they deviate from expected service, note it mentally but stay polite
6. Ask clarifying questions if responses are unclear
7. Complete all script objectives before ending the call
8. Thank them politely at the end

CONVERSATION STYLE:
- Be conversational, not robotic
- Use natural pauses and filler words occasionally
- Show appropriate emotions (frustration if service is poor, satisfaction if good)
- Match the energy and pace of ${target}

After the call, your responses and the conversation will be analyzed for:
- Whether your script objectives were met
- The quality of service provided
- Response times and professionalism
- Sentiment and tone

Begin the call now. Follow your script and objectives.`;
}

/**
 * Build SWML JSON for Secret Shopper AI Agent
 */
function buildShopperSWML(config) {
  const {
    callId,
    organizationId,
    scriptId,
    script,
    persona,
    voice,
    expectedOutcomes,
    targetName,
    recordCall = true
  } = config;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com';
  const mainSection = [];

  // Answer the call (for inbound) or connect (outbound uses REST API)
  mainSection.push({ answer: {} });

  // Add recording
  if (recordCall) {
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: true, // Stereo for speaker separation
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    });
  }

  // AI Secret Shopper Agent configuration
  mainSection.push({
    ai: {
      prompt: { text: buildShopperPrompt(script, persona, targetName) },
      voice: getSignalWireVoice(voice),
      model: 'gpt-4o-mini',
      temperature: 0.6, // Higher for more natural role-playing
      max_tokens: 250, // Longer responses for natural conversation
      post_prompt_url: `${appUrl}/api/shopper/results?callId=${callId}&scriptId=${scriptId || ''}&orgId=${organizationId}`,
      params: {
        save_conversation: true,
        callmonitor_call_id: callId,
        callmonitor_org_id: organizationId,
        callmonitor_type: 'secret_shopper',
        callmonitor_script_id: scriptId,
        expected_outcomes: expectedOutcomes || []
      }
    }
  });

  // Hangup after evaluation completes
  mainSection.push({ hangup: {} });

  return {
    version: '1.0.0',
    sections: {
      main: mainSection
    }
  };
}

/**
 * Build a minimal fallback SWML for error cases
 */
function buildShopperFallbackSWML(message) {
  const mainSection = [{ answer: {} }];

  if (message) {
    mainSection.push({
      ai: {
        prompt: { text: `Say: "${message}" then hang up politely.` },
        voice: 'rime.spore',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 50
      }
    });
  }

  mainSection.push({ hangup: {} });

  return {
    version: '1.0.0',
    sections: { main: mainSection }
  };
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const payload = await request.json();

    const callSid = payload.CallSid || payload.call_sid;
    const from = payload.From || payload.from;
    const to = payload.To || payload.to;

    const scriptId = url.searchParams.get('scriptId');
    const orgId = url.searchParams.get('orgId');
    const callId = url.searchParams.get('callId') || callSid || `shopper-${Date.now()}`;

    console.log('SWML shopper: incoming call', {
      callSid: callSid ? '[REDACTED]' : null,
      scriptId, orgId, callId
    });

    if (!scriptId && !orgId) {
      console.warn('SWML shopper: missing scriptId or orgId');
      const fallbackSwml = buildShopperFallbackSWML('Sorry, this evaluation could not be configured. Goodbye.');
      return new Response(JSON.stringify(fallbackSwml), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = neon(env.NEON_CONNECTION_STRING);
    let script = null;
    let organizationId = orgId;

    if (scriptId) {
      const scriptRows = await sql`SELECT * FROM shopper_scripts WHERE id = ${scriptId} LIMIT 1`;
      script = scriptRows?.[0];
      if (script) {
        organizationId = script.organization_id;
      }
    }

    if (!script && organizationId) {
      const configRows = await sql`
        SELECT shopper_script, shopper_expected_outcomes FROM voice_configs
        WHERE organization_id = ${organizationId} AND shopper_script IS NOT NULL LIMIT 1
      `;

      if (configRows?.[0]?.shopper_script) {
        script = {
          script_content: configRows[0].shopper_script,
          expected_outcomes: configRows[0].shopper_expected_outcomes || [],
          persona: 'a typical customer',
          voice: 'en'
        };
      }
    }

    if (!script || !script.script_content) {
      console.warn('SWML shopper: no script found', { scriptId, orgId });
      const fallbackSwml = buildShopperFallbackSWML('Sorry, no evaluation script was found. Goodbye.');
      return new Response(JSON.stringify(fallbackSwml), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const swml = buildShopperSWML({
      callId,
      organizationId: organizationId || 'unknown',
      scriptId: scriptId || undefined,
      script: script.script_content,
      persona: script.persona,
      voice: script.voice,
      expectedOutcomes: script.expected_outcomes,
      targetName: script.target_name,
      recordCall: true
    });

    console.log('SWML shopper: generated SWML', {
      organizationId, scriptId, callId,
      hasScript: !!script.script_content,
      outcomeCount: script.expected_outcomes?.length || 0
    });

    if (callSid && organizationId) {
      try {
        // Generate a UUID for the call ID
        const callUUID = crypto.randomUUID();
        await sql`
          INSERT INTO calls (id, organization_id, call_sid, status, started_at)
          VALUES (${callUUID}, ${organizationId}, ${callSid}, 'ringing', NOW())
        `;
      } catch (insertErr) {
        console.warn('SWML shopper: could not create call record', { error: insertErr.message });
      }
    }

    return new Response(JSON.stringify(swml), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('SWML shopper error', err);
    const fallbackSwml = buildShopperFallbackSWML('We encountered an error. Please try again later. Goodbye.');
    return new Response(JSON.stringify(fallbackSwml), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    route: '/api/voice/swml/shopper',
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for Secret Shopper AI Agent evaluations',
    params: {
      scriptId: 'shopper_scripts.id - the evaluation script to use',
      orgId: 'organization_id (fallback if scriptId not provided)',
      callId: 'call ID for tracking (auto-generated if not provided)'
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}