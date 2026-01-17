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

import { createClient } from '@supabase/supabase-js'
import { AppError } from '@/lib/errors/AppError'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, serviceKey)

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

    const { error } = await supabaseAdmin
      .from('usage_records')
      .insert({
        organization_id: organizationId,
        call_id: callId,
        metric,
        quantity,
        billing_period_start: periodStart.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        metadata: metadata || {}
      })

    if (error) {
      logger.error('Failed to track usage', error, { organizationId, metric, quantity })
      throw new AppError({
        code: 'USAGE_TRACKING_FAILED',
        message: `Failed to track ${metric} usage`,
        user_message: 'Unable to record usage. Please contact support.',
        severity: 'HIGH',
        retriable: true,
        details: { organizationId, metric, quantity }
      })
    }

    logger.info('Usage tracked', { organizationId, metric, quantity, callId })

  } catch (err: any) {
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

    const { data: records, error } = await supabaseAdmin
      .from('usage_records')
      .select('metric, quantity')
      .eq('organization_id', organizationId)
      .gte('billing_period_start', periodStart.toISOString())
      .lte('billing_period_end', periodEnd.toISOString())

    if (error) {
      throw new AppError({
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to fetch usage summary',
        user_message: 'Unable to load usage data.',
        severity: 'MEDIUM',
        retriable: true
      })
    }

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
    const { data: limits, error: limitsError } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('plan', plan.toLowerCase())
      .single()

    if (limitsError || !limits) {
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
 */
export async function getPlanLimits(plan: string): Promise<UsageLimits | null> {
  try {
    const { data: limits, error } = await supabaseAdmin
      .from('usage_limits')
      .select('*')
      .eq('plan', plan.toLowerCase())
      .single()

    if (error || !limits) {
      return null
    }

    return limits as UsageLimits

  } catch (err: any) {
    logger.error('Error fetching plan limits', err, { plan })
    return null
  }
}
