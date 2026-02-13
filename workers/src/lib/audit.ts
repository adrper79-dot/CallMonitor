/**
 * Centralized Audit Log Writer for Cloudflare Workers
 *
 * C-2 hardening: Resilient write with KV dead-letter buffer.
 * Primary path: Direct DB INSERT (fast, synchronous in request).
 * Fallback path: If DB write fails, the entry is buffered to KV with a
 * `audit-dlq:` prefix so the hourly cron can flush them to the DB.
 *
 * This ensures zero audit log loss — even if the DB is temporarily unreachable,
 * entries are persisted in KV and retried on the next cron cycle.
 *
 * Schema:
 *   audit_logs (id, organization_id, user_id, resource_type, resource_id, action, old_value, new_value, created_at)
 *   Note: Interface uses `oldValue`/`newValue` properties which map to `old_value`/`new_value` DB columns.
 *
 * Usage:
 * ```ts
 * import { writeAuditLog } from '../lib/audit'
 *
 * writeAuditLog(db, {
 *   organizationId: session.organization_id,
 *   userId: session.user_id,
 *   resourceType: 'calls',
 *   resourceId: call.id,
 *   action: 'call:started',
 *   newValue: { phone: call.phone_number, status: 'pending' },
 * }, c.env.KV)
 * ```
 *
 * @see ROADMAP.md — RISK/SCALE: Audit Logs (all mutation logging)
 * @see ARCH_DOCS/CIO_PRODUCTION_REVIEW.md — compliance patterns
 * @see ARCH_DOCS/PRE_PRODUCTION_FORENSIC_AUDIT.md — C-2 fix
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
 * NOTE: audit_logs columns (organization_id, user_id, resource_id) are UUID type.
 * Non-UUID sentinel strings like 'signup', 'none', 'password_reset' are stored
 * in the metadata JSONB column instead, with the UUID column set to NULL.
 *
 * @param db - Database client from getDb(env)
 * @param entry - Audit log entry details
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  return UUID_REGEX.test(value) ? value : null
}

export function writeAuditLog(db: DbClient, entry: AuditLogEntry, kv?: KVNamespace): void {
  const {
    organizationId,
    userId,
    resourceType,
    resourceId,
    action,
    oldValue = null,
    newValue = null,
  } = entry

  const params = [
    toUuidOrNull(organizationId),
    toUuidOrNull(userId),
    resourceType,
    toUuidOrNull(resourceId),
    action,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    // Store non-UUID sentinel values in metadata for traceability
    (!UUID_REGEX.test(organizationId) || !UUID_REGEX.test(userId) || !UUID_REGEX.test(resourceId))
      ? JSON.stringify({ _org_label: organizationId, _user_label: userId, _resource_label: resourceId })
      : null,
  ]

  void db
    .query(
      `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, old_value, new_value, metadata, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, NOW())`,
      params
    )
    .catch(async (err) => {
      logger.warn('Audit log DB write failed — buffering to KV DLQ', {
        action,
        resourceType,
        resourceId,
        error: (err as Error)?.message,
      })

      // C-2: Buffer failed entry to KV dead-letter queue for cron retry
      if (kv) {
        try {
          const dlqKey = `audit-dlq:${Date.now()}-${crypto.randomUUID()}`
          await kv.put(dlqKey, JSON.stringify({
            organizationId,
            userId,
            resourceType,
            resourceId,
            action,
            oldValue,
            newValue,
            metadata: params[7] ? JSON.parse(params[7] as string) : null,
            failed_at: new Date().toISOString(),
          }), { expirationTtl: 7 * 24 * 60 * 60 }) // 7-day TTL
        } catch (kvErr) {
          logger.error('Audit log KV DLQ write also failed — entry lost', {
            action,
            resourceType,
            error: (kvErr as Error)?.message,
          })
        }
      }
    })
}

/**
 * Flush audit DLQ entries from KV back into the database.
 * Called by the hourly cron job. Processes up to `batchSize` entries per run
 * to avoid overwhelming the DB or hitting Workers CPU limits.
 *
 * @param env - Cloudflare Workers environment bindings
 * @param batchSize - Maximum entries to process per flush (default 50)
 * @returns Count of successfully flushed and failed entries
 */
