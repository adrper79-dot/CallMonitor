/**
 * Phone Number Provisioning & Round-Robin Selection
 *
 * Provisions 5 Telnyx phone numbers per organization at signup,
 * assigns them to the Call Control App, creates a CNAM listing
 * for outbound caller ID masking, and provides round-robin
 * number selection for outbound calls.
 *
 * CNAM Flow:
 *   1. Create CNAM listing with org name (one-time per org)
 *   2. Assign CNAM listing to all 5 numbers
 *   3. Single verification call verifies the business — covers all numbers
 *
 * Round-Robin:
 *   org_phone_numbers.last_used_at is updated on each use.
 *   getNextOutboundNumber() picks the number with the oldest last_used_at.
 *
 * @see workers/src/routes/onboarding.ts — calls provisionOrgPhoneNumbers()
 */

import type { Env } from '../index'
import type { DbClient } from './db'
import { logger } from './logger'

const TELNYX_BASE = 'https://api.telnyx.com/v2'
const NUMBERS_TO_PROVISION = 5

interface ProvisionResult {
  success: boolean
  numbers: string[]
  cnamListingId: string | null
  errors: string[]
}

/**
 * Provision 5 phone numbers for a new organization.
 *
 * Steps:
 *   1. Search for available US local numbers
 *   2. Order all 5 in a single number_order
 *   3. Assign each to the Call Control App + Connection
 *   4. Create a CNAM listing with the org name
 *   5. Assign the CNAM listing to all numbers
 *   6. Insert into org_phone_numbers table
 *
 * @returns ProvisionResult with ordered numbers and any errors
 */
