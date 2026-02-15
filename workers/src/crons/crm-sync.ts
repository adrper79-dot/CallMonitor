// CRM Sync Engine — Cloudflare Cron Trigger Handler
//
// Runs every 15 minutes via the cron schedule (every-15-min).
// Processes all active CRM integrations for delta sync.
//
// Flow:
//  1. Query all integrations with status='active' (max 10 per run)
//  2. For each integration:
//     a. Get encrypted tokens from KV
//     b. Refresh if expired
//     c. Delta sync contacts (using sync_cursor from last run)
//     d. Push recent calls as activities (outbound sync)
//     e. Update sync_cursor and last_sync_at
//     f. Log to crm_sync_log
//  3. Handle errors per-integration (one failure never blocks others)
//
// @see workers/src/scheduled.ts — wired as a cron handler

import type { Env } from '../index'
import type { DbClient } from '../lib/db'
import { getDb } from '../lib/db'
import { logger } from '../lib/logger'
import { getTokens, storeTokens, isTokenExpired } from '../lib/crm-tokens'
import type { OAuthTokens } from '../lib/crm-tokens'
import {
  refreshHubSpotToken,
  listHubSpotContacts,
  createHubSpotCallActivity,
} from '../lib/crm-hubspot'
import type { HubSpotAuthConfig } from '../lib/crm-hubspot'
import {
  refreshSalesforceToken,
  listSalesforceContacts,
} from '../lib/crm-salesforce'
import type { SalesforceAuthConfig } from '../lib/crm-salesforce'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max integrations per cron run to stay within Workers CPU limits */
const MAX_INTEGRATIONS_PER_RUN = 10

/** Default contact batch size per API call */
const DEFAULT_CONTACT_BATCH_SIZE = 100

/** Max calls to push as activities per sync run */
const MAX_OUTBOUND_CALLS_PER_SYNC = 25

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationRow {
  id: string
  organization_id: string
  provider: 'hubspot' | 'salesforce' | 'zoho' | 'pipedrive'
  provider_account_id: string | null
  provider_account_name: string | null
  status: string
  settings: Record<string, unknown>
  sync_enabled: boolean
  last_sync_at: string | null
  sync_cursor: string | null
  created_at: string
  updated_at: string
}

