/**
 * Likelihood-to-Pay Scoring Engine
 *
 * Computes an AI-driven score (0-100) indicating how likely a debtor is to pay.
 * Factors: payment history, call sentiment, promise patterns, days past due,
 * contact frequency, balance relative to income signals.
 *
 * Architecture:
 *   - Called on-demand via API or as part of daily cron
 *   - Stores results on collection_accounts: likelihood_score, likelihood_factors
 *   - Uses statistical scoring (no external ML API — deterministic and fast)
 *
 * AI Role Policy: Score is advisory only. Human operators decide actions.
 *
 * @module workers/src/lib/likelihood-scorer
 */

import type { Env } from '../index'
import { getDb, type DbClient } from './db'
import { logger } from './logger'

interface LikelihoodResult {
  score: number // 0-100
  factors: Record<string, { value: number; weight: number; contribution: number }>
  recommendation: string
}

/**
 * Compute likelihood-to-pay score for a single collection account.
 */
export async function computeLikelihoodScore(
  db: DbClient,
  organizationId: string,
  accountId: string
): Promise<LikelihoodResult> {
  const factors: Record<string, { value: number; weight: number; contribution: number }> = {}
  let totalScore = 50 // Start at neutral

  // 1. Payment history (weight: 30)
  const paymentHistory = await db.query(
    `SELECT COUNT(*)::int AS payment_count,
            COALESCE(SUM(amount), 0)::numeric AS total_paid,
            MAX(created_at) AS last_payment_date
     FROM collection_payments
     WHERE account_id = $1 AND organization_id = $2`,
    [accountId, organizationId]
  )
  const payments = paymentHistory.rows[0]
  const paymentCount = parseInt(payments.payment_count) || 0
  const hasPaid = paymentCount > 0
  const daysSinceLastPayment = payments.last_payment_date
    ? Math.floor((Date.now() - new Date(payments.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  let paymentScore: number
  if (paymentCount >= 3) paymentScore = 90
  else if (paymentCount === 2) paymentScore = 75
  else if (paymentCount === 1) paymentScore = 60
  else paymentScore = 20

  // Decay if last payment was long ago
  if (hasPaid && daysSinceLastPayment > 90) paymentScore -= 15
  else if (hasPaid && daysSinceLastPayment > 30) paymentScore -= 5

  factors.payment_history = { value: paymentScore, weight: 30, contribution: paymentScore * 0.30 }

  // 2. Contact engagement (weight: 20)
  const callHistory = await db.query(
    `SELECT COUNT(*)::int AS call_count,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS answered_count,
            COALESCE(AVG(duration), 0)::int AS avg_duration
     FROM calls c
     WHERE c.organization_id = $1
       AND (c.to_number IN (SELECT primary_phone FROM collection_accounts WHERE id = $2)
            OR c.from_number IN (SELECT primary_phone FROM collection_accounts WHERE id = $2))
       AND c.created_at > NOW() - INTERVAL '30 days'`,
    [organizationId, accountId]
  )
  const calls = callHistory.rows[0]
  const answerRate = calls.call_count > 0 ? (calls.answered_count / calls.call_count) * 100 : 0
  const avgDuration = parseInt(calls.avg_duration) || 0

  let engagementScore: number
  if (answerRate >= 70 && avgDuration > 60) engagementScore = 85
  else if (answerRate >= 50) engagementScore = 65
  else if (answerRate >= 20) engagementScore = 40
  else engagementScore = 15

  factors.contact_engagement = { value: engagementScore, weight: 20, contribution: engagementScore * 0.20 }

  // 3. Sentiment trend (weight: 15)
  const sentimentData = await db.query(
    `SELECT assemblyai_sentiment
     FROM calls c
     WHERE c.organization_id = $1
       AND (c.to_number IN (SELECT primary_phone FROM collection_accounts WHERE id = $2)
            OR c.from_number IN (SELECT primary_phone FROM collection_accounts WHERE id = $2))
       AND c.assemblyai_sentiment IS NOT NULL
     ORDER BY c.created_at DESC
     LIMIT 3`,
    [organizationId, accountId]
  )

  let sentimentScore = 50 // neutral default
  if (sentimentData.rows.length > 0) {
    let positiveCount = 0
    let negativeCount = 0
    for (const row of sentimentData.rows) {
      const sentiments = row.assemblyai_sentiment as Array<{ sentiment: string }>
      if (sentiments) {
        for (const s of sentiments) {
          if (s.sentiment === 'POSITIVE') positiveCount++
          if (s.sentiment === 'NEGATIVE') negativeCount++
        }
      }
    }
    const total = positiveCount + negativeCount
    if (total > 0) {
      sentimentScore = Math.round((positiveCount / total) * 100)
    }
  }

  factors.sentiment_trend = { value: sentimentScore, weight: 15, contribution: sentimentScore * 0.15 }

  // 4. Promise keeping (weight: 20)
  const promiseData = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE type = 'promise')::int AS total_promises,
       COUNT(*) FILTER (WHERE type = 'promise' AND status = 'completed')::int AS kept_promises
     FROM collection_tasks
     WHERE account_id = $1 AND organization_id = $2`,
    [accountId, organizationId]
  )
  const promises = promiseData.rows[0]
  const totalPromises = parseInt(promises.total_promises) || 0
  const keptPromises = parseInt(promises.kept_promises) || 0

  let promiseScore: number
  if (totalPromises === 0) promiseScore = 40 // No data
  else promiseScore = Math.round((keptPromises / totalPromises) * 100)

  factors.promise_keeping = { value: promiseScore, weight: 20, contribution: promiseScore * 0.20 }

  // 5. Account age / balance ratio (weight: 15)
  const accountData = await db.query(
    `SELECT balance_due, created_at, status
     FROM collection_accounts
     WHERE id = $1 AND organization_id = $2`,
    [accountId, organizationId]
  )
  if (accountData.rows.length === 0) {
    return { score: 0, factors, recommendation: 'Account not found' }
  }

  const account = accountData.rows[0]
  const balanceDue = parseFloat(account.balance_due) || 0
  const totalPaid = parseFloat(payments.total_paid) || 0
  const paidRatio = balanceDue + totalPaid > 0 ? (totalPaid / (balanceDue + totalPaid)) * 100 : 0

  let balanceScore: number
  if (paidRatio >= 75) balanceScore = 90
  else if (paidRatio >= 50) balanceScore = 70
  else if (paidRatio >= 25) balanceScore = 50
  else if (paidRatio > 0) balanceScore = 35
  else balanceScore = 15

  factors.balance_progress = { value: balanceScore, weight: 15, contribution: balanceScore * 0.15 }

  // Compute final score
  totalScore = Math.round(
    factors.payment_history.contribution +
    factors.contact_engagement.contribution +
    factors.sentiment_trend.contribution +
    factors.promise_keeping.contribution +
    factors.balance_progress.contribution
  )

  // Clamp to 0-100
  totalScore = Math.max(0, Math.min(100, totalScore))

  // Generate recommendation
  let recommendation: string
  if (totalScore >= 75) recommendation = 'High likelihood — prioritize for payment arrangement'
  else if (totalScore >= 50) recommendation = 'Moderate likelihood — continue regular contact'
  else if (totalScore >= 25) recommendation = 'Low likelihood — consider escalation or settlement offer'
  else recommendation = 'Very low likelihood — review for write-off or legal action'

  // Store the score
  await db.query(
    `UPDATE collection_accounts
     SET likelihood_score = $1, likelihood_factors = $2, likelihood_updated_at = NOW(), updated_at = NOW()
     WHERE id = $3 AND organization_id = $4`,
    [totalScore, JSON.stringify(factors), accountId, organizationId]
  )

  logger.info('Likelihood score computed', {
    accountId,
    organizationId,
    score: totalScore,
  })

  return { score: totalScore, factors, recommendation }
}

/**
 * Batch-compute likelihood scores for all active accounts in an org.
 * Designed for daily cron usage.
 *
 * Uses a single CTE query to fetch all factor data for up to 500 accounts,
 * computes scores in-memory, then batch-UPDATEs results (50-row batches).
 * This replaces the previous N+1 pattern (500 accounts × 5 queries = 2,500 queries → 1 + ~10).
 */
export async function batchComputeLikelihood(
  env: Env,
  organizationId: string
): Promise<{ computed: number; errors: number }> {
  const db = getDb(env)
  let computed = 0
  let errors = 0

  try {
    // ── Single CTE: fetch ALL factor data for all target accounts ────
    const bulkResult = await db.query(
      `WITH target_accounts AS (
         SELECT id, balance_due, primary_phone, created_at, status
         FROM collection_accounts
         WHERE organization_id = $1 AND is_deleted = false AND status IN ('active', 'partial')
         ORDER BY balance_due DESC
         LIMIT 500
       ),
       payment_stats AS (
         SELECT cp.account_id,
                COUNT(*)::int AS payment_count,
                COALESCE(SUM(cp.amount), 0)::numeric AS total_paid,
                MAX(cp.created_at) AS last_payment_date
         FROM collection_payments cp
         WHERE cp.organization_id = $1 AND cp.account_id IN (SELECT id FROM target_accounts)
         GROUP BY cp.account_id
       ),
       call_stats AS (
         SELECT ta.id AS account_id,
                COUNT(c.id)::int AS call_count,
                COUNT(c.id) FILTER (WHERE c.status = 'completed')::int AS answered_count,
                COALESCE(AVG(c.duration), 0)::int AS avg_duration
         FROM target_accounts ta
         LEFT JOIN calls c ON c.organization_id = $1
           AND (c.to_number = ta.primary_phone OR c.from_number = ta.primary_phone)
           AND c.created_at > NOW() - INTERVAL '30 days'
         GROUP BY ta.id
       ),
       sentiment_raw AS (
         SELECT ta.id AS account_id,
                c.assemblyai_sentiment,
                ROW_NUMBER() OVER (PARTITION BY ta.id ORDER BY c.created_at DESC) AS rn
         FROM target_accounts ta
         JOIN calls c ON c.organization_id = $1
           AND (c.to_number = ta.primary_phone OR c.from_number = ta.primary_phone)
           AND c.assemblyai_sentiment IS NOT NULL
       ),
       sentiment_stats AS (
         SELECT account_id,
                jsonb_agg(assemblyai_sentiment) AS sentiments
         FROM sentiment_raw
         WHERE rn <= 3
         GROUP BY account_id
       ),
       promise_stats AS (
         SELECT ct.account_id,
                COUNT(*) FILTER (WHERE ct.type = 'promise')::int AS total_promises,
                COUNT(*) FILTER (WHERE ct.type = 'promise' AND ct.status = 'completed')::int AS kept_promises
         FROM collection_tasks ct
         WHERE ct.organization_id = $1 AND ct.account_id IN (SELECT id FROM target_accounts)
         GROUP BY ct.account_id
       )
       SELECT ta.id, ta.balance_due, ta.primary_phone, ta.status,
              COALESCE(ps.payment_count, 0)::int AS payment_count,
              COALESCE(ps.total_paid, 0)::numeric AS total_paid,
              ps.last_payment_date,
              COALESCE(cs.call_count, 0)::int AS call_count,
              COALESCE(cs.answered_count, 0)::int AS answered_count,
              COALESCE(cs.avg_duration, 0)::int AS avg_duration,
              ss.sentiments,
              COALESCE(prs.total_promises, 0)::int AS total_promises,
              COALESCE(prs.kept_promises, 0)::int AS kept_promises
       FROM target_accounts ta
       LEFT JOIN payment_stats ps ON ps.account_id = ta.id
       LEFT JOIN call_stats cs ON cs.account_id = ta.id
       LEFT JOIN sentiment_stats ss ON ss.account_id = ta.id
       LEFT JOIN promise_stats prs ON prs.account_id = ta.id`,
      [organizationId]
    )

    // ── Compute scores in-memory ────────────────────────────────────
    const updates: Array<{ id: string; score: number; factors: string }> = []

    for (const row of bulkResult.rows) {
      try {
        const factors: Record<string, { value: number; weight: number; contribution: number }> = {}

        // 1. Payment history (weight: 30)
        const paymentCount = parseInt(row.payment_count) || 0
        const hasPaid = paymentCount > 0
        const daysSinceLastPayment = row.last_payment_date
          ? Math.floor((Date.now() - new Date(row.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
          : 999

        let paymentScore: number
        if (paymentCount >= 3) paymentScore = 90
        else if (paymentCount === 2) paymentScore = 75
        else if (paymentCount === 1) paymentScore = 60
        else paymentScore = 20

        if (hasPaid && daysSinceLastPayment > 90) paymentScore -= 15
        else if (hasPaid && daysSinceLastPayment > 30) paymentScore -= 5

        factors.payment_history = { value: paymentScore, weight: 30, contribution: paymentScore * 0.30 }

        // 2. Contact engagement (weight: 20)
        const callCount = parseInt(row.call_count) || 0
        const answeredCount = parseInt(row.answered_count) || 0
        const avgDuration = parseInt(row.avg_duration) || 0
        const answerRate = callCount > 0 ? (answeredCount / callCount) * 100 : 0

        let engagementScore: number
        if (answerRate >= 70 && avgDuration > 60) engagementScore = 85
        else if (answerRate >= 50) engagementScore = 65
        else if (answerRate >= 20) engagementScore = 40
        else engagementScore = 15

        factors.contact_engagement = { value: engagementScore, weight: 20, contribution: engagementScore * 0.20 }

        // 3. Sentiment trend (weight: 15)
        let sentimentScore = 50
        if (row.sentiments) {
          let positiveCount = 0
          let negativeCount = 0
          const sentimentArray = Array.isArray(row.sentiments) ? row.sentiments : []
          for (const sentimentData of sentimentArray) {
            const sentiments = Array.isArray(sentimentData) ? sentimentData : []
            for (const s of sentiments) {
              if (s?.sentiment === 'POSITIVE') positiveCount++
              if (s?.sentiment === 'NEGATIVE') negativeCount++
            }
          }
          const total = positiveCount + negativeCount
          if (total > 0) sentimentScore = Math.round((positiveCount / total) * 100)
        }

        factors.sentiment_trend = { value: sentimentScore, weight: 15, contribution: sentimentScore * 0.15 }

        // 4. Promise keeping (weight: 20)
        const totalPromises = parseInt(row.total_promises) || 0
        const keptPromises = parseInt(row.kept_promises) || 0
        const promiseScore = totalPromises === 0 ? 40 : Math.round((keptPromises / totalPromises) * 100)

        factors.promise_keeping = { value: promiseScore, weight: 20, contribution: promiseScore * 0.20 }

        // 5. Balance progress (weight: 15)
        const balanceDue = parseFloat(row.balance_due) || 0
        const totalPaid = parseFloat(row.total_paid) || 0
        const paidRatio = balanceDue + totalPaid > 0 ? (totalPaid / (balanceDue + totalPaid)) * 100 : 0

        let balanceScore: number
        if (paidRatio >= 75) balanceScore = 90
        else if (paidRatio >= 50) balanceScore = 70
        else if (paidRatio >= 25) balanceScore = 50
        else if (paidRatio > 0) balanceScore = 35
        else balanceScore = 15

        factors.balance_progress = { value: balanceScore, weight: 15, contribution: balanceScore * 0.15 }

        // Compute final score (clamp 0-100)
        const score = Math.max(0, Math.min(100, Math.round(
          factors.payment_history.contribution +
          factors.contact_engagement.contribution +
          factors.sentiment_trend.contribution +
          factors.promise_keeping.contribution +
          factors.balance_progress.contribution
        )))

        updates.push({ id: row.id, score, factors: JSON.stringify(factors) })
        computed++
      } catch (err) {
        errors++
        logger.warn('Likelihood scoring failed for account', {
          accountId: row.id,
          error: (err as Error)?.message,
        })
      }
    }

    // ── Batch UPDATE in groups of 50 ────────────────────────────────
    const BATCH_SIZE = 50
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      // Build parameterized VALUES: ($1, $2, $3), ($4, $5, $6), ...
      const values: any[] = []
      const placeholders: string[] = []
      batch.forEach((u, idx) => {
        const base = idx * 3
        placeholders.push(`($${base + 1}::uuid, $${base + 2}::int, $${base + 3}::jsonb)`)
        values.push(u.id, u.score, u.factors)
      })

      await db.query(
        `UPDATE collection_accounts AS ca
         SET likelihood_score = v.score,
             likelihood_factors = v.factors,
             likelihood_updated_at = NOW(),
             updated_at = NOW()
         FROM (VALUES ${placeholders.join(', ')}) AS v(id, score, factors)
         WHERE ca.id = v.id AND ca.organization_id = $${values.length + 1}`,
        [...values, organizationId]
      )
    }

    logger.info('Batch likelihood scoring complete', {
      organizationId,
      computed,
      errors,
      queryCount: `1 CTE + ${Math.ceil(updates.length / BATCH_SIZE)} batch UPDATEs`,
    })

    return { computed, errors }
  } finally {
    await db.end()
  }
}
