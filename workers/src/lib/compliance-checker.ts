/**
 * Pre-Dial Compliance Checker
 *
 * MUST run before EVERY outbound contact attempt.
 * Enforces TCPA, FDCPA/Reg F, and org-specific compliance rules.
 *
 * Checks (in order):
 *   1. Account-level blocks: DNC flag, cease & desist, bankruptcy
 *   2. DNC list lookup (org-wide phone registry)
 *   3. Consent status verification
 *   4. Time-of-day enforcement (8am-9pm debtor local time)
 *   5. Reg F 7-in-7 frequency cap (max 7 contact attempts per 7-day period)
 *
 * Every check result (pass or fail) is logged to compliance_events table.
 * Failed checks return { allowed: false } and the reason — caller MUST NOT proceed.
 *
 * @see ARCH_DOCS/01-CORE/AI_ROLE_POLICY.md — AI operates as notary, not actor
 */

import type { DbClient } from './db'
import { logger } from './logger'

export interface ComplianceCheck {
  allowed: boolean
  checks: {
    dnc: boolean
    consent: boolean
    cease_and_desist: boolean
    bankruptcy: boolean
    do_not_call: boolean
    contact_frequency: boolean
    time_of_day: boolean
    legal_hold: boolean
  }
  reason: string | null
  blockedBy: string | null
}

interface ComplianceContext {
  phoneNumber: string
  organizationId: string
  accountId?: string | null
}

/**
 * Determine if calling a phone number is allowed based on all compliance rules.
 * Logs every check to compliance_events for audit trail.
 *
 * @returns ComplianceCheck — { allowed, checks, reason, blockedBy }
 */
