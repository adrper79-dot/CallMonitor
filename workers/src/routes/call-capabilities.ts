/**
 * Call Capabilities Routes - Voice system capabilities
 *
 * Returns platform capabilities gated by the organization's subscription plan.
 * Plan data is read from the organizations table (System of Record).
 *
 * @see ARCH_DOCS/SYSTEM_OF_RECORD_COMPLIANCE.md
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'

export const callCapabilitiesRoutes = new Hono<AppEnv>()

/** Capability tiers keyed by plan slug */
const PLAN_CAPABILITIES: Record<string, any> = {
  free: {
    outbound: {
      enabled: true,
      supportedFormats: ['e164'],
      maxDuration: 600, // 10 min
      recordingEnabled: false,
    },
    inbound: { enabled: false, voicemailEnabled: false, transcriptionEnabled: false },
    webrtc: {
      enabled: true,
      browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
      features: ['audio'],
    },
    integrations: { telnyx: true, twilio: false, assemblyai: false, elevenlabs: false },
  },
  starter: {
    outbound: {
      enabled: true,
      supportedFormats: ['e164', 'national'],
      maxDuration: 1800, // 30 min
      recordingEnabled: true,
    },
    inbound: { enabled: true, voicemailEnabled: true, transcriptionEnabled: false },
    webrtc: {
      enabled: true,
      browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
      features: ['audio'],
    },
    integrations: { telnyx: true, twilio: false, assemblyai: true, elevenlabs: false },
  },
  pro: {
    outbound: {
      enabled: true,
      supportedFormats: ['e164', 'national', 'international'],
      maxDuration: 3600, // 1 hour
      recordingEnabled: true,
    },
    inbound: { enabled: true, voicemailEnabled: true, transcriptionEnabled: true },
    webrtc: {
      enabled: true,
      browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
      features: ['audio', 'video', 'screen-share'],
    },
    integrations: { telnyx: true, twilio: false, assemblyai: true, elevenlabs: true },
  },
  enterprise: {
    outbound: {
      enabled: true,
      supportedFormats: ['e164', 'national', 'international'],
      maxDuration: 7200, // 2 hours
      recordingEnabled: true,
    },
    inbound: { enabled: true, voicemailEnabled: true, transcriptionEnabled: true },
    webrtc: {
      enabled: true,
      browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
      features: ['audio', 'video', 'screen-share'],
    },
    integrations: { telnyx: true, twilio: true, assemblyai: true, elevenlabs: true },
  },
}

// GET / — capabilities for the caller's organization plan
callCapabilitiesRoutes.get('/', async (c) => {
  const session = await requireAuth(c)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const db = getDb(c.env, session.organization_id)
  try {

    let plan = 'free'

    if (session.organization_id) {
      const result = await db.query('SELECT plan FROM organizations WHERE id = $1', [
        session.organization_id,
      ])
      if (result.rows.length > 0 && result.rows[0].plan) {
        plan = result.rows[0].plan
      }
    }

    // Normalise plan slug to a known tier (fallback → free)
    const normalisedPlan = Object.keys(PLAN_CAPABILITIES).includes(plan) ? plan : 'free'

    return c.json({
      success: true,
      plan: normalisedPlan,
      capabilities: PLAN_CAPABILITIES[normalisedPlan],
    })
  } catch (err: any) {
    logger.error('GET /api/call-capabilities error', { error: err?.message })
    return c.json({ error: 'Failed to get call capabilities' }, 500)
  } finally {
    await db.end()
  }
})