export async function provisionOrgPhoneNumbers(
  env: Env,
  db: DbClient,
  organizationId: string,
  orgName: string
): Promise<ProvisionResult> {
  const apiKey = env.TELNYX_API_KEY
  const connectionId = env.TELNYX_CONNECTION_ID
  const appId = env.TELNYX_CALL_CONTROL_APP_ID
  const errors: string[] = []
  const provisionedNumbers: string[] = []

  if (!apiKey) {
    return { success: false, numbers: [], cnamListingId: null, errors: ['TELNYX_API_KEY not configured'] }
  }

  try {
    // ── Step 1: Search for available numbers ──────────────────────────────
    const searchRes = await fetch(
      `${TELNYX_BASE}/available_phone_numbers?` +
        new URLSearchParams({
          'filter[country_code]': 'US',
          'filter[number_type]': 'local',
          'filter[limit]': NUMBERS_TO_PROVISION.toString(),
          'filter[features][]': 'voice',
        }),
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    )

    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => '')
      return {
        success: false,
        numbers: [],
        cnamListingId: null,
        errors: [`Number search failed: ${searchRes.status} — ${errText.substring(0, 200)}`],
      }
    }

    const searchData = (await searchRes.json()) as {
      data: Array<{ phone_number: string }>
    }
    const availableNumbers = searchData.data?.map((n) => n.phone_number) || []

    if (availableNumbers.length < NUMBERS_TO_PROVISION) {
      logger.warn('Fewer numbers available than requested', {
        requested: NUMBERS_TO_PROVISION,
        available: availableNumbers.length,
      })
    }

    if (availableNumbers.length === 0) {
      return {
        success: false,
        numbers: [],
        cnamListingId: null,
        errors: ['No phone numbers available for provisioning'],
      }
    }

    // ── Step 2: Order all numbers in one request ──────────────────────────
    const orderRes = await fetch(`${TELNYX_BASE}/number_orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_numbers: availableNumbers.map((phone_number) => ({
          phone_number,
        })),
        connection_id: appId || connectionId || undefined,
      }),
    })

    if (!orderRes.ok) {
      const errText = await orderRes.text().catch(() => '')
      return {
        success: false,
        numbers: [],
        cnamListingId: null,
        errors: [`Number order failed: ${orderRes.status} — ${errText.substring(0, 200)}`],
      }
    }

    const orderData = (await orderRes.json()) as {
      data: {
        id: string
        phone_numbers: Array<{ phone_number: string; status: string }>
      }
    }

    // Collect successfully ordered numbers
    for (const num of orderData.data?.phone_numbers || []) {
      provisionedNumbers.push(num.phone_number)
    }

    if (provisionedNumbers.length === 0) {
      return {
        success: false,
        numbers: [],
        cnamListingId: null,
        errors: ['Number order returned no phone numbers'],
      }
    }

    logger.info('Phone numbers ordered', {
      organizationId,
      count: provisionedNumbers.length,
      orderId: orderData.data?.id,
    })

    // ── Step 3: Assign each number to Call Control App ─────────────────────
    // Telnyx auto-assigns if connection_id is in the order, but we ensure it
    if (appId || connectionId) {
      for (const phoneNumber of provisionedNumbers) {
        try {
          // Get the number's ID first
          const numLookup = await fetch(
            `${TELNYX_BASE}/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
            { headers: { Authorization: `Bearer ${apiKey}` } }
          )
          if (numLookup.ok) {
            const numData = (await numLookup.json()) as {
              data: Array<{ id: string }>
            }
            const numId = numData.data?.[0]?.id
            if (numId) {
              await fetch(`${TELNYX_BASE}/phone_numbers/${numId}`, {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  connection_id: appId || connectionId,
                }),
              }).catch((err) =>
                logger.warn('Number connection assignment failed (non-fatal)', {
                  phoneNumber,
                  error: (err as Error)?.message,
                })
              )
            }
          }
        } catch (err) {
          errors.push(`Connection assignment failed for ${phoneNumber}: ${(err as Error)?.message}`)
        }
      }
    }

    // ── Step 4: Create CNAM listing for caller ID masking ─────────────────
    // One listing per org → one verification covers all 5 numbers
    let cnamListingId: string | null = null

    try {
      // Truncate to 15 chars (CNAM max length)
      const cnamName = orgName.substring(0, 15).toUpperCase()

      const cnamRes = await fetch(`${TELNYX_BASE}/cnam_requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cnam_listing: cnamName,
          phone_number: provisionedNumbers[0], // Primary number for verification
        }),
      })

      if (cnamRes.ok) {
        const cnamData = (await cnamRes.json()) as {
          data: { id: string }
        }
        cnamListingId = cnamData.data?.id || null

        logger.info('CNAM listing created', {
          organizationId,
          cnamListingId,
          displayName: cnamName,
        })

        // Apply CNAM to remaining numbers (verification applies to all)
        for (let i = 1; i < provisionedNumbers.length; i++) {
          fetch(`${TELNYX_BASE}/cnam_requests`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cnam_listing: cnamName,
              phone_number: provisionedNumbers[i],
            }),
          }).catch((err) =>
            logger.warn('CNAM assignment failed for secondary number (non-fatal)', {
              phoneNumber: provisionedNumbers[i],
              error: (err as Error)?.message,
            })
          )
        }
      } else {
        const errText = await cnamRes.text().catch(() => '')
        errors.push(`CNAM listing creation failed: ${cnamRes.status} — ${errText.substring(0, 200)}`)
      }
    } catch (err) {
      errors.push(`CNAM error: ${(err as Error)?.message}`)
    }

    // ── Step 5: Insert into org_phone_numbers table ───────────────────────
    for (let i = 0; i < provisionedNumbers.length; i++) {
      await db
        .query(
          `INSERT INTO org_phone_numbers
            (organization_id, phone_number, label, purpose, cnam_listing_id, is_active, pool_order)
           VALUES ($1, $2, $3, 'outbound', $4, true, $5)
           ON CONFLICT (phone_number) DO NOTHING`,
          [
            organizationId,
            provisionedNumbers[i],
            `Line ${i + 1}`,
            cnamListingId,
            i,
          ]
        )
        .catch((err) =>
          errors.push(`DB insert failed for ${provisionedNumbers[i]}: ${(err as Error)?.message}`)
        )
    }

    // Also insert into inbound_phone_numbers for inbound routing
    for (const phoneNumber of provisionedNumbers) {
      await db
        .query(
          `INSERT INTO inbound_phone_numbers
            (organization_id, phone_number, label, routing_type, auto_record, auto_transcribe, is_active)
           VALUES ($1, $2, 'Provisioned', 'round_robin', true, true, true)
           ON CONFLICT (phone_number) DO NOTHING`,
          [organizationId, phoneNumber]
        )
        .catch((err) =>
          logger.warn('Inbound number registration failed (non-fatal)', {
            phoneNumber,
            error: (err as Error)?.message,
          })
        )
    }

    // Store primary number on org for backward compatibility
    await db
      .query(
        `UPDATE organizations SET provisioned_number = $1 WHERE id = $2`,
        [provisionedNumbers[0], organizationId]
      )
      .catch(() => {})

    logger.info('Org phone numbers provisioned', {
      organizationId,
      count: provisionedNumbers.length,
      cnamListingId,
      errors: errors.length,
    })

    return {
      success: true,
      numbers: provisionedNumbers,
      cnamListingId,
      errors,
    }
  } catch (err) {
    logger.error('Phone number provisioning failed', {
      organizationId,
      error: (err as Error)?.message,
    })
    return {
      success: false,
      numbers: provisionedNumbers,
      cnamListingId: null,
      errors: [...errors, `Top-level error: ${(err as Error)?.message}`],
    }
  }
}

/**
 * Get the next outbound phone number for an organization using round-robin.
 *
 * Selects the active outbound number with the oldest last_used_at,
 * updates last_used_at atomically, and returns the phone number.
 *
 * Falls back to env.TELNYX_NUMBER if no org numbers are provisioned.
 */
export async function getNextOutboundNumber(
  db: DbClient,
  organizationId: string,
  fallbackNumber?: string
): Promise<string> {
  try {
    // Atomic round-robin: SELECT + UPDATE in one query via CTE
    const result = await db.query(
      `WITH next_number AS (
        SELECT id, phone_number
        FROM org_phone_numbers
        WHERE organization_id = $1
          AND is_active = true
          AND purpose IN ('outbound', 'both')
        ORDER BY last_used_at ASC NULLS FIRST, pool_order ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE org_phone_numbers
      SET last_used_at = NOW()
      FROM next_number
      WHERE org_phone_numbers.id = next_number.id
      RETURNING org_phone_numbers.phone_number`,
      [organizationId]
    )

    if (result.rows.length > 0) {
      return result.rows[0].phone_number
    }

    // Fallback to global number
    return fallbackNumber || ''
  } catch (err) {
    logger.warn('Round-robin number selection failed, using fallback', {
      organizationId,
      error: (err as Error)?.message,
    })
    return fallbackNumber || ''
  }
}
