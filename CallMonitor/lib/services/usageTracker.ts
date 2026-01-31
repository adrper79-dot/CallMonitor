/**
 * Usage Tracking Service
 * 
 * Tracks billable usage events per organization for revenue management.
 * Per ARCH_DOCS: Call-rooted design - usage tied to calls.
 * Per ERROR_HANDLING_REVIEW.md: Uses AppError for structured errors.
 * Per MASTER_ARCHITECTURE.txt: System of record compliance with audit logging.
 * 
 * @see ARCH_DOCS/01-CORE/MASTER_ARCHITECTURE.txt
 * @see ERROR_HANDLING_REVIEW.md
 */

import { query } from '@/lib/pgClient'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'

export type UsageMetric = 'call' | 'minute' | 'transcription' | 'translation' | 'ai_run'

interface TrackUsageParams {
  organizationId: string
  callId?: string
  metric: UsageMetric
  quantity: number
  metadata?: Record<string, any>
}

interface UsageSummary {
  calls: number
  minutes: number
  transcriptions: number
  translations: number
  period_start: string
  period_end: string
}

interface UsageLimits {
  calls_per_month: number
  minutes_per_month: number
  transcriptions_per_month: number
  translations_per_month: number
  can_record: boolean
  can_transcribe: boolean
  can_translate: boolean
  can_use_secret_shopper: boolean
  allow_overage: boolean
}

/**
 * Track a usage event
 * 
 * Per ARCH_DOCS: Audit logging for all usage events
 */
export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const { organizationId, callId, metric, quantity, metadata } = params

  try {
    // Get current billing period (calendar month)
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    await query(
      `INSERT INTO usage_records (
        id, organization_id, call_id, metric, quantity, billing_period_start, billing_period_end, metadata
       ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [
        organizationId,
        callId,
        metric,
        quantity,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        JSON.stringify(metadata || {})
      ]
    )

    logger.info('Usage tracked', { organizationId, metric, quantity, callId })

  } catch (err: any) {
    logger.error('Failed to track usage', err, { organizationId, metric, quantity })
    if (err instanceof AppError) throw err
    throw new AppError({
      code: 'USAGE_TRACKING_ERROR',
      message: 'Unexpected error tracking usage',
      user_message: 'Unable to record usage. Please contact support.',
      severity: 'HIGH',
      retriable: true,
      details: { error: err.message }
    })
  }
}

/**
 * Get usage summary for current billing period
 * 
 * Used in Settings → Billing tab to show usage
 */
export async function getUsageSummary(organizationId: string): Promise<UsageSummary> {
  try {
    // Get current billing period
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const { rows: records } = await query(
      `SELECT metric, quantity FROM usage_records 
       WHERE organization_id = $1 
       AND billing_period_start >= $2 
       AND billing_period_end <= $3`,
      [organizationId, periodStart.toISOString(), periodEnd.toISOString()]
    )

    // Aggregate by metric
    const summary: UsageSummary = {
      calls: 0,
      minutes: 0,
      transcriptions: 0,
      translations: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString()
    }

    records?.forEach(record => {
      if (record.metric === 'call') summary.calls += record.quantity
      if (record.metric === 'minute') summary.minutes += record.quantity
      if (record.metric === 'transcription') summary.transcriptions += record.quantity
      if (record.metric === 'translation') summary.translations += record.quantity
    })

    return summary

  } catch (err: any) {
    if (err instanceof AppError) throw err
    throw new AppError({
      code: 'USAGE_SUMMARY_ERROR',
      message: 'Failed to generate usage summary',
      user_message: 'Unable to load usage data.',
      severity: 'MEDIUM',
      retriable: true
    })
  }
}

/**
 * Check if organization has exceeded usage limits
 * 
 * Used before executing calls to enforce plan limits
 * Per ARCH_DOCS: Graceful degradation - fail open to avoid breaking calls
 */
export async function checkUsageLimits(
  organizationId: string,
  plan: string,
  metric: UsageMetric
): Promise<{ allowed: boolean; reason?: string; limits?: UsageLimits }> {
  try {
    // Get plan limits
    const { rows: limitsRows } = await query(
      `SELECT * FROM usage_limits WHERE plan = $1 LIMIT 1`,
      [plan.toLowerCase()]
    )
    const limits = limitsRows[0]

    if (!limits) {
      logger.warn('Plan limits not found, allowing usage', { plan })
      return { allowed: true } // Fail open per ARCH_DOCS
    }

    // Get current usage
    const usage = await getUsageSummary(organizationId)

    // Check specific metric
    if (metric === 'call' && usage.calls >= limits.calls_per_month) {
      return {
        allowed: false,
        reason: `Monthly call limit reached (${limits.calls_per_month} calls)`,
        limits
      }
    }

    if (metric === 'minute' && usage.minutes >= limits.minutes_per_month) {
      return {
        allowed: false,
        reason: `Monthly minute limit reached (${limits.minutes_per_month} minutes)`,
        limits
      }
    }

    if (metric === 'transcription' && usage.transcriptions >= limits.transcriptions_per_month) {
      return {
        allowed: false,
        reason: `Monthly transcription limit reached (${limits.transcriptions_per_month})`,
        limits
      }
    }

    if (metric === 'translation' && usage.translations >= limits.translations_per_month) {
      return {
        allowed: false,
        reason: `Monthly translation limit reached (${limits.translations_per_month})`,
        limits
      }
    }

    return { allowed: true, limits }

  } catch (err: any) {
    logger.error('Error checking usage limits', err, { organizationId, plan, metric })
    // Fail open to avoid breaking calls per ARCH_DOCS graceful degradation
    return { allowed: true }
  }
}

/**
 * Get plan limits for display in UI
 * Per ARCH_DOCS: usage_limits is per-organization
 */
export async function getPlanLimits(organizationId: string): Promise<UsageLimits | null> {
  try {
    const { rows: limits } = await query(
      `SELECT * FROM usage_limits WHERE organization_id = $1`,
      [organizationId]
    )

    if (!limits || limits.length === 0) {
      // Return default limits for free tier if no custom limits set
      return {
        calls_per_month: 100,
        minutes_per_month: 500,
        transcriptions_per_month: 50,
        translations_per_month: 0,
        can_record: true,
        can_transcribe: true,
        can_translate: false,
        can_use_secret_shopper: false,
        allow_overage: false
      }
    }

    // Convert array of metric-specific limits to single object
    const usageLimits: UsageLimits = {
      calls_per_month: 100,
      minutes_per_month: 500,
      transcriptions_per_month: 50,
      translations_per_month: 0,
      can_record: true,
      can_transcribe: true,
      can_translate: false,
      can_use_secret_shopper: false,
      allow_overage: false
    }

    limits.forEach((limit: any) => {
      if (limit.billing_period === 'month') {
        if (limit.metric === 'call') usageLimits.calls_per_month = limit.limit_value
        if (limit.metric === 'minute') usageLimits.minutes_per_month = limit.limit_value
        if (limit.metric === 'transcription') usageLimits.transcriptions_per_month = limit.limit_value
        if (limit.metric === 'translation') usageLimits.translations_per_month = limit.limit_value
      }
    })

    // Set feature flags based on limits
    usageLimits.can_translate = usageLimits.translations_per_month > 0

    return usageLimits

  } catch (err: any) {
    logger.error('Error fetching plan limits', err, { organizationId })
    return null
  }
}
