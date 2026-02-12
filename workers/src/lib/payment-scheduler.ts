/**
 * Scheduled Payment Processor
 *
 * Handles recurring/scheduled collection payments via Stripe.
 * Runs as a daily cron job to process payments due today.
 *
 * Flow:
 *   1. Query scheduled_payments WHERE scheduled_date <= TODAY AND status = 'pending'
 *   2. For each: create Stripe PaymentIntent → charge → record in collection_payments
 *   3. Update balance_due on collection_accounts
 *   4. On failure: increment attempt_count, schedule retry or escalate
 *
 * Also handles dunning escalation for failed subscription invoices.
 *
 * @see workers/src/scheduled.ts — wired into `0 6 * * *` cron (6am daily)
 */

import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'
import { writeAuditLog, AuditAction } from './audit'

/**
 * Process all scheduled payments due today (or overdue).
 * Called from scheduled.ts cron handler.
 */
export async function processScheduledPayments(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)
  let processedCount = 0
  let errorCount = 0

  try {
    // Find all pending payments due today or overdue
    const result = await db.query(`
      SELECT sp.id, sp.organization_id, sp.account_id, sp.amount, sp.currency,
             sp.method, sp.stripe_payment_method_id, sp.attempt_count, sp.max_attempts,
             ca.name AS account_name, ca.email AS account_email,
             o.stripe_customer_id
      FROM scheduled_payments sp
      JOIN collection_accounts ca ON ca.id = sp.account_id
      JOIN organizations o ON o.id = sp.organization_id
      WHERE sp.scheduled_date <= CURRENT_DATE
        AND sp.status = 'pending'
        AND sp.attempt_count < sp.max_attempts
      ORDER BY sp.scheduled_date ASC
      LIMIT 50
    `)

    for (const payment of result.rows) {
      try {
        // Mark as processing
        await db.query(
          `UPDATE scheduled_payments
           SET status = 'processing', last_attempt_at = NOW(), attempt_count = attempt_count + 1
           WHERE id = $1 AND organization_id = $2`,
          [payment.id, payment.organization_id]
        )

        if (payment.method === 'stripe' && payment.stripe_payment_method_id) {
          // Create Stripe PaymentIntent and confirm in one step
          const amountCents = Math.round(payment.amount * 100)

          const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              amount: amountCents.toString(),
              currency: payment.currency || 'usd',
              customer: payment.stripe_customer_id || '',
              payment_method: payment.stripe_payment_method_id,
              confirm: 'true',
              off_session: 'true',
              'metadata[organization_id]': payment.organization_id,
              'metadata[account_id]': payment.account_id,
              'metadata[scheduled_payment_id]': payment.id,
            }),
          })

          if (!stripeRes.ok) {
            const errBody = await stripeRes.text().catch(() => '')
            throw new Error(`Stripe PaymentIntent failed: ${stripeRes.status} ${errBody.substring(0, 200)}`)
          }

          const piData = await stripeRes.json<{ id: string; status: string }>()

          if (piData.status === 'succeeded') {
            // Payment succeeded — record it
            await db.query(
              `UPDATE scheduled_payments
               SET status = 'completed', stripe_payment_intent_id = $1, completed_at = NOW()
               WHERE id = $2 AND organization_id = $3`,
              [piData.id, payment.id, payment.organization_id]
            )

            // Create collection_payments record
            await db.query(
              `INSERT INTO collection_payments
               (organization_id, account_id, amount, method, stripe_payment_id, notes, created_by)
               VALUES ($1, $2, $3, 'stripe', $4, 'Scheduled payment - auto-processed', 'system')`,
              [payment.organization_id, payment.account_id, payment.amount, piData.id]
            )

            // Update account balance
            await db.query(
              `UPDATE collection_accounts
               SET balance_due = GREATEST(balance_due - $1, 0),
                   status = CASE
                     WHEN balance_due - $1 <= 0 THEN 'paid'
                     ELSE 'partial'
                   END,
                   updated_at = NOW()
               WHERE id = $2 AND organization_id = $3`,
              [payment.amount, payment.account_id, payment.organization_id]
            )

            // Update payment plan counters if applicable
            await db.query(
              `UPDATE payment_plans
               SET completed_count = completed_count + 1,
                   next_payment_date = (
                     SELECT MIN(scheduled_date)
                     FROM scheduled_payments
                     WHERE account_id = $2 AND organization_id = $1 AND status = 'pending'
                   ),
                   status = CASE
                     WHEN completed_count + 1 >= installment_count THEN 'completed'
                     ELSE status
                   END,
                   updated_at = NOW()
               WHERE organization_id = $1 AND account_id = $2 AND status = 'active'`,
              [payment.organization_id, payment.account_id]
            )

            writeAuditLog(db, {
              organizationId: payment.organization_id,
              userId: 'system',
              action: AuditAction.COLLECTION_PAYMENT_CREATED,
              resourceType: 'scheduled_payment',
              resourceId: payment.id,
              oldValue: null,
              newValue: {
                amount: payment.amount,
                stripe_payment_intent_id: piData.id,
                type: 'scheduled_auto',
              },
            })

            processedCount++
            logger.info('Scheduled payment processed', {
              paymentId: payment.id,
              amount: payment.amount,
              accountId: payment.account_id,
            })
          } else {
            // Payment requires action or is processing — mark as failed for retry
            throw new Error(`PaymentIntent status: ${piData.status} (expected succeeded)`)
          }
        } else if (payment.method === 'manual') {
          // Manual payments just create a task for the agent
          await db.query(
            `UPDATE scheduled_payments
             SET status = 'pending', last_error = 'Manual payment — agent action required'
             WHERE id = $1 AND organization_id = $2`,
            [payment.id, payment.organization_id]
          )
          // Create a task for the agent
          await db.query(
            `INSERT INTO collection_tasks
             (organization_id, account_id, type, title, notes, due_date, status)
             VALUES ($1, $2, 'payment', 'Collect scheduled payment',
                     $3, CURRENT_DATE, 'pending')`,
            [
              payment.organization_id,
              payment.account_id,
              `Scheduled payment of $${payment.amount} is due. Contact debtor to collect.`,
            ]
          )
          processedCount++
        } else {
          // No payment method — skip for now
          await db.query(
            `UPDATE scheduled_payments
             SET last_error = 'No payment method configured'
             WHERE id = $1 AND organization_id = $2`,
            [payment.id, payment.organization_id]
          )
          errorCount++
        }
      } catch (error) {
        errorCount++
        const errMsg = (error as Error)?.message || 'Unknown error'

        // Check if max attempts reached
        const newAttemptCount = (payment.attempt_count || 0) + 1
        const maxAttempts = payment.max_attempts || 3

        if (newAttemptCount >= maxAttempts) {
          // Max retries exhausted — mark as permanently failed
          await db.query(
            `UPDATE scheduled_payments
             SET status = 'failed', last_error = $1
             WHERE id = $2 AND organization_id = $3`,
            [errMsg, payment.id, payment.organization_id]
          )

          // Update payment plan failure count
          await db.query(
            `UPDATE payment_plans
             SET failed_count = failed_count + 1,
                 status = CASE WHEN failed_count + 1 >= 3 THEN 'defaulted' ELSE status END,
                 updated_at = NOW()
             WHERE organization_id = $1 AND account_id = $2 AND status = 'active'`,
            [payment.organization_id, payment.account_id]
          )

          // Create follow-up task for agent
          await db.query(
            `INSERT INTO collection_tasks
             (organization_id, account_id, type, title, notes, due_date, status)
             VALUES ($1, $2, 'payment', 'Failed scheduled payment - follow up',
                     $3, CURRENT_DATE, 'pending')`,
            [
              payment.organization_id,
              payment.account_id,
              `Scheduled payment of $${payment.amount} failed after ${maxAttempts} attempts: ${errMsg}`,
            ]
          )
        } else {
          // Still has retries — reset to pending for next run
          await db.query(
            `UPDATE scheduled_payments
             SET status = 'pending', last_error = $1
             WHERE id = $2 AND organization_id = $3`,
            [errMsg, payment.id, payment.organization_id]
          )
        }

        logger.warn('Scheduled payment failed', {
          paymentId: payment.id,
          attempt: newAttemptCount,
          maxAttempts,
          error: errMsg,
        })
      }
    }

    return { processed: processedCount, errors: errorCount }
  } finally {
    await db.end()
  }
}

