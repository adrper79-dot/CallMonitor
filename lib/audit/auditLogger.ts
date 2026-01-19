/**
 * Audit Logger
 * 
 * Purpose: Centralized audit logging for compliance and security
 * Architecture: System of record compliant with failure monitoring
 * 
 * Per ARCH_DOCS standards:
 * - All critical actions must be audited
 * - Audit failures are monitored and alerted
 * - Structured logging with context
 * - Integration with monitoring system
 * 
 * @see ARCH_DOCS/01-CORE/ERROR_HANDLING_PLAN.txt
 * @see lib/monitoring/auditLogMonitor.ts
 */

import { logger } from '@/lib/logger'
import supabaseAdmin from '@/lib/supabaseAdmin'

// Audit event types
export type AuditEventType =
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_UPDATED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_PROCESSED'
  | 'WEBHOOK_FAILED'
  | 'CAMPAIGN_EXECUTED'
  | 'REPORT_SCHEDULED'
  | 'REPORT_GENERATED'
  | 'CONFIG_UPDATED'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'USER_ACTION'

// Audit log entry structure
export interface AuditLogEntry {
  event_type: AuditEventType
  actor_id?: string // User or system ID
  actor_type?: 'user' | 'system' | 'webhook'
  organization_id?: string
  resource_type?: string // e.g., 'subscription', 'campaign', 'webhook'
  resource_id?: string
  action: string
  status: 'success' | 'failure' | 'pending'
  metadata?: Record<string, any>
  error_message?: string
  ip_address?: string
  user_agent?: string
}

/**
 * Write audit log entry
 * 
 * @param entry - Audit log entry
 * @returns Success status
 */
export async function writeAudit(entry: AuditLogEntry): Promise<boolean> {
  try {
    // Log to console in development
    logger.info('Audit log', {
      event: entry.event_type,
      action: entry.action,
      status: entry.status,
      actor: entry.actor_id,
      resource: entry.resource_id
    })

    // Write to database using correct schema columns
    // Schema: id, organization_id, user_id, system_id, resource_type, resource_id, 
    //         action, before, after, created_at, actor_type, actor_label
    // Extra fields go in the 'after' jsonb column
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        organization_id: entry.organization_id,
        user_id: entry.actor_type === 'user' ? entry.actor_id : null,
        system_id: entry.actor_type === 'system' ? entry.actor_id : null,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        action: entry.action,
        actor_type: entry.actor_type || 'system',
        actor_label: entry.event_type, // Use event_type as actor label
        before: null,
        after: {
          event_type: entry.event_type,
          status: entry.status,
          metadata: entry.metadata || {},
          error_message: entry.error_message,
          ip_address: entry.ip_address,
          user_agent: entry.user_agent
        },
        created_at: new Date().toISOString()
      })

    if (error) {
      // Log the failure but don't throw - audit failures shouldn't break business logic
      logger.error('Failed to write audit log', error, {
        event_type: entry.event_type,
        action: entry.action
      })
      return false
    }

    return true
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Audit log write exception', error as Error, {
      event_type: entry.event_type
    })
    return false
  }
}

/**
 * Write audit log for error/failure events
 * 
 * Convenience wrapper for error audit logs
 * 
 * @param eventType - Type of event
 * @param action - Action that failed
 * @param error - Error that occurred
 * @param context - Additional context
 */
export async function writeAuditError(
  eventType: AuditEventType,
  action: string,
  error: Error,
  context?: Partial<AuditLogEntry>
): Promise<boolean> {
  return writeAudit({
    event_type: eventType,
    action,
    status: 'failure',
    error_message: error.message,
    metadata: {
      error_name: error.name,
      error_stack: error.stack,
      ...context?.metadata
    },
    ...context
  })
}

/**
 * LEGACY COMPATIBILITY: Old audit API
 * These functions maintain backward compatibility with existing code
 * that used the old (table, id, action, metadata) signature
 * 
 * @deprecated Use writeAudit with structured entry instead
 */

/**
 * Legacy writeAudit overload for backward compatibility
 * Supports old signature: writeAudit(table, id, action, metadata)
 */
