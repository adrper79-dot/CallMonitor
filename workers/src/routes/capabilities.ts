/**
 * Capabilities Routes — Plan-based feature access checks
 *
 * Provides batch capability checking for frontend feature toggles.
 * The UI calls this on login to determine which features to show/hide.
 *
 * Endpoints:
 *   GET  /             - All capabilities for current org
 *   POST /check        - Check specific capabilities (batch)
 *   GET  /plan         - Current plan details + limits
 */

import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getAllCapabilities, checkCapabilities, getPlanDetails } from '../lib/capabilities'
import { analyticsRateLimit } from '../lib/rate-limit'

export const capabilitiesRoutes = new Hono<AppEnv>()

// GET / — All capabilities for the org (used on app init)
capabilitiesRoutes.get('/', analyticsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const capabilities = await getAllCapabilities(c.env, session.organization_id)

  return c.json({
    success: true,
    capabilities,
  })
})

// POST /check — Check specific capabilities (batch)
capabilitiesRoutes.post('/check', analyticsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json<{ capabilities?: string[] }>()
  const requested = body?.capabilities

  if (!Array.isArray(requested) || requested.length === 0) {
    return c.json({ error: 'capabilities array required' }, 400)
  }

  // Limit batch size to prevent abuse
  if (requested.length > 50) {
    return c.json({ error: 'Maximum 50 capabilities per request' }, 400)
  }

  const results = await checkCapabilities(c.env, session.organization_id, requested)

  return c.json({
    success: true,
    capabilities: results,
  })
})

// GET /plan — Current plan details + limits
capabilitiesRoutes.get('/plan', analyticsRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const details = await getPlanDetails(c.env, session.organization_id)

  return c.json({
    success: true,
    ...details,
  })
})
