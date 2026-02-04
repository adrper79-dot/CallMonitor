/**
 * Call Capabilities Routes - Voice system capabilities
 */

import { Hono } from 'hono'
import type { Env } from '../index'
import { requireAuth } from '../lib/auth'

export const callCapabilitiesRoutes = new Hono<{ Bindings: Env }>()

// Get call capabilities
callCapabilitiesRoutes.get('/', async (c) => {
  try {
    const session = await requireAuth(c)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Return system capabilities
    return c.json({
      success: true,
      capabilities: {
        outbound: {
          enabled: true,
          supportedFormats: ['e164', 'national', 'international'],
          maxDuration: 3600, // 1 hour
          recordingEnabled: true
        },
        inbound: {
          enabled: true,
          voicemailEnabled: true,
          transcriptionEnabled: true
        },
        webrtc: {
          enabled: true,
          browserSupport: ['chrome', 'firefox', 'safari', 'edge'],
          features: ['audio', 'video', 'screen-share']
        },
        integrations: {
          telnyx: true,
          twilio: false,
          assemblyai: true,
          elevenlabs: true
        }
      }
    })
  } catch (err: any) {
    console.error('GET /api/call-capabilities error:', err)
    return c.json({ error: 'Failed to get call capabilities' }, 500)
  }
})