export async function writeAuditLegacy(
  table: string,
  resourceId: string,
  action: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  // Map old table names to event types
  const eventTypeMap: Record<string, AuditEventType> = {
    organizations: 'USER_ACTION',
    subscriptions: 'SUBSCRIPTION_UPDATED',
    campaigns: 'CAMPAIGN_EXECUTED',
    reports: 'REPORT_GENERATED'
  }

  return writeAudit({
    event_type: eventTypeMap[table] || 'USER_ACTION',
    resource_type: table,
    resource_id: resourceId,
    action,
    status: 'success',
    metadata
  })
}

/**
 * Legacy writeAuditError overload for backward compatibility
 * Supports old signature: writeAuditError(table, id, errorData)
 */
export async function writeAuditErrorLegacy(
  table: string,
  resourceId: string,
  errorData: { message: string; error?: string; [key: string]: any }
): Promise<boolean> {
  return writeAudit({
    event_type: 'USER_ACTION',
    resource_type: table,
    resource_id: resourceId,
    action: 'error',
    status: 'failure',
    error_message: errorData.message,
    metadata: errorData
  })
}

/**
 * Write audit log for Stripe webhook events
 * 
 * @param stripeEventId - Stripe event ID
 * @param eventType - Stripe event type
 * @param status - Processing status
 * @param metadata - Additional metadata
 */
export async function writeStripeWebhookAudit(
  stripeEventId: string,
  eventType: string,
  status: 'success' | 'failure' | 'pending',
  metadata?: Record<string, any>
): Promise<boolean> {
  return writeAudit({
    event_type: 'WEBHOOK_RECEIVED',
    actor_type: 'webhook',
    resource_type: 'stripe_event',
    resource_id: stripeEventId,
    action: `stripe.${eventType}`,
    status,
    metadata: {
      stripe_event_type: eventType,
      ...metadata
    }
  })
}

/**
 * Write audit log for campaign execution
 * 
 * @param campaignId - Campaign ID
 * @param organizationId - Organization ID
 * @param userId - User ID who triggered execution
 * @param status - Execution status
 * @param metadata - Additional metadata
 */
export async function writeCampaignAudit(
  campaignId: string,
  organizationId: string,
  userId: string,
  status: 'success' | 'failure' | 'pending',
  metadata?: Record<string, any>
): Promise<boolean> {
  return writeAudit({
    event_type: 'CAMPAIGN_EXECUTED',
    actor_id: userId,
    actor_type: 'user',
    organization_id: organizationId,
    resource_type: 'campaign',
    resource_id: campaignId,
    action: 'execute',
    status,
    metadata
  })
}

/**
 * Write audit log for report scheduling
 * 
 * @param scheduleId - Schedule ID
 * @param organizationId - Organization ID
 * @param userId - User ID who created schedule
 * @param action - Action performed (create, update, delete)
 * @param metadata - Additional metadata
 */
export async function writeReportScheduleAudit(
  scheduleId: string,
  organizationId: string,
  userId: string,
  action: 'create' | 'update' | 'delete',
  metadata?: Record<string, any>
): Promise<boolean> {
  return writeAudit({
    event_type: 'REPORT_SCHEDULED',
    actor_id: userId,
    actor_type: 'user',
    organization_id: organizationId,
    resource_type: 'report_schedule',
    resource_id: scheduleId,
    action,
    status: 'success',
    metadata
  })
}

/**
 * Write audit log for subscription changes
 * 
 * @param subscriptionId - Subscription ID
 * @param organizationId - Organization ID
 * @param action - Action performed
 * @param status - Action status
 * @param metadata - Additional metadata
 */
export async function writeSubscriptionAudit(
  subscriptionId: string,
  organizationId: string,
  action: 'create' | 'update' | 'cancel',
  status: 'success' | 'failure',
  metadata?: Record<string, any>
): Promise<boolean> {
  const eventTypeMap = {
    create: 'SUBSCRIPTION_CREATED' as const,
    update: 'SUBSCRIPTION_UPDATED' as const,
    cancel: 'SUBSCRIPTION_CANCELLED' as const
  }

  return writeAudit({
    event_type: eventTypeMap[action],
    actor_type: 'system',
    organization_id: organizationId,
    resource_type: 'subscription',
    resource_id: subscriptionId,
    action,
    status,
    metadata
  })
}
