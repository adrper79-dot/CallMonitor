/**
 * Trial Expiry Automation
 *
 * Sends time-sensitive emails (T-7, T-3, T-0) to organization admins whose
 * trials are approaching or have reached expiry. Marks expired trials in the DB.
 *
 * Schedule: Daily midnight cron (`0 0 * * *`) via scheduled.ts
 *
 * Thresholds:
 *   T-7  → 7 days remaining — "Your trial ends in 7 days"
 *   T-3  → 3 days remaining — "Your trial ends in 3 days — upgrade to keep access"
 *   T-0  → Trial has just expired (plan_ends_at between yesterday and now)
 *             → Sets plan_status = 'canceled' if still 'trialing'
 *
 * Idempotency: Uses KV key `trial_expiry_notified:<orgId>:<tier>` with a 25-hour TTL
 *              to prevent double-sends if the cron re-fires within the same day.
 *
 * @module workers/src/lib/trial-expiry
 */

import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'
import { sendEmail, getEmailDefaults } from './email'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrialOrg {
  org_id: string
  org_name: string
  admin_email: string
  admin_name: string
  plan_ends_at: Date
  days_remaining: number
}

export interface TrialExpiryResult {
  processed: number
  errors: number
  notified_t7: number
  notified_t3: number
  expired: number
  [key: string]: unknown
}

// ─── Main Entry ──────────────────────────────────────────────────────────────

export async function processTrialExpiry(env: Env): Promise<TrialExpiryResult> {
  const db = getDb(env)
  const result: TrialExpiryResult = {
    processed: 0,
    errors: 0,
    notified_t7: 0,
    notified_t3: 0,
    expired: 0,
  }

  try {
    // ── Fetch all trialing orgs with an end date in the next 7 days ──────────
    // We join to users to grab the first owner/admin email for the org.
    const { rows: trialOrgs } = await db.query(`
      SELECT
        o.id                                     AS org_id,
        o.name                                   AS org_name,
        u.email                                  AS admin_email,
        COALESCE(u.name, u.email)                AS admin_name,
        o.plan_ends_at,
        FLOOR(EXTRACT(EPOCH FROM (o.plan_ends_at - NOW())) / 86400)::int
                                                 AS days_remaining
      FROM organizations o
      JOIN users u ON u.organization_id = o.id
                  AND u.role IN ('owner', 'admin')
      WHERE o.plan_status       = 'trialing'
        AND o.plan_ends_at      IS NOT NULL
        AND o.plan_ends_at      >= NOW() - INTERVAL '1 day'
        AND o.plan_ends_at      <= NOW() + INTERVAL '7 days'
      ORDER BY o.plan_ends_at ASC
    `)

    for (const org of trialOrgs) {
      result.processed++
      try {
        await handleTrialOrg(env, db, org, result)
      } catch (err) {
        result.errors++
        logger.error('trial-expiry: error processing org', {
          orgId: org.org_id,
          error: (err as Error)?.message,
        })
      }
    }

    // ── Hard-expire any trialing orgs whose end date passed > 1 day ago ─────
    const { rowCount: expired } = await db.query(`
      UPDATE organizations
         SET plan_status = 'canceled',
             updated_at  = NOW()
       WHERE plan_status  = 'trialing'
         AND plan_ends_at < NOW() - INTERVAL '1 day'
    `)
    result.expired += expired ?? 0

    if ((expired ?? 0) > 0) {
      logger.info('trial-expiry: hard-expired stale trials', { count: expired })
    }
  } finally {
    await db.end()
  }

  logger.info('trial-expiry: run complete', result)
  return result
}

// ─── Per-Org Logic ───────────────────────────────────────────────────────────

