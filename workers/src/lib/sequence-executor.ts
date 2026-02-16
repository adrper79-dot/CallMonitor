/**
 * Sequence Execution Engine
 *
 * Processes active campaign sequences on a cron schedule.
 * Evaluates step conditions, timing, and fires next actions
 * (call tasks, SMS, email) for enrolled accounts.
 *
 * Tables used:
 *   - campaign_sequences: sequence definitions with JSON steps
 *   - sequence_enrollments: tracks per-account progress through sequences
 *   - collection_accounts: account data for condition evaluation
 *   - calls, collection_payments: for checking contact/payment conditions
 *   - tasks, messages: action targets
 *
 * AI Role: stenographer — creates tasks and queues messages for human execution.
 * Never autonomously initiates calls.
 *
 * @see workers/src/routes/campaigns.ts — sequence CRUD
 */

import type { Env } from '../index'
import { getDb } from './db'
import { logger } from './logger'

interface SequenceStep {
  type: 'call' | 'email' | 'sms' | 'wait'
  delay_hours: number
  condition: 'always' | 'no_contact' | 'no_payment'
  template_id?: string
}

/**
 * Main entry point — called by scheduled.ts on cron.
 * Iterates active sequences, evaluates enrollments, and fires due steps.
 */
export async function executeSequences(
  env: Env
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)
  let processed = 0
  let errors = 0

  try {
    // Get all active sequences with their campaign info
    const sequences = await db.query(
      `SELECT cs.id, cs.organization_id, cs.campaign_id, cs.name, cs.steps,
              c.name AS campaign_name
       FROM campaign_sequences cs
       JOIN campaigns c ON c.id = cs.campaign_id
       WHERE cs.status = 'active'
       LIMIT 50`
    )

    if (sequences.rows.length === 0) {
      return { processed: 0, errors: 0 }
    }

    for (const seq of sequences.rows) {
      try {
        const steps: SequenceStep[] =
          typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps

        if (!steps || steps.length === 0) continue

        // Get enrollments that are due for next step
        // Excludes accounts with DNC / cease & desist flags (compliance first)
        const enrollments = await db.query(
          `SELECT se.id, se.account_id, se.current_step, se.last_step_at,
                  ca.primary_phone, ca.email, ca.debtor_name, ca.balance_due
           FROM sequence_enrollments se
           JOIN collection_accounts ca ON ca.id = se.account_id
           WHERE se.sequence_id = $1
             AND se.status = 'active'
             AND se.current_step < $2
             AND ca.organization_id = $3
             AND ca.is_deleted = false
             AND ca.do_not_call = false
             AND ca.cease_and_desist = false
           LIMIT 100`,
          [seq.id, steps.length, seq.organization_id]
        )

        for (const enrollment of enrollments.rows) {
          try {
            const stepIndex = enrollment.current_step || 0
            const step = steps[stepIndex]
            if (!step) continue

            // Check delay: has enough time passed since last step?
            if (enrollment.last_step_at && step.delay_hours > 0) {
              const lastStepTime = new Date(enrollment.last_step_at).getTime()
              const delayMs = step.delay_hours * 60 * 60 * 1000
              if (Date.now() - lastStepTime < delayMs) {
                continue // Not yet time for next step
              }
            }

            // Evaluate condition
            const conditionMet = await evaluateCondition(
              db,
              step.condition,
              enrollment.account_id,
              seq.organization_id
            )
            if (!conditionMet) {
              // Condition not met — skip this step and advance
              await db.query(
                `UPDATE sequence_enrollments
                 SET current_step = current_step + 1, last_step_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [enrollment.id]
              )
              continue
            }

            // Execute the step action
            await executeStep(env, db, step, enrollment, seq)

            // Advance enrollment to next step
            const nextStep = stepIndex + 1
            const isComplete = nextStep >= steps.length

            await db.query(
              `UPDATE sequence_enrollments
               SET current_step = $1,
                   last_step_at = NOW(),
                   status = $2,
                   updated_at = NOW()
               WHERE id = $3`,
              [nextStep, isComplete ? 'completed' : 'active', enrollment.id]
            )

            processed++
          } catch (stepErr) {
            errors++
            logger.warn('Sequence step execution failed', {
              enrollmentId: enrollment.id,
              sequenceId: seq.id,
              error: (stepErr as Error)?.message,
            })
          }
        }
      } catch (seqErr) {
        errors++
        logger.warn('Sequence processing failed', {
          sequenceId: seq.id,
          error: (seqErr as Error)?.message,
        })
      }
    }

    return { processed, errors }
  } catch (err) {
    logger.error('Sequence executor top-level error', { error: (err as Error)?.message })
    return { processed, errors: errors + 1 }
  } finally {
    await db.end()
  }
}

/**
 * Evaluate step condition against account state.
 *
 * - 'always': always proceed
 * - 'no_contact': proceed only if no successful contact in last 7 days
 * - 'no_payment': proceed only if no payment in last 30 days
 */
async function evaluateCondition(
  db: any,
  condition: string,
  accountId: string,
  organizationId: string
): Promise<boolean> {
  if (condition === 'always') return true

  if (condition === 'no_contact') {
    const result = await db.query(
      `SELECT COUNT(*) AS cnt FROM calls
       WHERE organization_id = $1
         AND account_id = $2
         AND status IN ('completed', 'in_progress')
         AND created_at > NOW() - INTERVAL '7 days'`,
      [organizationId, accountId]
    )
    return parseInt(result.rows[0]?.cnt || '0', 10) === 0
  }

  if (condition === 'no_payment') {
    const result = await db.query(
      `SELECT COUNT(*) AS cnt FROM collection_payments
       WHERE organization_id = $1
         AND account_id = $2
         AND status = 'completed'
         AND created_at > NOW() - INTERVAL '30 days'`,
      [organizationId, accountId]
    )
    return parseInt(result.rows[0]?.cnt || '0', 10) === 0
  }

  return true // Unknown condition — default to proceed
}

/**
 * Execute a single sequence step action.
 *
 * AI Role Policy: call steps create TASKS (human-executed).
 * SMS/email steps queue MESSAGES for outbound processing.
 */
async function executeStep(
  env: Env,
  db: any,
  step: SequenceStep,
  enrollment: any,
  sequence: any
): Promise<void> {
  switch (step.type) {
    case 'wait':
      // Wait steps are handled by the delay_hours check above — no action needed
      break

    case 'call':
      // Create a call task for agents to execute (AI = notary, not actor)
      await db.query(
        `INSERT INTO tasks
          (organization_id, type, priority, title, description, status, due_date, metadata)
         VALUES ($1, 'call', 'medium', $2, $3, 'open', NOW(), $4::jsonb)`,
        [
          sequence.organization_id,
          `Sequence call: ${enrollment.debtor_name || 'Account'}`,
          `Campaign "${sequence.campaign_name}" sequence "${sequence.name}" — call step`,
          JSON.stringify({
            account_id: enrollment.account_id,
            phone: enrollment.primary_phone,
            sequence_id: sequence.id,
            enrollment_id: enrollment.id,
            template_id: step.template_id || null,
          }),
        ]
      )
      break

    case 'sms':
      // Queue an SMS message for outbound delivery
      if (enrollment.primary_phone) {
        await db.query(
          `INSERT INTO messages
            (organization_id, account_id, direction, channel, to_number, message_body, status)
           VALUES ($1, $2, 'outbound', 'sms', $3, $4, 'pending')`,
          [
            sequence.organization_id,
            enrollment.account_id,
            enrollment.primary_phone,
            step.template_id
              ? `Template: ${step.template_id}`
              : `Payment reminder for your account. Please contact us to arrange payment.`,
          ]
        )
      }
      break

    case 'email':
      // Queue an email for outbound delivery
      if (enrollment.email) {
        await db.query(
          `INSERT INTO messages
            (organization_id, account_id, direction, channel, to_email, message_body, status)
           VALUES ($1, $2, 'outbound', 'email', $3, $4, 'pending')`,
          [
            sequence.organization_id,
            enrollment.account_id,
            enrollment.email,
            step.template_id
              ? `Template: ${step.template_id}`
              : `Payment reminder for your account. Please contact us to arrange payment.`,
          ]
        )
      }
      break
  }
}
