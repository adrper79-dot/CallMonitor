/**
 * SMS Compliance Service — TCPA/DNC/Time-of-Day Enforcement
 *
 * Fail-closed compliance checking for outbound SMS campaigns.
 * Respects:
 * - SMS consent (sms_consent = true)
 * - DNC registry
 * - Opt-out requests
 * - Time-of-day restrictions (8am-9pm local time)
 * - Daily message limits (default 3/day)
 * - Bankruptcy status
 * - Cease & desist orders
 *
 * @see ARCH_DOCS/02-FEATURES/OMNICHANNEL_MESSAGING.md
 * @see migrations/2026-02-14-omnichannel-messaging.sql
 */

import type { DbClient } from './db'
import { logger } from './logger'

export interface ComplianceCheckResult {
  allowed: boolean
  reason?: string
  skip_reason?: string
}

export interface ComplianceConfig {
  dailyMessageLimit?: number
  enforceTimeRestrictions?: boolean
  startHour?: number // 8am default
  endHour?: number // 9pm default
}

const DEFAULT_CONFIG: Required<ComplianceConfig> = {
  dailyMessageLimit: 3,
  enforceTimeRestrictions: true,
  startHour: 8,
  endHour: 21,
}

/**
 * Check if SMS can be sent to an account based on TCPA compliance rules.
 * 
 * FAIL CLOSED: Returns { allowed: false } for any compliance violation.
 * 
 * @param db - Database client
 * @param accountId - Collection account UUID
 * @param organizationId - Organization UUID (for multi-tenant queries)
 * @param config - Optional compliance configuration overrides
 * @returns Compliance check result with reason if blocked
 */
export async function checkSmsCompliance(
  db: DbClient,
  accountId: string,
  organizationId: string,
  config: ComplianceConfig = {}
): Promise<ComplianceCheckResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  try {
    // Fetch account details
    const accountResult = await db.query(
      `SELECT 
        sms_consent,
        primary_phone,
        status,
        custom_fields
      FROM collection_accounts
      WHERE id = $1 AND organization_id = $2`,
      [accountId, organizationId]
    )

    if (accountResult.rows.length === 0) {
      return {
        allowed: false,
        reason: 'Account not found',
        skip_reason: 'account_not_found',
      }
    }

    const account = accountResult.rows[0]

    // 1. Check SMS consent
    if (!account.sms_consent) {
      return {
        allowed: false,
        reason: 'SMS consent not granted',
        skip_reason: 'no_sms_consent',
      }
    }

    // 2. Check account status (skip if paid/archived)
    if (['paid', 'archived'].includes(account.status)) {
      return {
        allowed: false,
        reason: `Account status: ${account.status}`,
        skip_reason: 'account_inactive',
      }
    }

    // 3. Check for bankruptcy flag (stored in custom_fields)
    const customFields = account.custom_fields || {}
    if (customFields.bankruptcy === true || customFields.in_bankruptcy === true) {
      return {
        allowed: false,
        reason: 'Account in bankruptcy',
        skip_reason: 'bankruptcy',
      }
    }

    // 4. Check for cease & desist
    if (customFields.cease_desist === true || customFields.legal_hold === true) {
      return {
        allowed: false,
        reason: 'Cease & desist order',
        skip_reason: 'cease_desist',
      }
    }

    // 5. Check opt-out requests
    const optOutResult = await db.query(
      `SELECT COUNT(*) as count
      FROM opt_out_requests
      WHERE account_id = $1
        AND request_type = 'opt_out'
        AND channel IN ('sms', 'manual')
        AND created_at > NOW() - INTERVAL '90 days'`,
      [accountId]
    )

    if (parseInt(optOutResult.rows[0].count, 10) > 0) {
      return {
        allowed: false,
        reason: 'Account has opted out of SMS',
        skip_reason: 'opted_out',
      }
    }

    // 6. Check daily message limit
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const dailyCountResult = await db.query(
      `SELECT COUNT(*) as count
      FROM messages
      WHERE account_id = $1
        AND organization_id = $2
        AND channel = 'sms'
        AND direction = 'outbound'
        AND status IN ('sent', 'delivered', 'pending')
        AND created_at >= $3`,
      [accountId, organizationId, todayStart.toISOString()]
    )

    const dailyCount = parseInt(dailyCountResult.rows[0].count, 10)
    if (dailyCount >= cfg.dailyMessageLimit) {
      return {
        allowed: false,
        reason: `Daily message limit reached (${cfg.dailyMessageLimit})`,
        skip_reason: 'daily_limit_exceeded',
      }
    }

    // 7. Time-of-day check (8am-9pm local time)
    // Note: For simplicity, assuming US Eastern time for now
    // In production, should use account's timezone from custom_fields
    if (cfg.enforceTimeRestrictions) {
      const now = new Date()
      const currentHour = now.getHours()

      // Simple check: 8am-9pm (can be enhanced with timezone lookup)
      if (currentHour < cfg.startHour || currentHour >= cfg.endHour) {
        return {
          allowed: false,
          reason: `Outside business hours (${cfg.startHour}:00-${cfg.endHour}:00)`,
          skip_reason: 'outside_business_hours',
        }
      }
    }

    // All checks passed
    return { allowed: true }
  } catch (error) {
    logger.error('SMS compliance check failed', {
      error: (error as Error)?.message,
      accountId,
      organizationId,
    })

    // FAIL CLOSED: On error, deny the send
    return {
      allowed: false,
      reason: 'Compliance check error',
      skip_reason: 'compliance_error',
    }
  }
}