export async function checkPreDialCompliance(
  db: DbClient,
  ctx: ComplianceContext
): Promise<ComplianceCheck> {
  const { phoneNumber, organizationId, accountId } = ctx

  const checks = {
    dnc: true,
    consent: true,
    cease_and_desist: true,
    bankruptcy: true,
    do_not_call: true,
    contact_frequency: true,
    time_of_day: true,
    legal_hold: true,
  }

  let blockedBy: string | null = null
  let reason: string | null = null

  try {
    // ── 1. Account-level flags (if we have an account) ──────────────
    if (accountId) {
      const accountResult = await db.query(
        `SELECT do_not_call, cease_and_desist, bankruptcy_flag, consent_status, timezone
         FROM collection_accounts
         WHERE id = $1 AND organization_id = $2`,
        [accountId, organizationId]
      )

      if (accountResult.rows.length > 0) {
        const acct = accountResult.rows[0]

        if (acct.do_not_call) {
          checks.do_not_call = false
          blockedBy = 'do_not_call'
          reason = 'Account flagged as Do Not Call'
        }

        if (acct.cease_and_desist) {
          checks.cease_and_desist = false
          blockedBy = blockedBy || 'cease_and_desist'
          reason = reason || 'Account has cease and desist order'
        }

        if (acct.bankruptcy_flag) {
          checks.bankruptcy = false
          blockedBy = blockedBy || 'bankruptcy'
          reason = reason || 'Account flagged for bankruptcy'
        }

        if (acct.consent_status === 'revoked') {
          checks.consent = false
          blockedBy = blockedBy || 'consent_revoked'
          reason = reason || 'Contact consent has been revoked'
        }

        // ── Legal hold check (blocks all contact while litigation pending) ──
        const legalHoldResult = await db.query(
          `SELECT id FROM legal_holds
           WHERE organization_id = $1
             AND (account_id = $2 OR applies_to_all = true)
             AND status = 'active'
           LIMIT 1`,
          [organizationId, accountId]
        )
        if (legalHoldResult.rows.length > 0) {
          checks.legal_hold = false
          blockedBy = blockedBy || 'legal_hold'
          reason = reason || 'Active legal hold on account — contact prohibited'
        }

        // ── 4. Time-of-day enforcement (8am-9pm debtor local time) ──
        const timezone = acct.timezone || 'America/New_York'
        if (!isAllowedCallingTime(timezone)) {
          checks.time_of_day = false
          blockedBy = blockedBy || 'time_of_day'
          reason = reason || `Outside allowed calling hours (8am-9pm ${timezone})`
        }

        // ── 5. Reg F 7-in-7 frequency cap ──────────────────────────
        // calls table has no account_id — count by destination phone number
        const freqResult = await db.query(
          `SELECT COUNT(*) AS contact_count
           FROM calls
           WHERE organization_id = $1
             AND to_number = $2
             AND direction = 'outbound'
             AND created_at > NOW() - INTERVAL '7 days'`,
          [organizationId, phoneNumber]
        )

        const contactCount = parseInt(freqResult.rows[0]?.contact_count || '0', 10)
        if (contactCount >= 7) {
          checks.contact_frequency = false
          blockedBy = blockedBy || 'frequency_7in7'
          reason = reason || `Reg F 7-in-7 limit reached (${contactCount} contacts in last 7 days)`
        }
      }
    } else {
      // No account — look up by phone number for account-level checks
      const phoneAccountResult = await db.query(
        `SELECT id, do_not_call, cease_and_desist, bankruptcy_flag, consent_status, timezone
         FROM collection_accounts
         WHERE organization_id = $1
           AND (primary_phone = $2 OR secondary_phone = $2)
           AND is_deleted = false
         LIMIT 1`,
        [organizationId, phoneNumber]
      )

      if (phoneAccountResult.rows.length > 0) {
        const acct = phoneAccountResult.rows[0]

        if (acct.do_not_call) {
          checks.do_not_call = false
          blockedBy = 'do_not_call'
          reason = 'Account flagged as Do Not Call'
        }

        if (acct.cease_and_desist) {
          checks.cease_and_desist = false
          blockedBy = blockedBy || 'cease_and_desist'
          reason = reason || 'Account has cease and desist order'
        }

        if (acct.bankruptcy_flag) {
          checks.bankruptcy = false
          blockedBy = blockedBy || 'bankruptcy'
          reason = reason || 'Account flagged for bankruptcy'
        }

        if (acct.consent_status === 'revoked') {
          checks.consent = false
          blockedBy = blockedBy || 'consent_revoked'
          reason = reason || 'Contact consent has been revoked'
        }

        // ── Legal hold check (blocks all contact while litigation pending) ──
        const legalHoldPhoneResult = await db.query(
          `SELECT id FROM legal_holds
           WHERE organization_id = $1
             AND (account_id = $2 OR applies_to_all = true)
             AND status = 'active'
           LIMIT 1`,
          [organizationId, acct.id]
        )
        if (legalHoldPhoneResult.rows.length > 0) {
          checks.legal_hold = false
          blockedBy = blockedBy || 'legal_hold'
          reason = reason || 'Active legal hold on account — contact prohibited'
        }

        // Time-of-day check using looked-up account
        const timezone = acct.timezone || 'America/New_York'
        if (!isAllowedCallingTime(timezone)) {
          checks.time_of_day = false
          blockedBy = blockedBy || 'time_of_day'
          reason = reason || `Outside allowed calling hours (8am-9pm ${timezone})`
        }

        // 7-in-7 check using resolved account ID
        // calls table has no account_id — count by destination phone number
        const freqResult = await db.query(
          `SELECT COUNT(*) AS contact_count
           FROM calls
           WHERE organization_id = $1
             AND to_number = $2
             AND direction = 'outbound'
             AND created_at > NOW() - INTERVAL '7 days'`,
          [organizationId, phoneNumber]
        )

        const contactCount = parseInt(freqResult.rows[0]?.contact_count || '0', 10)
        if (contactCount >= 7) {
          checks.contact_frequency = false
          blockedBy = blockedBy || 'frequency_7in7'
          reason =
            reason || `Reg F 7-in-7 limit reached (${contactCount} contacts in last 7 days)`
        }
      }
    }

    // ── 2. DNC list lookup (org-wide phone registry) ────────────────
    const dncResult = await db.query(
      `SELECT id, reason FROM dnc_lists
       WHERE organization_id = $1 AND phone_number = $2
       LIMIT 1`,
      [organizationId, phoneNumber]
    )

    if (dncResult.rows.length > 0) {
      checks.dnc = false
      blockedBy = blockedBy || 'dnc_list'
      reason = reason || `Phone number on DNC list: ${dncResult.rows[0].reason || 'no reason given'}`
    }

    // ── Determine final result ──────────────────────────────────────
    const allowed = Object.values(checks).every((v) => v === true)

    // ── Log compliance event (always, pass or fail) ─────────────────
    // Mask phone number for PII protection in stored logs
    const maskedPhone = phoneNumber.length >= 4
      ? '***-***-' + phoneNumber.slice(-4)
      : '****'

    await db
      .query(
        `INSERT INTO compliance_events
         (organization_id, account_id, event_type, severity, passed, details)
         VALUES ($1, $2, 'pre_dial_check', $3, $4, $5::jsonb)`,
        [
          organizationId,
          accountId || null,
          allowed ? 'info' : 'block',
          allowed,
          JSON.stringify({
            phone_number: maskedPhone,
            checks,
            blocked_by: blockedBy,
            reason,
          }),
        ]
      )
      .catch((err) =>
        logger.warn('Failed to log compliance event (non-fatal)', {
          error: (err as Error)?.message,
        })
      )

    return { allowed, checks, reason, blockedBy }
  } catch (error) {
    // Compliance check failure = FAIL CLOSED (block the call)
    logger.error('Pre-dial compliance check error — failing closed', {
      error: (error as Error)?.message,
      phoneNumber,
      organizationId,
    })

    return {
      allowed: false,
      checks: {
        dnc: false,
        consent: false,
        cease_and_desist: false,
        bankruptcy: false,
        do_not_call: false,
        contact_frequency: false,
        time_of_day: false,
        legal_hold: false,
      },
      reason: 'Compliance check failed — blocking call as safety measure',
      blockedBy: 'system_error',
    }
  }
}

