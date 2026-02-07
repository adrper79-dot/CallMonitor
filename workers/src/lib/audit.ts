/**
 * Centralized Audit Log Writer for Cloudflare Workers
 *
 * Provides a DRY, best-effort audit trail for all mutation operations.
 * Writes to the `audit_logs` table with a non-blocking fire-and-forget pattern.
 *
 * Schema:
 *   audit_logs (id, organization_id, user_id, resource_type, resource_id, action, old_value, new_value, created_at)
 *   Note: Interface uses `before`/`after` properties which map to `old_value`/`new_value` DB columns.
 *
 * Usage:
 * ```ts
 * import { writeAuditLog } from '../lib/audit'
 *
 * await writeAuditLog(db, {
 *   organizationId: session.organization_id,
 *   userId: session.user_id,
 *   resourceType: 'calls',
 *   resourceId: call.id,
 *   action: 'call:started',
 *   after: { phone: call.phone_number, status: 'pending' },
 * })
 * ```
 *
 * @see ROADMAP.md — RISK/SCALE: Audit Logs (all mutation logging)
 * @see ARCH_DOCS/CIO_PRODUCTION_REVIEW.md — compliance patterns
 */

import type { DbClient } from './db'
import { logger } from './logger'

/** Audit log entry parameters */
export interface AuditLogEntry {
  organizationId: string
  userId: string
  resourceType: string
  resourceId: string
  action: string
  /** State before mutation (optional — null for creates) */
  before?: Record<string, unknown> | null
  /** State after mutation */
  after?: Record<string, unknown> | null
}

/**
 * Write an audit log entry (non-blocking, best-effort).
 *
 * Uses fire-and-forget pattern — failures are logged but never block
 * the main request flow. This is acceptable because audit logs are
 * supplementary evidence; the primary data mutation has already succeeded.
 *
 * @param db - Database client from getDb(env)
 * @param entry - Audit log entry details
 */
export function writeAuditLog(db: DbClient, entry: AuditLogEntry): void {
  const {
    organizationId,
    userId,
    resourceType,
    resourceId,
    action,
    before = null,
    after = null,
  } = entry

  void db
    .query(
      `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, old_value, new_value, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        organizationId,
        userId,
        resourceType,
        resourceId,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ]
    )
    .catch((err) =>
      logger.warn('Audit log write failed (non-fatal)', {
        action,
        resourceType,
        resourceId,
        error: (err as Error)?.message,
      })
    )
}

/**
 * Pre-built audit actions for common mutations.
 * Use these constants for consistency across route files.
 */
export const AuditAction = {
  // Calls
  CALL_STARTED: 'call:started',
  CALL_ENDED: 'call:ended',
  CALL_OUTCOME_DECLARED: 'call:outcome_declared',
  CALL_OUTCOME_UPDATED: 'call:outcome_updated',
  CALL_DISPOSITION_SET: 'call:disposition_set',

  // Recordings
  RECORDING_ACCESSED: 'recording:accessed',
  RECORDING_DELETED: 'recording:deleted',

  // Billing
  CHECKOUT_CREATED: 'billing:checkout_created',
  SUBSCRIPTION_UPDATED: 'billing:subscription_updated',
  SUBSCRIPTION_CANCELLED: 'billing:subscription_cancelled',
  PAYMENT_RECEIVED: 'billing:payment_received',
  PAYMENT_FAILED: 'billing:payment_failed',
  PAYMENT_METHOD_REMOVED: 'billing:payment_method_removed',

  // Bookings
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_DELETED: 'booking:deleted',

  // Team
  MEMBER_INVITED: 'team:member_invited',
  MEMBER_REMOVED: 'team:member_removed',
  ROLE_CHANGED: 'team:role_changed',

  // Config
  VOICE_CONFIG_UPDATED: 'config:voice_updated',
  AI_CONFIG_UPDATED: 'config:ai_updated',

  // Live Translation
  LIVE_TRANSLATION_STARTED: 'translation:live_started',
  LIVE_TRANSLATION_COMPLETED: 'translation:live_completed',

  // Auth
  SESSION_CREATED: 'auth:login',
  SESSION_REVOKED: 'auth:logout',
} as const