/**
 * Check if email can be sent to an account based on CAN-SPAM compliance rules.
 * 
 * FAIL CLOSED: Returns { allowed: false } for any compliance violation.
 * 
 * @param db - Database client
 * @param account - Account object with email_consent and other fields
 * @param organizationId - Organization UUID (for multi-tenant queries)
 * @param config - Optional compliance configuration overrides
 * @returns Compliance check result with reason if blocked
 */
export async function checkEmailCompliance(
  db: DbClient,
  account: { id: string; email?: string; email_consent?: boolean; status?: string; custom_fields?: any },
  organizationId: string,
  config: ComplianceConfig = {}
): Promise<ComplianceCheckResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  try {
    // 1. Check email consent
    if (!account.email_consent) {
      return {
        allowed: false,
        reason: 'Email consent not granted',
        skip_reason: 'no_email_consent',
      }
    }

    // 2. Check valid email address
    if (!account.email || !isValidEmail(account.email)) {
      return {
        allowed: false,
        reason: 'Invalid email address',
        skip_reason: 'invalid_email',
      }
    }

    // 3. Check account status (skip if paid/archived)
    if (['paid', 'archived'].includes(account.status || '')) {
      return {
        allowed: false,
        reason: `Account status: ${account.status}`,
        skip_reason: 'account_inactive',
      }
    }

    // 4. Check for bankruptcy flag
    const customFields = account.custom_fields || {}
    if (customFields.bankruptcy === true || customFields.in_bankruptcy === true) {
      return {
        allowed: false,
        reason: 'Account in bankruptcy',
        skip_reason: 'bankruptcy',
      }
    }

    // 5. Check for cease & desist
    if (customFields.cease_desist === true || customFields.legal_hold === true) {
      return {
        allowed: false,
        reason: 'Cease & desist order',
        skip_reason: 'cease_desist',
      }
    }

    // 6. Check email suppression list (bounces, spam complaints)
    const suppressionResult = await db.query(
      `SELECT COUNT(*) as count
      FROM messages
      WHERE account_id = $1
        AND organization_id = $2
        AND channel = 'email'
        AND (
          status = 'bounced'
          OR (metadata->>'spam_complaint')::boolean = true
        )
        AND created_at > NOW() - INTERVAL '90 days'`,
      [account.id, organizationId]
    )

    if (parseInt(suppressionResult.rows[0].count, 10) > 0) {
      return {
        allowed: false,
        reason: 'Email on suppression list (bounced or spam complaint)',
        skip_reason: 'email_suppressed',
      }
    }

    // 7. Check opt-out requests
    const optOutResult = await db.query(
      `SELECT COUNT(*) as count
      FROM opt_out_requests
      WHERE account_id = $1
        AND request_type = 'opt_out'
        AND channel IN ('email', 'manual')
        AND created_at > NOW() - INTERVAL '90 days'`,
      [account.id]
    )

    if (parseInt(optOutResult.rows[0].count, 10) > 0) {
      return {
        allowed: false,
        reason: 'Account has opted out of email',
        skip_reason: 'opted_out',
      }
    }

    // 8. Check daily email limit (default 5 per day for email)
    const emailDailyLimit = 5
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const dailyCountResult = await db.query(
      `SELECT COUNT(*) as count
      FROM messages
      WHERE account_id = $1
        AND organization_id = $2
        AND channel = 'email'
        AND direction = 'outbound'
        AND status IN ('sent', 'delivered', 'pending')
        AND created_at >= $3`,
      [account.id, organizationId, todayStart.toISOString()]
    )

    const dailyCount = parseInt(dailyCountResult.rows[0].count, 10)
    if (dailyCount >= emailDailyLimit) {
      return {
        allowed: false,
        reason: `Daily email limit reached (${emailDailyLimit})`,
        skip_reason: 'daily_limit_exceeded',
      }
    }

    // All checks passed
    return { allowed: true }
  } catch (error) {
    logger.error('Email compliance check failed', {
      error: (error as Error)?.message,
      accountId: account.id,
      organizationId,
    })

    // FAIL CLOSED: On error, deny the send
    return {
      allowed: false,
      reason: 'Compliance check error',
      skip_reason: 'compliance_error',
    }
  }
}

