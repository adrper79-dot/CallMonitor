/**
 * Audit Log Failure Monitoring
 * 
 * Per ERROR_HANDLING_REVIEW.md recommendations and ARCH_DOCS standards:
 * - Monitors audit log failures to detect database issues
 * - Alerts when failure rate exceeds threshold
 * - Prevents silent data loss
 * - Follows system of record compliance principle
 * 
 * @see ERROR_HANDLING_REVIEW.md - Priority 4 Recommendation
 * @see ARCH_DOCS/01-CORE/SYSTEM_OF_RECORD_COMPLIANCE.md - Audit requirements
 */

import { logger } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'
import { query } from '@/lib/pgClient'

export interface AuditFailureMetrics {
  failureCount: number
  successCount: number
  lastFailureTime: number | null
  lastAlertTime: number | null
  consecutiveFailures: number
}

/**
 * Audit Log Failure Monitor
 * 
 * Tracks audit log failures and alerts when degradation is detected
 */
class AuditLogMonitor {
  private metrics: AuditFailureMetrics = {
    failureCount: 0,
    successCount: 0,
    lastFailureTime: null,
    lastAlertTime: null,
    consecutiveFailures: 0
  }

  // Configuration
  private readonly ALERT_THRESHOLD = 10
  private readonly ALERT_INTERVAL_MS = 60000 // 1 minute
  private readonly CONSECUTIVE_FAILURE_THRESHOLD = 5
  private readonly METRIC_WINDOW_MS = 300000 // 5 minutes

  // Reset window timer
  private windowTimer: NodeJS.Timeout | null = null

  constructor() {
    // Start metric window reset timer
    this.startWindowTimer()
  }

  /**
   * Record successful audit log write
   */
  recordSuccess(): void {
    this.metrics.successCount++
    this.metrics.consecutiveFailures = 0
  }

  /**
   * Record failed audit log write
   * 
   * @param error - The error that occurred
   * @param context - Additional context about the failure
   */
  recordFailure(error: Error, context?: Record<string, any>): void {
    this.metrics.failureCount++
    this.metrics.lastFailureTime = Date.now()
    this.metrics.consecutiveFailures++

    // Log the failure
    logger.error('Audit log write failed', error, {
      ...context,
      consecutiveFailures: this.metrics.consecutiveFailures,
      failureCount: this.metrics.failureCount
    })

    // Check if we should alert
    this.checkAndAlert(context)
  }

  /**
   * Check if alerting thresholds are met
   */
  private checkAndAlert(context?: Record<string, any>): void {
    const now = Date.now()

    // Check consecutive failures threshold
    if (this.metrics.consecutiveFailures >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      this.sendAlert('CONSECUTIVE_FAILURES', {
        consecutiveFailures: this.metrics.consecutiveFailures,
        threshold: this.CONSECUTIVE_FAILURE_THRESHOLD,
        ...context
      })
      return
    }

    // Check total failure threshold with rate limiting
    if (
      this.metrics.failureCount >= this.ALERT_THRESHOLD &&
      (
        !this.metrics.lastAlertTime ||
        now - this.metrics.lastAlertTime > this.ALERT_INTERVAL_MS
      )
    ) {
      this.sendAlert('HIGH_FAILURE_RATE', {
        failureCount: this.metrics.failureCount,
        successCount: this.metrics.successCount,
        threshold: this.ALERT_THRESHOLD,
        timeWindow: Math.floor((now - (this.metrics.lastAlertTime || now)) / 1000),
        ...context
      })
    }
  }

  /**
   * Send alert for audit log degradation
   */
  private sendAlert(alertType: string, details: Record<string, any>): void {
    this.metrics.lastAlertTime = Date.now()

    // Calculate error rate
    const totalAttempts = this.metrics.failureCount + this.metrics.successCount
    const errorRate = totalAttempts > 0
      ? Math.round((this.metrics.failureCount / totalAttempts) * 100)
      : 0

    const alertData = {
      alertType,
      errorRate,
      failureCount: this.metrics.failureCount,
      successCount: this.metrics.successCount,
      consecutiveFailures: this.metrics.consecutiveFailures,
      ...details
    }

    // Critical alert for consecutive failures
    if (alertType === 'CONSECUTIVE_FAILURES') {
      logger.error('CRITICAL: Audit log consecutive failures detected', undefined, alertData)
    } else {
      logger.error('ALERT: High audit log failure rate detected', undefined, alertData)
    }

    // TODO: Integrate with monitoring service (Sentry, PagerDuty, etc.)
    // Example: await sentry.captureMessage('Audit log degradation', { extra: alertData })
  }

  /**
   * Start metric window timer
   * Resets metrics periodically to track recent failures
   */
  private startWindowTimer(): void {
    if (this.windowTimer) {
      clearInterval(this.windowTimer)
    }

    this.windowTimer = setInterval(() => {
      this.resetMetrics()
    }, this.METRIC_WINDOW_MS)
  }

