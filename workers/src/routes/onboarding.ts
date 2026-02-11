import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { validateBody } from '../lib/validate'
import { z } from 'zod'
import { onboardingRateLimit } from '../lib/rate-limit'

export const onboardingRoutes = new Hono<AppEnv>()

const OnboardingSetupSchema = z.object({
  plan: z.string().optional().default('trial'),
})

// Initialize onboarding (Step 1 -> 2)
onboardingRoutes.post('/setup', onboardingRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, OnboardingSetupSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env)
  try {
    // 1. Create Stripe Customer if missing
    let stripeCustomerId = ''
    const orgResult = await db.query(
      'SELECT stripe_customer_id, name FROM organizations WHERE id = $1',
      [session.organization_id]
    )
    const org = orgResult.rows[0]

    if (org?.stripe_customer_id) {
      stripeCustomerId = org.stripe_customer_id
    } else {
      // Create via Stripe API
      const stripeRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: session.email,
          name: org?.name || session.name,
          metadata: { organization_id: session.organization_id } as any,
        }),
      })

      if (stripeRes.ok) {
        const customer = (await stripeRes.json()) as any
        stripeCustomerId = customer.id
        await db.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2', [
          stripeCustomerId,
          session.organization_id,
        ])
      }
    }

    // 2. Provision Virtual Number (Telnyx Trial Number)
    // In trial mode, we just pick the first available US number
    const telnyxSearchRes = await fetch(
      'https://api.telnyx.com/v2/available_phone_numbers?filter[country_code]=US&filter[limit]=1',
      {
        headers: { Authorization: `Bearer ${c.env.TELNYX_API_KEY}` },
      }
    )

    let provisionedNumber = ''
    if (telnyxSearchRes.ok) {
      const searchData = (await telnyxSearchRes.json()) as any
      const phoneNumber = searchData.data?.[0]?.phone_number

      if (phoneNumber) {
        const orderRes = await fetch('https://api.telnyx.com/v2/number_orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_numbers: [{ phone_number: phoneNumber }],
          }),
        })

        if (orderRes.ok) {
          provisionedNumber = phoneNumber
          await db.query(
            "UPDATE organizations SET provisioned_number = $1, trial_ends_at = NOW() + INTERVAL '14 days', onboarding_step = 2 WHERE id = $2",
            [provisionedNumber, session.organization_id]
          )
        }
      }
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.ORGANIZATION_UPDATED,
      resourceType: 'organization',
      resourceId: session.organization_id,
      newValue: { provisionedNumber, trial: true },
    })

    return c.json({
      success: true,
      provisionedNumber,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (err: any) {
    logger.error('Onboarding setup error', { error: err?.message })
    return c.json({ error: 'Failed to initialize onboarding' }, 500)
  } finally {
    await db.end()
  }
})

// Update progress
const OnboardingProgressSchema = z.object({
  step: z.number().int().min(1).max(10),
})

onboardingRoutes.post('/progress', onboardingRateLimit, async (c) => {
  const session = await requireAuth(c)
  if (!session) return c.json({ error: 'Unauthorized' }, 401)

  const parsed = await validateBody(c, OnboardingProgressSchema)
  if (!parsed.success) return parsed.response

  const { step } = parsed.data
  const db = getDb(c.env)
  try {
    await db.query('UPDATE organizations SET onboarding_step = $1 WHERE id = $2', [
      step,
      session.organization_id,
    ])

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.ONBOARDING_COMPLETED,
      resourceType: 'organization',
      resourceId: session.organization_id,
      newValue: { step },
    })

    return c.json({ success: true })
  } finally {
    await db.end()
  }
})