async function handleTrialOrg(
  env: Env,
  db: ReturnType<typeof getDb>,
  org: TrialOrg,
  result: TrialExpiryResult
): Promise<void> {
  const { org_id, org_name, admin_email, admin_name, days_remaining } = org

  if (days_remaining <= 0) {
    // T-0: Trial expired today — mark and optionally notify separately
    await expireTrialNow(db, org_id, org_name)
    result.expired++
    return
  }

  // Determine which notification tier applies (T-7 takes priority over T-3 on same day)
  const tier: 'T-7' | 'T-3' | null =
    days_remaining <= 7 && days_remaining > 3
      ? 'T-7'
      : days_remaining <= 3
        ? 'T-3'
        : null

  if (!tier) return

  // Idempotency: skip if we already notified this org at this tier today
  const kvKey = `trial_expiry_notified:${org_id}:${tier}`
  const alreadySent = await env.KV.get(kvKey)
  if (alreadySent) {
    logger.info('trial-expiry: skipping duplicate notification', { orgId: org_id, tier })
    return
  }

  if (!env.RESEND_API_KEY) {
    logger.warn('trial-expiry: RESEND_API_KEY not configured — skipping email', { orgId: org_id })
    return
  }

  const emailDefaults = getEmailDefaults({ RESEND_FROM: env.RESEND_FROM })
  const subject =
    tier === 'T-7'
      ? `Your Word Is Bond trial ends in ${days_remaining} days`
      : `Action required: Your trial ends in ${days_remaining} day${days_remaining === 1 ? '' : 's'}`

  await sendEmail(env.RESEND_API_KEY, {
    from: emailDefaults.from,
    to: admin_email,
    subject,
    html: buildTrialEmailHtml({ orgName: org_name, adminName: admin_name, daysRemaining: days_remaining, tier }),
  })

  // Record notification in KV (TTL: 25 hours prevents same-day double-send)
  await env.KV.put(kvKey, new Date().toISOString(), { expirationTtl: 90000 })

  if (tier === 'T-7') result.notified_t7++
  else result.notified_t3++

  logger.info('trial-expiry: notification sent', { orgId: org_id, tier, adminEmail: admin_email, daysRemaining: days_remaining })
}

async function expireTrialNow(
  db: ReturnType<typeof getDb>,
  orgId: string,
  orgName: string
): Promise<void> {
  await db.query(
    `UPDATE organizations
        SET plan_status = 'canceled',
            updated_at  = NOW()
      WHERE id          = $1
        AND plan_status = 'trialing'`,
    [orgId]
  )
  logger.info('trial-expiry: trial expired today, status → canceled', { orgId, orgName })
}

// ─── Email Template ──────────────────────────────────────────────────────────

interface TrialEmailParams {
  orgName: string
  adminName: string
  daysRemaining: number
  tier: 'T-7' | 'T-3'
}

function buildTrialEmailHtml({ orgName, adminName, daysRemaining, tier }: TrialEmailParams): string {
  const urgency = tier === 'T-3' ? 'Your access will be restricted when your trial ends.' : ''
  const ctaUrl = 'https://wordis-bond.com/pricing'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:32px 0">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:32px">
    <tr><td>
      <h2 style="color:#111827;margin:0 0 8px">Hi ${adminName},</h2>
      <p style="color:#374151;margin:0 0 16px">
        Your <strong>Word Is Bond</strong> trial for <strong>${orgName}</strong> ends in
        <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong>.
      </p>
      ${urgency ? `<p style="color:#b91c1c;margin:0 0 16px">${urgency}</p>` : ''}
      <p style="color:#374151;margin:0 0 24px">
        Upgrade now to keep your call center AI tools, transcriptions, and compliance features running
        without interruption.
      </p>
      <a href="${ctaUrl}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
        View Plans &amp; Upgrade
      </a>
      <p style="color:#6b7280;font-size:12px;margin:24px 0 0">
        Questions? Reply to this email or reach us at
        <a href="mailto:support@wordis-bond.com" style="color:#2563eb">support@wordis-bond.com</a>.
      </p>
    </td></tr>
  </table>
  </td></tr></table>
</body>
</html>`
}
