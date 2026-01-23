/**
 * Monitoring and Alerting Integration
 *
 * Integrates with monitoring services (Sentry, Vercel logs) for error tracking.
 * Per PRODUCTION_READINESS_TASKS.md
 */

import { TrackedError } from './errors/errorTracker'
import * as Sentry from '@sentry/nextjs'

/**
 * Initialize monitoring (Sentry, etc.)
 */
export function initMonitoring() {
  if (process.env.SENTRY_DSN) {
    // Sentry initialized in sentry.*.config.ts
    console.log('[Monitoring] Sentry initialized')
  } else {
    console.warn('[Monitoring] SENTRY_DSN missing - using console only')
  }
}

/**
 * Capture error to monitoring service
 */
export function captureError(error: TrackedError | Error | unknown, context: Record<string, any> = {}) {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  const logData = {
    errorId: (error as any)?.id,
    code: (error as any)?.code,
    message: errorObj.message,
    stack: errorObj.stack,
    severity: (error as any)?.severity ?? 'MEDIUM',
    context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };

  // Structured console output (Vercel indexes these well)
  console.error('[MONITORING] ERROR', JSON.stringify(logData, null, 2));

  // Send to Sentry
  Sentry.withScope(scope => {
    scope.setExtras(context);
    if ('id' in errorObj && errorObj.id) scope.setTag('errorId', String(errorObj.id));
    if ('code' in errorObj && errorObj.code) scope.setTag('errorCode', String(errorObj.code));
    if ('severity' in errorObj && errorObj.severity) scope.setTag('severity', String(errorObj.severity));
    Sentry.captureException(errorObj);
  });
}

/**
 * Capture message/event
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: Record<string, any> = {}) {
  const logData = {
    message,
    level,
    context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };

  const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
  console[consoleMethod]('[MONITORING]', JSON.stringify(logData, null, 2));

  // Send to Sentry
  Sentry.captureMessage(message, level as Sentry.SeverityLevel);
}

/**
 * Set user context for monitoring
 */
export function setUserContext(userId: string, organizationId?: string, email?: string) {
  Sentry.setUser({ id: userId, email, extra: { organizationId } });
}

/**
 * Alert on critical failures
 */
export async function alertCriticalFailure(
  type: 'call_failure' | 'transcription_error' | 'webhook_failure' | 'system_error',
  details: Record<string, any>
) {
  const alert = {
    type,
    severity: 'CRITICAL',
    details,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  console.error('[CRITICAL ALERT]', JSON.stringify(alert, null, 2));

  // Send to Slack webhook
  const slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
  if (slackWebhook) {
    try {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:rotating_light: CRITICAL ALERT: ${type}\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
        }),
      });
    } catch (err) {
      console.error('[ALERT] Failed to send Slack alert', err);
    }
  }

  captureError(new Error(`Critical failure: ${type}`), { ...details, alertType: type });
}

/**
 * Track performance metrics
 */
export function trackMetric(name: string, value: number, tags: Record<string, string> = {}) {
  const metric = {
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };

  console.log('[METRIC]', JSON.stringify(metric, null, 2));
}