  /**
   * Reset metrics (called periodically)
   */
  private resetMetrics(): void {
    const hadFailures = this.metrics.failureCount > 0

    if (hadFailures) {
      logger.info('Audit log metrics reset', {
        previousFailureCount: this.metrics.failureCount,
        previousSuccessCount: this.metrics.successCount,
        window: Math.floor(this.METRIC_WINDOW_MS / 1000)
      })
    }

    this.metrics.failureCount = 0
    this.metrics.successCount = 0
    // Don't reset consecutiveFailures - only reset on success
    // Don't reset lastFailureTime - keep for diagnostics
  }

  /**
   * Get current metrics
   */
  getMetrics(): AuditFailureMetrics {
    return { ...this.metrics }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean
    errorRate: number
    consecutiveFailures: number
    recentFailures: number
  } {
    const totalAttempts = this.metrics.failureCount + this.metrics.successCount
    const errorRate = totalAttempts > 0
      ? Math.round((this.metrics.failureCount / totalAttempts) * 100)
      : 0

    const healthy =
      this.metrics.consecutiveFailures < this.CONSECUTIVE_FAILURE_THRESHOLD &&
      this.metrics.failureCount < this.ALERT_THRESHOLD

    return {
      healthy,
      errorRate,
      consecutiveFailures: this.metrics.consecutiveFailures,
      recentFailures: this.metrics.failureCount
    }
  }

  /**
   * Manually reset monitor (for testing)
   */
  reset(): void {
    this.metrics = {
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastAlertTime: null,
      consecutiveFailures: 0
    }
  }

  /**
   * Cleanup (stop timers)
   */
  destroy(): void {
    if (this.windowTimer) {
      clearInterval(this.windowTimer)
      this.windowTimer = null
    }
  }
}

// Singleton instance
export const auditLogMonitor = new AuditLogMonitor()

/**
 * Helper function to wrap audit log writes with monitoring
 * 
 * Usage:
 * ```typescript
 * import { writeAuditLogWithMonitoring } from '@/lib/monitoring/auditLogMonitor'
 * 
 * await writeAuditLogWithMonitoring(async () => {
 *   await query(`INSERT INTO ...`)
 * }, { resource: 'calls', action: 'create' })
 * ```
 */
export async function writeAuditLogWithMonitoring(
  writeFn: () => Promise<any>,
  context?: Record<string, any>
): Promise<void> {
  try {
    await writeFn()
    auditLogMonitor.recordSuccess()
  } catch (error) {
    auditLogMonitor.recordFailure(error as Error, context)
    // Re-throw to maintain existing error handling behavior
    throw error
  }
}

/**
 * Helper function for best-effort audit logging with monitoring
 * 
 * Usage:
 * ```typescript
 * import { bestEffortAuditLog } from '@/lib/monitoring/auditLogMonitor'
 * 
 * await bestEffortAuditLog(async () => {
 *   await query(`INSERT INTO ...`)
 * }, { resource: 'calls', action: 'create' })
 * ```
 */
export async function bestEffortAuditLog(
  writeFn: () => Promise<any>,
  context?: Record<string, any>
): Promise<boolean> {
  try {
    await writeFn()
    auditLogMonitor.recordSuccess()
    return true
  } catch (error) {
    auditLogMonitor.recordFailure(error as Error, context)
    // Don't re-throw - best effort
    return false
  }
}

/**
 * Get audit log health status
 * Can be used in health check endpoints
 */
export function getAuditLogHealth(): ReturnType<AuditLogMonitor['getHealthStatus']> {
  return auditLogMonitor.getHealthStatus()
}

export function getAuditLogMetrics(): AuditFailureMetrics {
  return auditLogMonitor.getMetrics()
}


export interface AuditErrorParams {
  organizationId: string
  actorId: string | null
  systemId: string | null
  resource: string
  resourceId: string | null
  payload: unknown
  actorLabel?: string
}

/**
 * Standardized error audit logging helper
 * 
 * Replaces ad-hoc logging in handlers to ensure consistency and reduce code duplication.
 * automatically handles best-effort logging and monitoring.
 */
export async function logAuditError(params: AuditErrorParams): Promise<void> {
  const {
    organizationId,
    actorId,
    systemId,
    resource,
    resourceId,
    payload,
    actorLabel
  } = params

  await bestEffortAuditLog(
    async () => await query(
      `INSERT INTO audit_logs (id, organization_id, user_id, system_id, resource_type, resource_id, action, actor_type, actor_label, after, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'error', $7, $8, $9, NOW())`,
      [uuidv4(), organizationId, actorId, systemId, resource, resourceId, actorId ? 'human' : 'system', actorLabel || (actorId || 'system'), JSON.stringify(payload)]
    ),
    { resource, resourceId, action: 'error' }
  )
}