export async function flushAuditDlq(
  env: { KV: KVNamespace; NEON_PG_CONN?: string; HYPERDRIVE?: Hyperdrive },
  batchSize = 50
): Promise<{ flushed: number; failed: number }> {
  const { getDb: getDbFn } = await import('./db')
  let flushed = 0
  let failed = 0

  // List all audit DLQ keys
  const list = await env.KV.list({ prefix: 'audit-dlq:', limit: batchSize })

  if (list.keys.length === 0) return { flushed: 0, failed: 0 }

  const db = getDbFn(env as any)
  try {
    for (const key of list.keys) {
      try {
        const raw = await env.KV.get(key.name)
        if (!raw) {
          await env.KV.delete(key.name)
          continue
        }

        const entry = JSON.parse(raw) as AuditLogEntry & { metadata?: any; failed_at?: string }

        await db.query(
          `INSERT INTO audit_logs (organization_id, user_id, resource_type, resource_id, action, old_value, new_value, metadata, created_at)
           VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))`,
          [
            toUuidOrNull(entry.organizationId),
            toUuidOrNull(entry.userId),
            entry.resourceType,
            toUuidOrNull(entry.resourceId),
            entry.action,
            entry.oldValue ? JSON.stringify(entry.oldValue) : null,
            entry.newValue ? JSON.stringify(entry.newValue) : null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.failed_at || null,
          ]
        )

        // Successfully flushed — remove from DLQ
        await env.KV.delete(key.name)
        flushed++
      } catch (err) {
        failed++
        logger.warn('Audit DLQ flush: entry failed, will retry next cycle', {
          key: key.name,
          error: (err as Error)?.message,
        })
      }
    }
  } finally {
    await db.end()
  }

  return { flushed, failed }
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
  CALL_TRANSFERRED: 'call:transferred',

  // Recordings
  RECORDING_ACCESSED: 'recording:accessed',
  RECORDING_DELETED: 'recording:deleted',

  // Billing
  CHECKOUT_CREATED: 'billing:checkout_created',
  SUBSCRIPTION_UPDATED: 'billing:subscription_updated',
  SUBSCRIPTION_CANCELLED: 'billing:subscription_cancelled',
  PAYMENT_RECEIVED: 'billing:payment_received',
  PAYMENT_FAILED: 'billing:payment_failed',
  PAYMENT_METHOD_ADDED: 'billing:payment_method_added',
  PAYMENT_METHOD_REMOVED: 'billing:payment_method_removed',
  BILLING_DATA_SYNC: 'billing:data_sync',

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
  ORGANIZATION_UPDATED: 'org:updated',
  ONBOARDING_COMPLETED: 'org:onboarding_completed',

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
  WEBHOOK_CREATED: 'webhook:created',
  WEBHOOK_UPDATED: 'webhook:updated',
  WEBHOOK_DELETED: 'webhook:deleted',

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
  DIALER_QUEUE_STOPPED: 'dialer:queue_stopped',
  DIALER_CALL_CONNECTED: 'dialer:call_connected',
  DIALER_AMD_DETECTED: 'dialer:amd_detected',
  DIALER_AGENT_STATUS_UPDATED: 'dialer:agent_status_updated',

  // IVR Payments (v5.0)
  IVR_FLOW_STARTED: 'ivr:flow_started',
  IVR_PAYMENT_INITIATED: 'ivr:payment_initiated',
  IVR_PAYMENT_COMPLETED: 'ivr:payment_completed',
  IVR_PAYMENT_FAILED: 'ivr:payment_failed',
  IVR_DTMF_COLLECTED: 'ivr:dtmf_collected',

  // Multi-Language (v5.0)
  LANGUAGE_DETECTED: 'language:detected',
  TRANSLATION_CONFIG_UPDATED: 'translation:config_updated',

  // Call Bridging (v5.0)
  CALL_BRIDGED: 'call:bridged',

  // AI LLM Usage (BL-093)
  AI_CHAT_COMPLETED: 'ai:chat_completed',
  AI_ANALYZE_COMPLETED: 'ai:analyze_completed',
  AI_TTS_GENERATED: 'ai:tts_generated',

  // Pre-Dial Compliance (v5.1)
  COMPLIANCE_PREDIAL_PASSED: 'compliance:predial_passed',
  COMPLIANCE_PREDIAL_BLOCKED: 'compliance:predial_blocked',
  COMPLIANCE_DNC_BLOCKED: 'compliance:dnc_blocked',
  COMPLIANCE_DISCLOSURE_LOGGED: 'compliance:disclosure_logged',
  COMPLIANCE_CONSENT_CAPTURED: 'compliance:consent_captured',
  COMPLIANCE_GUIDE_VIEWED: 'compliance:guide_viewed',

  // Scheduled Payments / Dunning (v5.1)
  SCHEDULED_PAYMENT_PROCESSED: 'payment:scheduled_processed',
  SCHEDULED_PAYMENT_FAILED: 'payment:scheduled_failed',
  DUNNING_ESCALATED: 'dunning:escalated',
  PAYMENT_PLAN_CREATED: 'payment:plan_created',
  PAYMENT_PLAN_DEFAULTED: 'payment:plan_defaulted',

  // Audio Intelligence (v5.2)
  ENTITY_DETECTED: 'audio:entity_detected',
  CONTENT_SAFETY_FLAGGED: 'audio:content_safety_flagged',
  TASK_AUTO_CREATED: 'task:auto_created',

  // Productivity Features (v5.2)
  LIKELIHOOD_SCORED: 'collections:likelihood_scored',
  PREVENTION_TASK_CREATED: 'collections:prevention_task_created',
  NOTE_TEMPLATE_CREATED: 'note_template:created',
  NOTE_TEMPLATE_UPDATED: 'note_template:updated',
  NOTE_TEMPLATE_DELETED: 'note_template:deleted',
  OBJECTION_REBUTTAL_CREATED: 'objection_rebuttal:created',
  OBJECTION_REBUTTAL_UPDATED: 'objection_rebuttal:updated',
  OBJECTION_REBUTTAL_DELETED: 'objection_rebuttal:deleted',

  // Feature Flags (admin management)
  FEATURE_FLAG_CREATED: 'feature_flag:created',
  FEATURE_FLAG_UPDATED: 'feature_flag:updated',
  FEATURE_FLAG_DELETED: 'feature_flag:deleted',

  // DNC List Management
  DNC_ENTRY_CREATED: 'dnc:created',
  DNC_ENTRY_DELETED: 'dnc:deleted',

  // CRM Integration
  CRM_INTEGRATION_CREATED: 'crm:integration_created',
  CRM_INTEGRATION_UPDATED: 'crm:integration_updated',
  CRM_INTEGRATION_DELETED: 'crm:integration_deleted',
  CRM_OBJECT_LINKED: 'crm:object_linked',
  CRM_OBJECT_UPDATED: 'crm:object_updated',
  CRM_OBJECT_UNLINKED: 'crm:object_unlinked',
} as const