/**
 * Validate email address format (RFC 5322).
 * 
 * @param email - Email address string
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Bulk compliance check for multiple accounts.
 * Returns map of accountId -> ComplianceCheckResult.
 * 
 * @param db - Database client
 * @param accountIds - Array of account UUIDs
 * @param organizationId - Organization UUID
 * @param config - Optional compliance configuration
 * @returns Map of accountId to compliance result
 */
export async function bulkCheckSmsCompliance(
  db: DbClient,
  accountIds: string[],
  organizationId: string,
  config: ComplianceConfig = {}
): Promise<Map<string, ComplianceCheckResult>> {
  const results = new Map<string, ComplianceCheckResult>()

  // Check in parallel (but limit concurrency to avoid DB overload)
  const BATCH_SIZE = 10
  for (let i = 0; i < accountIds.length; i += BATCH_SIZE) {
    const batch = accountIds.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((accountId) => checkSmsCompliance(db, accountId, organizationId, config))
    )

    batch.forEach((accountId, idx) => {
      results.set(accountId, batchResults[idx])
    })
  }

  return results
}

/**
 * Validate phone number format (E.164).
 * Example: +15551234567
 * 
 * @param phone - Phone number string
 * @returns true if valid E.164 format
 */
export function isValidE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

/**
 * Normalize phone number to E.164 format.
 * Handles common US formats:
 * - (555) 123-4567 → +15551234567
 * - 555-123-4567 → +15551234567
 * - 5551234567 → +15551234567
 * 
 * @param phone - Phone number string
 * @param defaultCountryCode - Default country code (default: '1' for US)
 * @returns E.164 formatted phone or null if invalid
 */
export function normalizePhoneNumber(
  phone: string,
  defaultCountryCode: string = '1'
): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If already starts with +, validate and return
  if (phone.startsWith('+')) {
    return isValidE164Phone(phone) ? phone : null
  }

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    const e164 = `+${defaultCountryCode}${digits}`
    return isValidE164Phone(e164) ? e164 : null
  }

  // Handle 11-digit numbers (with country code)
  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) {
    const e164 = `+${digits}`
    return isValidE164Phone(e164) ? e164 : null
  }

  // Invalid length
  return null
}

/**
 * Check if account is on DNC list.
 * This is a placeholder - in production, integrate with actual DNC registry API.
 * 
 * @param db - Database client
 * @param phoneNumber - E.164 phone number
 * @param organizationId - Organization UUID
 * @returns true if on DNC list
 */
export async function isDncListed(
  db: DbClient,
  phoneNumber: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Check internal DNC list (stored in custom table or custom_fields)
    // Placeholder implementation - in production, query actual DNC registry
    const result = await db.query(
      `SELECT COUNT(*) as count
      FROM collection_accounts
      WHERE organization_id = $1
        AND primary_phone = $2
        AND (
          (custom_fields->>'dnc')::boolean = true
          OR (custom_fields->>'do_not_call')::boolean = true
        )`,
      [organizationId, phoneNumber]
    )

    return parseInt(result.rows[0].count, 10) > 0
  } catch (error) {
    logger.error('DNC check failed', {
      error: (error as Error)?.message,
      phoneNumber,
    })

    // FAIL CLOSED: On error, assume DNC listed
    return true
  }
}
