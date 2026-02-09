/**
 * Centralized Audit Log Writer for Cloudflare Workers
 *
 * Provides a DRY, best-effort audit trail for all mutation operations.
 * Writes to the `audit_logs` table with a non-blocking fire-and-forget pattern.
 *
 * Schema:
 *   audit_logs (id, organization_id, user_id, resource_type, resource_id, action, old_value, new_value, created_at)
 *   Note: Interface uses `oldValue`/`newValue` properties which map to `old_value`/`new_value` DB columns.
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
 *   newValue: { phone: call.phone_number, status: 'pending' },
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
  oldValue?: Record<string, unknown> | null
  /** State after mutation */
  newValue?: Record<string, unknown> | null
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
    oldValue = null,
    newValue = null,
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
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
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
  CALL_NOTE_CREATED: 'call:note_created',
  CALL_CONFIRMATION_CREATED: 'call:confirmation_created',
  CALL_EMAILED: 'call:emailed',
  CALL_AI_SUMMARY_GENERATED: 'call:ai_summary_generated',

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
  VOICE_TARGET_CREATED: 'voice:target_created',
  VOICE_TARGET_DELETED: 'voice:target_deleted',

  // Live Translation
  LIVE_TRANSLATION_STARTED: 'translation:live_started',
  LIVE_TRANSLATION_COMPLETED: 'translation:live_completed',

  // Auth
  SESSION_CREATED: 'auth:login',
  SESSION_REVOKED: 'auth:logout',
  USER_SIGNUP: 'auth:signup',
  SESSION_REFRESHED: 'auth:session_refreshed',
  PASSWORD_RESET_REQUESTED: 'auth:password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth:password_reset_completed',
  API_KEY_VALIDATED: 'auth:api_key_validated',

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

  // Collections CRM
  COLLECTION_ACCOUNT_CREATED: 'collection:account_created',
  COLLECTION_ACCOUNT_UPDATED: 'collection:account_updated',
  COLLECTION_ACCOUNT_DELETED: 'collection:account_deleted',
  COLLECTION_PAYMENT_CREATED: 'collection:payment_created',
  COLLECTION_TASK_CREATED: 'collection:task_created',
  COLLECTION_TASK_UPDATED: 'collection:task_updated',
  COLLECTION_TASK_DELETED: 'collection:task_deleted',
  COLLECTION_CSV_IMPORTED: 'collection:csv_imported',

  // Sentiment & Objection Detection (v5.0)
  SENTIMENT_ANALYZED: 'sentiment:analyzed',
  SENTIMENT_ALERT_TRIGGERED: 'sentiment:alert_triggered',
  OBJECTION_DETECTED: 'sentiment:objection_detected',

  // Hybrid AI Toggle (v5.0)
  AI_MODE_ACTIVATED: 'ai_mode:activated',
  AI_MODE_HUMAN_TAKEOVER: 'ai_mode:human_takeover',
  AI_SCRIPT_EXECUTED: 'ai_mode:script_executed',

  // Predictive Dialer (v5.0)
  DIALER_QUEUE_STARTED: 'dialer:queue_started',
  DIALER_QUEUE_PAUSED: 'dialer:queue_paused',
  DIALER_CALL_CONNECTED: 'dialer:call_connected',
  DIALER_AMD_DETECTED: 'dialer:amd_detected',

  // IVR Payments (v5.0)
  IVR_FLOW_STARTED: 'ivr:flow_started',
  IVR_PAYMENT_INITIATED: 'ivr:payment_initiated',
  IVR_PAYMENT_COMPLETED: 'ivr:payment_completed',
  IVR_PAYMENT_FAILED: 'ivr:payment_failed',
  IVR_DTMF_COLLECTED: 'ivr:dtmf_collected',

  // Multi-Language (v5.0)
  LANGUAGE_DETECTED: 'language:detected',
  TRANSLATION_CONFIG_UPDATED: 'translation:config_updated',
} as const

