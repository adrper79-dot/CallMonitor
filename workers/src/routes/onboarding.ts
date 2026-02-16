import { Hono } from 'hono'
import type { AppEnv } from '../index'
import { requireAuth, requireRole } from '../lib/auth'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { writeAuditLog, AuditAction } from '../lib/audit'
import { validateBody } from '../lib/validate'
import { z } from 'zod'
import { onboardingRateLimit } from '../lib/rate-limit'
import { provisionOrgPhoneNumbers } from '../lib/phone-provisioning'

export const onboardingRoutes = new Hono<AppEnv>()

// Save compliance settings during onboarding
const OnboardingComplianceSchema = z.object({
  timezone: z.string().optional().default('America/New_York'),
  calling_hours_start: z.string().optional().default('08:00'),
  calling_hours_end: z.string().optional().default('21:00'),
  dnc_enabled: z.boolean().optional().default(true),
  disclosure_enabled: z.boolean().optional().default(true),
})

onboardingRoutes.post('/compliance', onboardingRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const parsed = await validateBody(c, OnboardingComplianceSchema)
  if (!parsed.success) return parsed.response

  const { timezone, calling_hours_start, calling_hours_end } = parsed.data
  const db = getDb(c.env, session.organization_id)
  try {
    await db.query(
      `UPDATE organizations
       SET timezone = $1,
           calling_hours_start = $2,
           calling_hours_end = $3,
           onboarding_step = GREATEST(COALESCE(onboarding_step, 0), 3)
       WHERE id = $4`,
      [timezone, calling_hours_start, calling_hours_end, session.organization_id]
    )

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.ORGANIZATION_UPDATED,
      resourceType: 'organization',
      resourceId: session.organization_id,
      oldValue: null,
      newValue: parsed.data,
    }).catch(() => {})

    return c.json({ success: true })
  } catch (err: any) {
    logger.error('Onboarding compliance save error', { error: err?.message })
    return c.json({ error: 'Failed to save compliance settings' }, 500)
  } finally {
    await db.end()
  }
})

const OnboardingSetupSchema = z.object({
  plan: z.string().optional().default('trial'),
})

// Initialize onboarding (Step 1 -> 2)
onboardingRoutes.post('/setup', onboardingRateLimit, async (c) => {
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const parsed = await validateBody(c, OnboardingSetupSchema)
  if (!parsed.success) return parsed.response

  const db = getDb(c.env, session.organization_id)
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

    // 2. Provision 5 Phone Numbers via Telnyx (outbound pool + CNAM masking)
    const orgName = org?.name || session.name || 'WORD IS BOND'
    const provisionResult = await provisionOrgPhoneNumbers(c.env, db, session.organization_id, orgName)

    const provisionedNumber = provisionResult.numbers[0] || ''
    const provisionedNumbers = provisionResult.numbers

    if (provisionResult.success && provisionedNumber) {
      await db.query(
        "UPDATE organizations SET provisioned_number = $1, trial_ends_at = NOW() + INTERVAL '14 days', onboarding_step = 2 WHERE id = $2",
        [provisionedNumber, session.organization_id]
      )
    }

    if (provisionResult.errors.length > 0) {
      logger.warn('Phone provisioning had non-fatal errors', {
        organizationId: session.organization_id,
        errors: provisionResult.errors,
      })
    }

    writeAuditLog(db, {
      userId: session.user_id,
      organizationId: session.organization_id,
      action: AuditAction.ORGANIZATION_UPDATED,
      resourceType: 'organization',
      resourceId: session.organization_id,
      newValue: {
        provisionedNumbers,
        provisionedNumber,
        cnamListingId: provisionResult.cnamListingId,
        trial: true,
      },
    })

    return c.json({
      success: true,
      provisionedNumber,
      provisionedNumbers,
      cnamListingId: provisionResult.cnamListingId,
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
  const session = await requireRole(c, 'agent')
  if (!session) return c.json({ error: 'Unauthorized or insufficient role' }, 403)

  const parsed = await validateBody(c, OnboardingProgressSchema)
  if (!parsed.success) return parsed.response

  const { step } = parsed.data
  const db = getDb(c.env, session.organization_id)
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
