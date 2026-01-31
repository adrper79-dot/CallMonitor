import { neon } from '@neondatabase/serverless';

// Survey disclaimer for AI Role compliance
const SURVEY_DISCLAIMER = `This is an automated customer satisfaction survey. Your responses will be recorded for quality improvement purposes. This survey does not constitute any agreement or commitment. You may end the call at any time.`;

/**
 * Build the AI prompt for the survey bot
 */
function buildSurveyPrompt(prompts) {
  // Procedural disclaimer is prepended to all survey prompts
  const disclaimerInstruction = `IMPORTANT: You MUST begin by saying: "${SURVEY_DISCLAIMER}"

After the disclaimer, proceed with the survey questions.

`;

  if (prompts.length === 0) {
    return `${disclaimerInstruction}You are a friendly survey assistant. Ask the caller:
1. How was your overall experience today?
2. On a scale of 1-5, how likely are you to recommend us?
3. Is there anything we could improve?

Wait for each response before asking the next question.
After all questions, thank them and provide a brief summary of their feedback.
Keep responses natural and conversational.`;
  }

  const numberedPrompts = prompts.map((q, i) => `${i + 1}. ${q}`).join('\n');

  return `${disclaimerInstruction}You are a professional survey assistant conducting a customer feedback survey.

Ask these questions ONE AT A TIME, waiting for the caller's response before proceeding:

${numberedPrompts}

Guidelines:
- Be friendly and conversational
- Wait for each response before asking the next question
- If the caller seems confused, clarify the question
- After all questions, thank them and summarize their responses briefly
- Keep responses natural - don't sound robotic

Begin by greeting the caller and explaining you have ${prompts.length} quick question${prompts.length > 1 ? 's' : ''} for them.`;
}

/**
 * Map language/locale to SignalWire voice ID
 */
function getSignalWireVoice(voiceId) {
  const voiceMap = {
    'en': 'rime.spore',
    'en-US': 'rime.spore',
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
 * Build SWML JSON for AI Survey Bot
 */
function buildSurveySWML(config) {
  const {
    callId,
    organizationId,
    prompts,
    voice,
    postPromptWebhook,
    recordCall = true
  } = config;

  const mainSection = [];

  // Answer the inbound call
  mainSection.push({ answer: {} });

  // Add optional recording
  if (recordCall) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com';
    mainSection.push({
      record_call: {
        format: 'mp3',
        stereo: false,
        recording_status_callback: `${appUrl}/api/webhooks/signalwire`
      }
    });
  }

  // AI Survey Bot configuration
  mainSection.push({
    ai: {
      prompt: { text: buildSurveyPrompt(prompts) },
      voice: getSignalWireVoice(voice),
      model: 'gpt-4o-mini',
      temperature: 0.4, // Slightly higher for more natural conversation
      max_tokens: 200,
      post_prompt_url: postPromptWebhook,
      params: {
        save_conversation: true,
        callmonitor_call_id: callId,
        callmonitor_org_id: organizationId,
        callmonitor_type: 'ai_survey'
      }
    }
  });

  // Hangup after survey completes
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
function buildFallbackSWML(message) {
  const mainSection = [{ answer: {} }];

  if (message) {
    mainSection.push({ say: { text: message } });
  }

  mainSection.push({ hangup: {} });

  return {
    version: '1.0.0',
    sections: { main: mainSection }
  };
}

function resolveSurveyPrompts(voiceConfig) {
  const promptLocale = voiceConfig?.translate_to || 'en';
  const localized = voiceConfig?.survey_prompts_locales?.[promptLocale];
  if (Array.isArray(localized) && localized.length > 0) {
    return { prompts: localized, locale: promptLocale };
  }

  const defaultPrompts = Array.isArray(voiceConfig?.survey_prompts) ? voiceConfig.survey_prompts : [];
  return { prompts: defaultPrompts, locale: promptLocale };
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const payload = await request.json();

    const callSid = payload.CallSid || payload.call_sid;
    const from = payload.From || payload.from;
    const to = payload.To || payload.to;

    const configId = url.searchParams.get('configId');
    const orgId = url.searchParams.get('orgId');

    console.log('SWML survey: inbound call', {
      callSid: callSid ? '[REDACTED]' : null,
      configId, orgId
    });

    const sql = neon(env.NEON_CONNECTION_STRING);
    let voiceConfig = null;
    let organizationId = null;

    if (configId) {
      const rows = await sql`
        SELECT id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email
        FROM voice_configs WHERE id = ${configId} LIMIT 1
      `;
      voiceConfig = rows?.[0];
      organizationId = voiceConfig?.organization_id;
    } else if (orgId) {
      const rows = await sql`
        SELECT id, organization_id, survey, survey_prompts, survey_prompts_locales, translate_to, survey_voice, survey_webhook_email
        FROM voice_configs WHERE organization_id = ${orgId} LIMIT 1
      `;
      voiceConfig = rows?.[0];
      organizationId = orgId;
    }

    if (!voiceConfig || !voiceConfig.survey) {
      console.warn('SWML survey: not enabled or config not found', { configId, orgId });
      const fallbackSwml = buildFallbackSWML('Sorry, this survey is not currently available. Goodbye.');
      return new Response(JSON.stringify(fallbackSwml), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://app.callmonitor.com';
    const callId = callSid || `survey-${Date.now()}`;

    const { prompts: resolvedPrompts } = resolveSurveyPrompts(voiceConfig);
    const swml = buildSurveySWML({
      callId,
      organizationId: organizationId || 'unknown',
      prompts: resolvedPrompts,
      voice: voiceConfig.survey_voice,
      postPromptWebhook: `${appUrl}/api/survey/ai-results?configId=${voiceConfig.id}&callId=${callId}`,
      recordCall: true
    });

    console.log('SWML survey: generated SWML', {
      organizationId,
      configId: voiceConfig.id,
      promptCount: resolvedPrompts.length
    });

    if (callSid && organizationId) {
      try {
        const callUUID = crypto.randomUUID();
        await sql`
          INSERT INTO calls (id, organization_id, call_sid, status, started_at)
          VALUES (${callUUID}, ${organizationId}, ${callSid}, 'ringing', NOW())
        `;
      } catch (insertErr) {
        console.warn('SWML survey: could not create call record', { error: insertErr.message });
      }
    }

    return new Response(JSON.stringify(swml), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('SWML survey error', err);
    const fallbackSwml = buildFallbackSWML('We encountered an error. Please try again later. Goodbye.');
    return new Response(JSON.stringify(fallbackSwml), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    ok: true,
    route: '/api/voice/swml/survey',
    method: 'Use POST for SWML generation',
    description: 'SWML endpoint for AI Survey Bot',
    params: { configId: 'voice_configs.id', orgId: 'organization_id (fallback)' }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}