interface SyncResult {
  recordsSynced: number
  recordsFailed: number
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * CRM Sync Handler — invoked by Cloudflare Cron Triggers.
 *
 * Processes all active CRM integrations with delta sync.
 * Returns aggregate counts for the `trackCronExecution` wrapper.
 */
export async function handleCrmSync(
  env: Env,
): Promise<{ processed: number; errors: number }> {
  const db = getDb(env)
  let totalProcessed = 0
  let totalErrors = 0

  try {
    // Fetch active integrations that have sync enabled
    // Ordered by last_sync_at ASC so least-recently-synced go first
    const result = await db.query(
      `SELECT id, organization_id, provider, provider_account_id,
              provider_account_name, status, settings, sync_enabled,
              last_sync_at, sync_cursor, created_at, updated_at
       FROM integrations
       WHERE status = 'active'
         AND sync_enabled = true
       ORDER BY last_sync_at ASC NULLS FIRST
       LIMIT $1`,
      [MAX_INTEGRATIONS_PER_RUN],
    )

    const integrations: IntegrationRow[] = result.rows

    if (integrations.length === 0) {
      logger.info('CRM sync: no active integrations to process')
      return { processed: 0, errors: 0 }
    }

    logger.info('CRM sync: starting batch', {
      integrationCount: integrations.length,
    })

    // Process each integration independently
    for (const integration of integrations) {
      try {
        const syncResult = await syncIntegration(env, integration)
        totalProcessed += syncResult.recordsSynced
        totalErrors += syncResult.recordsFailed
      } catch (err) {
        totalErrors++
        logger.error('CRM sync: integration failed (outer catch)', {
          integrationId: integration.id,
          provider: integration.provider,
          orgId: integration.organization_id,
          error: (err as Error)?.message,
        })
        // Don't rethrow — continue with remaining integrations
      }
    }

    logger.info('CRM sync: batch complete', {
      totalProcessed,
      totalErrors,
      integrationCount: integrations.length,
    })
  } catch (err) {
    logger.error('CRM sync: fatal error querying integrations', {
      error: (err as Error)?.message,
    })
    throw err
  } finally {
    await db.end()
  }

  return { processed: totalProcessed, errors: totalErrors }
}

// ─── Per-Integration Sync ────────────────────────────────────────────────────

/**
 * Sync a single CRM integration.
 *
 * 1. Mark status='syncing'
 * 2. Get/refresh tokens
 * 3. Dispatch to provider-specific handler
 * 4. Mark status='active' (or 'error')
 * 5. Write crm_sync_log row
 */
async function syncIntegration(
  env: Env,
  integration: IntegrationRow,
): Promise<SyncResult> {
  const db = getDb(env)
  const startedAt = new Date().toISOString()
  let syncLogId: string | null = null

  try {
    // ── 1. Mark as syncing ──────────────────────────────────────────────
    await db.query(
      `UPDATE integrations SET status = 'syncing', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [integration.id, integration.organization_id],
    )

    // ── 2. Create sync log entry ────────────────────────────────────────
    const logResult = await db.query(
      `INSERT INTO crm_sync_log
         (organization_id, integration_id, direction, status, started_at)
       VALUES ($1, $2, 'inbound', 'running', $3)
       RETURNING id`,
      [integration.organization_id, integration.id, startedAt],
    )
    syncLogId = logResult.rows[0]?.id

    // ── 3. Get tokens from KV ───────────────────────────────────────────
    const tokens = await getTokens(
      env,
      integration.organization_id,
      integration.provider,
    )

    if (!tokens) {
      throw new Error(`No tokens found for ${integration.provider} integration`)
    }

    // ── 4. Refresh if expired ───────────────────────────────────────────
    let activeTokens = tokens
    if (isTokenExpired(tokens)) {
      activeTokens = await refreshTokenForProvider(
        env,
        integration,
        tokens,
      )
    }

    // ── 5. Dispatch to provider-specific sync ───────────────────────────
    let result: { synced: number; failed: number }

    switch (integration.provider) {
      case 'hubspot':
        result = await syncHubSpot(env, integration, activeTokens)
        break
      case 'salesforce':
        result = await syncSalesforce(env, integration, activeTokens)
        break
      default:
        logger.warn('CRM sync: unsupported provider', {
          provider: integration.provider,
          integrationId: integration.id,
        })
        result = { synced: 0, failed: 0 }
    }

    // ── 6. Update integration status ────────────────────────────────────
    await db.query(
      `UPDATE integrations
       SET status = 'active',
           last_sync_at = NOW(),
           error_message = NULL,
           last_error_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [integration.id, integration.organization_id],
    )

    // ── 7. Update sync log ──────────────────────────────────────────────
    if (syncLogId) {
      await db.query(
        `UPDATE crm_sync_log
         SET status = 'completed',
             records_synced = $1,
             records_failed = $2,
             completed_at = NOW()
         WHERE id = $3 AND organization_id = $4`,
        [result.synced, result.failed, syncLogId, integration.organization_id],
      )
    }

    logger.info('CRM sync: integration synced', {
      integrationId: integration.id,
      provider: integration.provider,
      orgId: integration.organization_id,
      synced: result.synced,
      failed: result.failed,
    })

    return { recordsSynced: result.synced, recordsFailed: result.failed }
  } catch (err) {
    const errorMsg = (err as Error)?.message || 'Unknown error'

    // Mark integration as errored
    await db.query(
      `UPDATE integrations
       SET status = 'error',
           error_message = $1,
           last_error_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND organization_id = $3`,
      [errorMsg.slice(0, 500), integration.id, integration.organization_id],
    ).catch((dbErr) => {
      logger.error('CRM sync: failed to update integration error status', {
        integrationId: integration.id,
        error: (dbErr as Error)?.message,
      })
    })

    // Update sync log with failure
    if (syncLogId) {
      await db.query(
        `UPDATE crm_sync_log
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [errorMsg.slice(0, 1000), syncLogId, integration.organization_id],
      ).catch((dbErr) => {
        logger.error('CRM sync: failed to update sync log error', {
          syncLogId,
          error: (dbErr as Error)?.message,
        })
      })
    }

    logger.error('CRM sync: integration sync failed', {
      integrationId: integration.id,
      provider: integration.provider,
      orgId: integration.organization_id,
      error: errorMsg,
    })

    return { recordsSynced: 0, recordsFailed: 1 }
  } finally {
    await db.end()
  }
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

/**
 * Refresh OAuth tokens for a given provider.
 * Stores the new tokens in KV and returns them.
 */
async function refreshTokenForProvider(
  env: Env,
  integration: IntegrationRow,
  tokens: OAuthTokens,
): Promise<OAuthTokens> {
  const settings = integration.settings || {}

  logger.info('CRM sync: refreshing expired token', {
    integrationId: integration.id,
    provider: integration.provider,
  })

  switch (integration.provider) {
    case 'hubspot': {
      const config: HubSpotAuthConfig = {
        clientId: (settings.client_id as string) || '',
        clientSecret: (settings.client_secret as string) || '',
        redirectUri: (settings.redirect_uri as string) || '',
        scopes: (settings.scopes as string[]) || [],
      }

      const freshTokenResponse = await refreshHubSpotToken(config, tokens.refresh_token)

      const newTokens: OAuthTokens = {
        access_token: freshTokenResponse.access_token,
        refresh_token: freshTokenResponse.refresh_token,
        expires_at: Date.now() + freshTokenResponse.expires_in * 1000,
        token_type: freshTokenResponse.token_type,
      }

      await storeTokens(env, integration.organization_id, 'hubspot', newTokens)
      return newTokens
    }

    case 'salesforce': {
      const config: SalesforceAuthConfig = {
        clientId: (settings.client_id as string) || '',
        clientSecret: (settings.client_secret as string) || '',
        redirectUri: (settings.redirect_uri as string) || '',
      }

      const freshTokenResponse = await refreshSalesforceToken(config, tokens.refresh_token)

      const newTokens: OAuthTokens = {
        access_token: freshTokenResponse.access_token,
        // Salesforce may not return a new refresh_token on refresh
        refresh_token: freshTokenResponse.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + 2 * 60 * 60 * 1000, // Salesforce tokens last ~2h
        token_type: freshTokenResponse.token_type,
      }

      await storeTokens(env, integration.organization_id, 'salesforce', newTokens)
      return newTokens
    }

    default:
      throw new Error(`Token refresh not supported for provider: ${integration.provider}`)
  }
}

// ─── HubSpot Sync ────────────────────────────────────────────────────────────

/**
 * HubSpot-specific delta sync.
 *
 * 1. Pull contacts modified since last sync_cursor
 * 2. Upsert into local cache
 * 3. Push recent calls as HubSpot call activities (outbound)
 * 4. Update sync_cursor
 */
async function syncHubSpot(
  env: Env,
  integration: IntegrationRow,
  tokens: OAuthTokens,
): Promise<{ synced: number; failed: number }> {
  const db = getDb(env)
  let synced = 0
  let failed = 0

  try {
    const syncDirection = (integration.settings?.sync_direction as string) || 'both'

    // ── Inbound: pull contacts from HubSpot ─────────────────────────────
    if (syncDirection === 'inbound' || syncDirection === 'both') {
      const lastModified = integration.sync_cursor || undefined
      let after: string | undefined

      // Paginate through contacts
      do {
        const contactsPage = await listHubSpotContacts(tokens.access_token, {
          limit: DEFAULT_CONTACT_BATCH_SIZE,
          after,
          properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
          lastModifiedDate: lastModified,
        })

        if (contactsPage.results.length > 0) {
          const upserted = await upsertContactCache(
            db,
            integration.organization_id,
            integration.id,
            contactsPage.results.map((c) => ({
              crm_object_id: c.id,
              crm_object_type: 'contact',
              first_name: c.properties?.firstname || null,
              last_name: c.properties?.lastname || null,
              email: c.properties?.email || null,
              phone: c.properties?.phone || null,
              company: c.properties?.company || null,
              raw_data: c.properties,
            })),
          )

          synced += upserted
        }

        after = contactsPage.paging?.next?.after
      } while (after)

      // Update sync_cursor to current time for next delta
      await db.query(
        `UPDATE integrations
         SET sync_cursor = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [new Date().toISOString(), integration.id, integration.organization_id],
      )
    }

    // ── Outbound: push recent calls to HubSpot as activities ────────────
    if (syncDirection === 'outbound' || syncDirection === 'both') {
      const outboundResult = await pushCallsToHubSpot(
        db,
        env,
        integration,
        tokens,
      )
      synced += outboundResult.pushed
      failed += outboundResult.failed
    }
  } catch (err) {
    logger.error('CRM sync: HubSpot sync error', {
      integrationId: integration.id,
      error: (err as Error)?.message,
    })
    throw err
  } finally {
    await db.end()
  }

  return { synced, failed }
}

/**
 * Push recent completed calls to HubSpot as call activities.
 * Only pushes calls that haven't been synced yet (no crm_object_links entry).
 */
async function pushCallsToHubSpot(
  db: DbClient,
  _env: Env,
  integration: IntegrationRow,
  tokens: OAuthTokens,
): Promise<{ pushed: number; failed: number }> {
  let pushed = 0
  let failed = 0

  try {
    // Find recent completed calls without a HubSpot call activity link
    const callsResult = await db.query(
      `SELECT c.id, c.call_sid, c.phone_number, c.agent_phone, c.duration,
              c.status, c.started_at, c.ended_at, c.disposition,
              c.organization_id
       FROM calls c
       WHERE c.organization_id = $1
         AND c.status = 'completed'
         AND c.ended_at > NOW() - INTERVAL '1 hour'
         AND NOT EXISTS (
           SELECT 1 FROM crm_object_links col
           WHERE col.call_id = c.id
             AND col.crm_object_type = 'call_activity'
             AND col.integration_id = $2
         )
       ORDER BY c.ended_at DESC
       LIMIT $3`,
      [integration.organization_id, integration.id, MAX_OUTBOUND_CALLS_PER_SYNC],
    )

    for (const call of callsResult.rows) {
      try {
        // Find matching HubSpot contact by phone number
        let associatedContactId: string | undefined

        const linkResult = await db.query(
          `SELECT crm_object_id FROM crm_object_links
           WHERE organization_id = $1
             AND integration_id = $2
             AND crm_object_type = 'contact'
             AND (metadata->>'phone' = $3 OR metadata->>'email' IS NOT NULL)
           LIMIT 1`,
          [integration.organization_id, integration.id, call.phone_number],
        )

        if (linkResult.rows.length > 0) {
          associatedContactId = linkResult.rows[0].crm_object_id
        }

        const activity = await createHubSpotCallActivity(tokens.access_token, {
          toNumber: call.phone_number || '',
          fromNumber: call.agent_phone || '',
          durationMs: (call.duration || 0) * 1000,
          disposition: call.disposition || 'COMPLETED',
          body: `Call synced from Word Is Bond (${call.call_sid})`,
          timestamp: new Date(call.started_at || call.ended_at).getTime(),
          associatedContactId,
        })

        // Record the link
        await db.query(
          `INSERT INTO crm_object_links
             (organization_id, integration_id, call_id, crm_object_type,
              crm_object_id, sync_direction, metadata)
           VALUES ($1, $2, $3, 'call_activity', $4, 'outbound', $5)
           ON CONFLICT DO NOTHING`,
          [
            integration.organization_id,
            integration.id,
            call.id,
            activity.id,
            JSON.stringify({ hubspot_call_id: activity.id }),
          ],
        )

        pushed++
      } catch (callErr) {
        failed++
        logger.error('CRM sync: failed to push call to HubSpot', {
          callId: call.id,
          integrationId: integration.id,
          error: (callErr as Error)?.message,
        })
      }
    }
  } catch (err) {
    logger.error('CRM sync: outbound call sync query failed', {
      integrationId: integration.id,
      error: (err as Error)?.message,
    })
  }

  return { pushed, failed }
}

// ─── Salesforce Sync ─────────────────────────────────────────────────────────

/**
 * Salesforce-specific delta sync.
 *
 * 1. Pull contacts modified since last sync_cursor
 * 2. Upsert into local cache
 * 3. Update sync_cursor
 */
async function syncSalesforce(
  env: Env,
  integration: IntegrationRow,
  tokens: OAuthTokens,
): Promise<{ synced: number; failed: number }> {
  const db = getDb(env)
  let synced = 0
  const failed = 0

  try {
    const syncDirection = (integration.settings?.sync_direction as string) || 'both'
    const instanceUrl = (integration.settings?.instance_url as string) || ''

    if (!instanceUrl) {
      throw new Error('Salesforce instance_url not configured in integration settings')
    }

    // ── Inbound: pull contacts from Salesforce ──────────────────────────
    if (syncDirection === 'inbound' || syncDirection === 'both') {
      const modifiedSince = integration.sync_cursor || undefined

      const contacts = await listSalesforceContacts(
        instanceUrl,
        tokens.access_token,
        {
          limit: DEFAULT_CONTACT_BATCH_SIZE,
          modifiedSince,
        },
      )

      if (contacts.length > 0) {
        const upserted = await upsertContactCache(
          db,
          integration.organization_id,
          integration.id,
          contacts.map((c) => ({
            crm_object_id: c.Id,
            crm_object_type: 'contact',
            first_name: c.FirstName || null,
            last_name: c.LastName || null,
            email: c.Email || null,
            phone: c.Phone || null,
            company: null,
            raw_data: c,
          })),
        )

        synced += upserted
      }

      // Update sync_cursor
      await db.query(
        `UPDATE integrations
         SET sync_cursor = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [new Date().toISOString(), integration.id, integration.organization_id],
      )
    }

    // Outbound: Salesforce task creation can be added here in the future
  } catch (err) {
    logger.error('CRM sync: Salesforce sync error', {
      integrationId: integration.id,
      error: (err as Error)?.message,
    })
    throw err
  } finally {
    await db.end()
  }

  return { synced, failed }
}

// ─── Contact Cache Upsert ────────────────────────────────────────────────────

interface ContactRecord {
  crm_object_id: string
  crm_object_type: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  raw_data: Record<string, unknown> | null
}

/**
 * Upsert contacts from CRM into crm_object_links.
 *
 * Uses ON CONFLICT to update existing records and insert new ones.
 * Each contact is linked to the integration and organization.
 *
 * @returns Number of contacts successfully upserted
 */
async function upsertContactCache(
  db: DbClient,
  orgId: string,
  integrationId: string,
  contacts: ContactRecord[],
): Promise<number> {
  let upserted = 0

  for (const contact of contacts) {
    try {
      await db.query(
        `INSERT INTO crm_object_links
           (organization_id, integration_id, crm_object_type, crm_object_id,
            crm_object_name, sync_direction, metadata)
         VALUES ($1, $2, $3, $4, $5, 'inbound', $6)
         ON CONFLICT (integration_id, crm_object_type, crm_object_id)
         DO UPDATE SET
           crm_object_name = EXCLUDED.crm_object_name,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          orgId,
          integrationId,
          contact.crm_object_type,
          contact.crm_object_id,
          [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null,
          JSON.stringify({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            raw_data: contact.raw_data,
            synced_at: new Date().toISOString(),
          }),
        ],
      )
      upserted++
    } catch (err) {
      logger.error('CRM sync: contact upsert failed', {
        orgId,
        integrationId,
        crmObjectId: contact.crm_object_id,
        error: (err as Error)?.message,
      })
      // Continue with remaining contacts
    }
  }

  if (upserted > 0) {
    logger.info('CRM sync: contacts upserted', {
      orgId,
      integrationId,
      upserted,
      total: contacts.length,
    })
  }

  return upserted
}