/**
 * Process dunning escalation for failed subscription invoices.
 * Escalates: reminder → warning → final_notice → suspension
 *
 * Called from scheduled.ts daily cron.
 */
export async function processDunningEscalation(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)
  let processedCount = 0
  let errorCount = 0

  try {
    // Find orgs with past_due subscriptions that need dunning action
    const result = await db.query(`
      SELECT o.id AS org_id, o.stripe_customer_id, o.subscription_status,
             be.invoice_id, be.amount, be.metadata,
             COALESCE(
               (SELECT MAX(de.escalation_level) FROM dunning_events de
                WHERE de.organization_id = o.id AND de.resolved = false),
               'none'
             ) AS current_level,
             COALESCE(
               (SELECT COUNT(*) FROM dunning_events de
                WHERE de.organization_id = o.id AND de.resolved = false),
               0
             ) AS dunning_count
      FROM organizations o
      JOIN billing_events be ON be.organization_id = o.id
        AND be.event_type = 'invoice_payment_failed'
        AND be.created_at > NOW() - INTERVAL '30 days'
      WHERE o.subscription_status = 'past_due'
      GROUP BY o.id, o.stripe_customer_id, o.subscription_status,
               be.invoice_id, be.amount, be.metadata
      ORDER BY be.created_at ASC
      LIMIT 20
    `)

    for (const org of result.rows) {
      try {
        const currentLevel = org.current_level || 'none'
        let nextLevel: string
        let nextActionAt: Date
        let actionTaken: string | null = null

        // Escalation ladder: none → reminder (day 1) → warning (day 3) → final_notice (day 7) → suspension (day 14)
        switch (currentLevel) {
          case 'none':
            nextLevel = 'reminder'
            nextActionAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
            actionTaken = 'dunning_reminder_logged'
            break
          case 'reminder':
            nextLevel = 'warning'
            nextActionAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // 4 more days
            actionTaken = 'dunning_warning_logged'
            break
          case 'warning':
            nextLevel = 'final_notice'
            nextActionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 more days
            actionTaken = 'dunning_final_notice_logged'
            break
          case 'final_notice':
            nextLevel = 'suspension'
            nextActionAt = new Date() // Immediate
            actionTaken = 'subscription_suspended'

            // Actually suspend the subscription via Stripe
            if (org.stripe_customer_id) {
              // Cancel at period end (graceful)
              const subResult = await db.query(
                `SELECT subscription_id FROM organizations WHERE id = $1`,
                [org.org_id]
              )
              const subId = subResult.rows[0]?.subscription_id
              if (subId) {
                await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    cancel_at_period_end: 'true',
                  }),
                }).catch((err) => {
                  logger.warn('Dunning: Stripe subscription cancel failed', {
                    orgId: org.org_id,
                    error: (err as Error)?.message,
                  })
                })
              }
            }
            break
          default:
            // Already at max escalation — skip
            continue
        }

        // Record dunning event
        await db.query(
          `INSERT INTO dunning_events
           (organization_id, invoice_id, stripe_customer_id, attempt_number,
            escalation_level, action_taken, next_action_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            org.org_id,
            org.invoice_id || 'unknown',
            org.stripe_customer_id || '',
            (org.dunning_count || 0) + 1,
            nextLevel,
            actionTaken,
            nextActionAt.toISOString(),
          ]
        )

        writeAuditLog(db, {
          organizationId: org.org_id,
          userId: 'system',
          action: AuditAction.PAYMENT_FAILED,
          resourceType: 'dunning',
          resourceId: org.invoice_id || org.org_id,
          oldValue: { level: currentLevel },
          newValue: { level: nextLevel, action: actionTaken },
        })

        processedCount++
        logger.info('Dunning escalation processed', {
          orgId: org.org_id,
          from: currentLevel,
          to: nextLevel,
          action: actionTaken,
        })
      } catch (error) {
        errorCount++
        logger.warn('Dunning escalation failed', {
          orgId: org.org_id,
          error: (error as Error)?.message,
        })
      }
    }

    return { processed: processedCount, errors: errorCount }
  } finally {
    await db.end()
  }
}
