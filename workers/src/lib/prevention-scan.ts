/**
 * Prevention Scan — Early Delinquency Task Creator
 *
 * Runs as part of the daily 6am cron. Identifies collection accounts
 * whose likelihood-to-pay score has dropped below a configurable threshold
 * and auto-creates follow-up tasks for human agents to review.
 *
 * Architecture:
 *   - Reads scores already computed by batchComputeLikelihood (no redundant scoring)
 *   - Creates 'prevention_review' tasks on collection_tasks (existing infrastructure)
 *   - Skips accounts that already have an open prevention task (dedup)
 *   - Respects multi-tenant isolation (per-org loop)
 *   - AI Role Policy: Flags only — human operators decide all actions
 *
 * @module workers/src/lib/prevention-scan
 */

import type { Env } from '../index'
import { getDb } from './db'
import { batchComputeLikelihood } from './likelihood-scorer'
import { logger } from './logger'

/** Default score threshold — accounts scoring below this get flagged */
const DEFAULT_THRESHOLD = 35

/** Maximum tasks to create per org per run (safety cap) */
const MAX_TASKS_PER_ORG = 50

export interface PreventionScanResult {
  orgsScanned: number
  accountsScored: number
  tasksCreated: number
  errors: number
}

/**
 * Run the prevention scan across all active organizations.
 *
 * Flow:
 *   1. Fetch orgs with active collection accounts
 *   2. For each org, run batch likelihood scoring (refreshes scores)
 *   3. Query accounts below threshold that don't have an open prevention task
 *   4. Create 'prevention_review' tasks for agents
 */
export async function runPreventionScan(env: Env): Promise<PreventionScanResult> {
  const db = getDb(env)
  const result: PreventionScanResult = {
    orgsScanned: 0,
    accountsScored: 0,
    tasksCreated: 0,
    errors: 0,
  }

  try {
    // 1. Get orgs with active collections (only scan orgs that use collections)
    const orgsResult = await db.query(
      `SELECT DISTINCT o.id AS organization_id
       FROM organizations o
       JOIN org_members om ON om.organization_id = o.id
       JOIN collection_accounts ca ON ca.organization_id = o.id
         AND ca.is_deleted = false
         AND ca.status IN ('active', 'partial')
       WHERE o.plan != 'free'
       LIMIT 100`
    )

    const orgs = orgsResult.rows
    logger.info('Prevention scan starting', { orgCount: orgs.length })

    for (const org of orgs) {
      const orgId = org.organization_id
      try {
        // 2. Refresh likelihood scores for this org
        const scoring = await batchComputeLikelihood(env, orgId)
        result.accountsScored += scoring.computed

        // 3. Find at-risk accounts below threshold with no open prevention task
        await createPreventionTasks(env, orgId, result)
        result.orgsScanned++
      } catch (err) {
        result.errors++
        logger.error('Prevention scan failed for org', {
          organizationId: orgId,
          error: (err as Error)?.message,
        })
      }
    }

    logger.info('Prevention scan complete', { ...result })
    return result
  } finally {
    await db.end()
  }
}

/**
 * Create prevention review tasks for accounts below threshold.
 * Skips accounts that already have an open prevention task (dedup).
 */
async function createPreventionTasks(
  env: Env,
  organizationId: string,
  result: PreventionScanResult
): Promise<void> {
  const db = getDb(env)
  try {
    // Read org-specific threshold from sentiment_alert_configs (reuse existing config table)
    // or fall back to default. Orgs can customize via PUT /api/productivity/prevention-config.
    const configResult = await db.query(
      `SELECT config_value::int AS threshold
       FROM org_feature_flags
       WHERE organization_id = $1 AND feature = 'prevention_threshold'
       LIMIT 1`,
      [organizationId]
    )
    const threshold = configResult.rows[0]?.threshold || DEFAULT_THRESHOLD

    // Find at-risk accounts:
    //  - Likelihood score below threshold
    //  - Score was updated in last 24h (freshly computed)
    //  - No existing open prevention_review task
    const atRisk = await db.query(
      `SELECT ca.id, ca.name, ca.balance_due, ca.likelihood_score,
              ca.primary_phone, ca.status
       FROM collection_accounts ca
       WHERE ca.organization_id = $1
         AND ca.is_deleted = false
         AND ca.status IN ('active', 'partial')
         AND ca.likelihood_score IS NOT NULL
         AND ca.likelihood_score < $2
         AND ca.likelihood_updated_at > NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM collection_tasks ct
           WHERE ct.account_id = ca.id
             AND ct.organization_id = $1
             AND ct.type = 'prevention_review'
             AND ct.status IN ('pending', 'in_progress')
         )
       ORDER BY ca.likelihood_score ASC, ca.balance_due DESC
       LIMIT $3`,
      [organizationId, threshold, MAX_TASKS_PER_ORG]
    )

    if (atRisk.rows.length === 0) return

    // Batch insert prevention tasks
    const values: unknown[] = []
    const placeholders: string[] = []

    for (let i = 0; i < atRisk.rows.length; i++) {
      const acc = atRisk.rows[i]
      const base = i * 5
      placeholders.push(
        `($${base + 1}, $${base + 2}, 'prevention_review', $${base + 3}, $${base + 4}, $${base + 5})`
      )
      values.push(
        organizationId,
        acc.id,
        `Prevention review: ${acc.name} (score ${acc.likelihood_score}/${threshold})`,
        `Auto-flagged: Likelihood score dropped to ${acc.likelihood_score}. ` +
          `Balance: $${parseFloat(acc.balance_due || 0).toFixed(2)}. ` +
          `Action needed: Review account and determine next steps.`,
        // Due date: tomorrow
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
    }

    await db.query(
      `INSERT INTO collection_tasks
        (organization_id, account_id, type, title, notes, due_date)
       VALUES ${placeholders.join(', ')}`,
      values
    )

    result.tasksCreated += atRisk.rows.length

    logger.info('Prevention tasks created', {
      organizationId,
      count: atRisk.rows.length,
      threshold,
    })
  } finally {
    await db.end()
  }
}