/**
 * Check if current time is within allowed calling hours (8am-9pm)
 * in the debtor's local timezone.
 *
 * Uses Intl.DateTimeFormat for timezone-aware hour calculation.
 * Falls back to Eastern Time if timezone is invalid.
 */
function isAllowedCallingTime(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const localHour = parseInt(formatter.format(new Date()), 10)
    return localHour >= 8 && localHour < 21 // 8am-9pm
  } catch {
    // Invalid timezone — use Eastern Time as fallback
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      })
      const localHour = parseInt(formatter.format(new Date()), 10)
      return localHour >= 8 && localHour < 21
    } catch {
      // Total failure — block to be safe (fail closed)
      return false
    }
  }
}

/**
 * Log a disclosure event (mini-Miranda, recording notice, etc.) to compliance_events.
 * Called from webhook handlers when disclosures are played during calls.
 */
export async function logDisclosureEvent(
  db: DbClient,
  params: {
    organizationId: string
    callId: string
    accountId?: string | null
    disclosureType: string // 'mini_miranda', 'recording_notice', 'ai_translation', 'qa_evaluation'
    disclosureText: string
  }
): Promise<void> {
  const { organizationId, callId, accountId, disclosureType, disclosureText } = params

  // Write to compliance_events
  await db
    .query(
      `INSERT INTO compliance_events
       (organization_id, account_id, call_id, event_type, severity, passed, details)
       VALUES ($1, $2, $3, 'disclosure_given', 'info', true, $4::jsonb)`,
      [
        organizationId,
        accountId || null,
        callId,
        JSON.stringify({
          disclosure_type: disclosureType,
          disclosure_text: disclosureText,
          timestamp: new Date().toISOString(),
        }),
      ]
    )
    .catch((err) =>
      logger.warn('Failed to log disclosure event (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

  // Also write to disclosure_logs table (existing, currently empty)
  await db
    .query(
      `INSERT INTO disclosure_logs
       (organization_id, call_id, disclosure_type, disclosure_text, disclosed_at, disclosure_method)
       VALUES ($1, $2, $3, $4, NOW(), 'automated')`,
      [organizationId, callId, disclosureType, disclosureText]
    )
    .catch((err) =>
      logger.warn('Failed to log to disclosure_logs (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

  // Update calls table disclosure columns
  await db
    .query(
      `UPDATE calls
       SET disclosure_type = $1,
           disclosure_given = true,
           disclosure_timestamp = NOW(),
           disclosure_text = $2
       WHERE id = $3 AND organization_id = $4`,
      [disclosureType, disclosureText, callId, organizationId]
    )
    .catch((err) =>
      logger.warn('Failed to update calls disclosure columns (non-fatal)', {
        error: (err as Error)?.message,
      })
    )
}

/**
 * Log a consent capture event.
 * Called when consent is obtained during a call (e.g., recording consent).
 */
export async function logConsentEvent(
  db: DbClient,
  params: {
    organizationId: string
    callId: string
    accountId?: string | null
    consentMethod: string // 'verbal', 'ivr_keypress', 'written', 'electronic'
    consentAudioOffsetMs?: number
  }
): Promise<void> {
  const { organizationId, callId, accountId, consentMethod, consentAudioOffsetMs } = params

  // Update calls table consent columns
  await db
    .query(
      `UPDATE calls
       SET consent_method = $1,
           consent_timestamp = NOW(),
           consent_audio_offset_ms = $2
       WHERE id = $3 AND organization_id = $4`,
      [consentMethod, consentAudioOffsetMs || null, callId, organizationId]
    )
    .catch((err) =>
      logger.warn('Failed to update calls consent columns (non-fatal)', {
        error: (err as Error)?.message,
      })
    )

  // Log to compliance_events
  await db
    .query(
      `INSERT INTO compliance_events
       (organization_id, account_id, call_id, event_type, severity, passed, details)
       VALUES ($1, $2, $3, 'consent_captured', 'info', true, $4::jsonb)`,
      [
        organizationId,
        accountId || null,
        callId,
        JSON.stringify({
          consent_method: consentMethod,
          audio_offset_ms: consentAudioOffsetMs || null,
          timestamp: new Date().toISOString(),
        }),
      ]
    )
    .catch((err) =>
      logger.warn('Failed to log consent event (non-fatal)', {
        error: (err as Error)?.message,
      })
    )
}
