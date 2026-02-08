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

  // Scorecards
  SCORECARD_CREATED: 'scorecard:created',

  // Surveys
  SURVEY_CREATED: 'survey:created',
  SURVEY_DELETED: 'survey:deleted',

  // Campaigns
  CAMPAIGN_CREATED: 'campaign:created',
  CAMPAIGN_UPDATED: 'campaign:updated',
  CAMPAIGN_DELETED: 'campaign:deleted',

  // Retention
  RETENTION_POLICY_UPDATED: 'retention:policy_updated',
  LEGAL_HOLD_CREATED: 'retention:legal_hold_created',
  LEGAL_HOLD_RELEASED: 'retention:legal_hold_released',

  // Mystery Shopper
  SHOPPER_SCRIPT_CREATED: 'shopper:script_created',
  SHOPPER_SCRIPT_UPDATED: 'shopper:script_updated',
  SHOPPER_SCRIPT_DELETED: 'shopper:script_deleted',

  // Teams
  TEAM_CREATED: 'team:created',
  TEAM_UPDATED: 'team:updated',
  TEAM_DELETED: 'team:deleted',
  ORG_SWITCHED: 'team:org_switched',

  // Bond AI
  AI_CONVERSATION_CREATED: 'ai:conversation_created',
  AI_CONVERSATION_DELETED: 'ai:conversation_deleted',
  AI_ALERT_ACKNOWLEDGED: 'ai:alert_acknowledged',
  AI_ALERTS_BULK_UPDATED: 'ai:alerts_bulk_updated',
  AI_ALERT_RULE_CREATED: 'ai:alert_rule_created',
  AI_ALERT_RULE_UPDATED: 'ai:alert_rule_updated',
  AI_ALERT_RULE_DELETED: 'ai:alert_rule_deleted',
  AI_SUMMARIZE_COMPLETED: 'ai:summarize_completed',

  // Organizations
  ORG_CREATED: 'org:created',

  // Audio
  AUDIO_UPLOADED: 'audio:uploaded',
  AUDIO_TRANSCRIPTION_STARTED: 'audio:transcription_started',

  // Reports
  REPORT_CREATED: 'report:created',
  REPORT_SCHEDULE_CREATED: 'report:schedule_created',
  REPORT_SCHEDULE_UPDATED: 'report:schedule_updated',
  REPORT_SCHEDULE_DELETED: 'report:schedule_deleted',

  // Compliance
  COMPLIANCE_VIOLATION_LOGGED: 'compliance:violation_logged',
  COMPLIANCE_VIOLATION_RESOLVED: 'compliance:violation_resolved',

  // Caller ID
  CALLER_ID_VERIFY_INITIATED: 'caller_id:verification_initiated',
  CALLER_ID_VERIFIED: 'caller_id:verified',
  CALLER_ID_DELETED: 'caller_id:deleted',

  // Admin
  AUTH_PROVIDER_UPDATED: 'admin:auth_provider_updated',

  // Reliability
  WEBHOOK_ACTION_TAKEN: 'reliability:webhook_action_taken',
} as const
