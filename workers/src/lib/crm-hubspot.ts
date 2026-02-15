/**
 * HubSpot CRM API v3 Client
 *
 * Raw fetch()-based client for Cloudflare Workers — no NPM SDK.
 * Handles OAuth flow, contacts, deals, call activities, and field discovery.
 *
 * HubSpot API docs: https://developers.hubspot.com/docs/api/overview
 */

import { logger } from './logger'

// ─── Constants ───────────────────────────────────────────────────────────────

const HUBSPOT_AUTH_BASE = 'https://app.hubspot.com/oauth/authorize'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_API_BASE = 'https://api.hubapi.com'

/** Default OAuth scopes requested during authorization */
export const HUBSPOT_DEFAULT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
]

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HubSpotAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface HubSpotTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface HubSpotContact {
  id: string
  properties: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface HubSpotDeal {
  id: string
  properties: Record<string, string>
}

export interface HubSpotCallActivity {
  id: string
  properties: Record<string, string>
}

export interface HubSpotProperty {
  name: string
  label: string
  type: string
  fieldType: string
  groupName: string
}

export interface HubSpotError {
  error: string
  statusCode: number
  category: string
}

interface HubSpotPaging {
  next?: { after: string }
}

interface HubSpotListResult<T> {
  results: T[]
  paging?: HubSpotPaging
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Parse a HubSpot error response into a structured error object.
 * Never logs the raw response body (may contain tokens).
 */
async function parseHubSpotError(res: Response, context: string): Promise<HubSpotError> {
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    // non-JSON error body — fall through
  }

  const err: HubSpotError = {
    error: (body.message as string) || (body.error as string) || res.statusText,
    statusCode: res.status,
    category: (body.category as string) || 'UNKNOWN',
  }

  logger.error('HubSpot API error', {
    context,
    statusCode: err.statusCode,
    category: err.category,
    error: err.error,
  })

  return err
}

/**
 * Build standard headers for authenticated HubSpot API requests.
 * Token is included in the Authorization header but never logged.
 */
function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

// ─── OAuth Flow ──────────────────────────────────────────────────────────────

/**
 * Build the HubSpot OAuth authorization URL.
 *
 * Redirect the user's browser to this URL to start the OAuth consent flow.
 *
 * @param config - OAuth app credentials and redirect URI
 * @returns Full authorization URL string
 */
export function getHubSpotAuthUrl(config: HubSpotAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    response_type: 'code',
  })

  const url = `${HUBSPOT_AUTH_BASE}?${params.toString()}`
  logger.info('HubSpot OAuth URL generated', { redirectUri: config.redirectUri })
  return url
}

/**
 * Exchange an authorization code for access & refresh tokens.
 *
 * Called after the user completes the OAuth consent screen and HubSpot
 * redirects back with a `code` query parameter.
 *
 * @param config - OAuth app credentials
 * @param code   - Authorization code from the redirect callback
 * @returns Token response containing access_token, refresh_token, and expiry
 * @throws {HubSpotError} If the token exchange fails
 */
export async function exchangeHubSpotCode(
  config: HubSpotAuthConfig,
  code: string,
): Promise<HubSpotTokenResponse> {
  logger.info('HubSpot token exchange started')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  })

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'exchangeHubSpotCode')
    throw err
  }

  const data = (await res.json()) as HubSpotTokenResponse
  logger.info('HubSpot token exchange succeeded', { expiresIn: data.expires_in })
  return data
}

/**
 * Refresh an expired HubSpot access token using a refresh token.
 *
 * @param config       - OAuth app credentials
 * @param refreshToken - Previously issued refresh token
 * @returns New token response with fresh access_token
 * @throws {HubSpotError} If the refresh fails (e.g. token revoked)
 */
export async function refreshHubSpotToken(
  config: HubSpotAuthConfig,
  refreshToken: string,
): Promise<HubSpotTokenResponse> {
  logger.info('HubSpot token refresh started')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  })

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'refreshHubSpotToken')
    throw err
  }

  const data = (await res.json()) as HubSpotTokenResponse
  logger.info('HubSpot token refresh succeeded', { expiresIn: data.expires_in })
  return data
}

// ─── Contacts ────────────────────────────────────────────────────────────────

/**
 * List HubSpot contacts with pagination and optional delta sync.
 *
 * @param accessToken - Valid OAuth access token
 * @param options     - Pagination, property selection, and delta-sync filters
 * @returns Paginated list of contacts
 * @throws {HubSpotError} On API failure
 */
export async function listHubSpotContacts(
  accessToken: string,
  options?: {
    limit?: number
    after?: string
    properties?: string[]
    lastModifiedDate?: string
  },
): Promise<HubSpotListResult<HubSpotContact>> {
  const params = new URLSearchParams()
  params.set('limit', String(Math.min(options?.limit ?? 100, 100)))

  if (options?.after) {
    params.set('after', options.after)
  }

  if (options?.properties?.length) {
    for (const prop of options.properties) {
      params.append('properties', prop)
    }
  }

  // Delta sync: filter by last modified date
  if (options?.lastModifiedDate) {
    params.set('filterGroups', JSON.stringify([{
      filters: [{
        propertyName: 'lastmodifieddate',
        operator: 'GTE',
        value: options.lastModifiedDate,
      }],
    }]))
  }

  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?${params.toString()}`

  logger.info('HubSpot listContacts', {
    limit: options?.limit ?? 100,
    hasAfter: !!options?.after,
    hasDeltaSync: !!options?.lastModifiedDate,
  })

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'listHubSpotContacts')
    throw err
  }

  return (await res.json()) as HubSpotListResult<HubSpotContact>
}

/**
 * Get a single HubSpot contact by ID.
 *
 * @param accessToken - Valid OAuth access token
 * @param contactId   - HubSpot contact record ID
 * @returns Contact object with properties
 * @throws {HubSpotError} If contact not found or API failure
 */
export async function getHubSpotContact(
  accessToken: string,
  contactId: string,
): Promise<HubSpotContact> {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`

  logger.info('HubSpot getContact', { contactId })

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'getHubSpotContact')
    throw err
  }

  return (await res.json()) as HubSpotContact
}

/**
 * Search HubSpot contacts by email or phone number.
 *
 * Uses the CRM v3 search endpoint with a multi-field query.
 *
 * @param accessToken - Valid OAuth access token
 * @param query       - Search string (email, phone, or name)
 * @returns Array of matching contacts
 * @throws {HubSpotError} On API failure
 */
export async function searchHubSpotContacts(
  accessToken: string,
  query: string,
): Promise<HubSpotContact[]> {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`

  logger.info('HubSpot searchContacts', { queryLength: query.length })

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'CONTAINS_TOKEN', value: query },
          ],
        },
        {
          filters: [
            { propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: query },
          ],
        },
        {
          filters: [
            { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: query },
          ],
        },
        {
          filters: [
            { propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: query },
          ],
        },
      ],
      properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
      limit: 20,
    }),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'searchHubSpotContacts')
    throw err
  }

  const data = (await res.json()) as HubSpotListResult<HubSpotContact>
  return data.results
}

// ─── Deals ───────────────────────────────────────────────────────────────────

/**
 * List HubSpot deals with pagination.
 *
 * @param accessToken - Valid OAuth access token
 * @param options     - Pagination and property selection
 * @returns Paginated list of deals
 * @throws {HubSpotError} On API failure
 */
export async function listHubSpotDeals(
  accessToken: string,
  options?: {
    limit?: number
    after?: string
    properties?: string[]
  },
): Promise<HubSpotListResult<HubSpotDeal>> {
  const params = new URLSearchParams()
  params.set('limit', String(Math.min(options?.limit ?? 100, 100)))

  if (options?.after) {
    params.set('after', options.after)
  }

  if (options?.properties?.length) {
    for (const prop of options.properties) {
      params.append('properties', prop)
    }
  }

  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/deals?${params.toString()}`

  logger.info('HubSpot listDeals', {
    limit: options?.limit ?? 100,
    hasAfter: !!options?.after,
  })

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'listHubSpotDeals')
    throw err
  }

  return (await res.json()) as HubSpotListResult<HubSpotDeal>
}

// ─── Call Activities (Engagements) ───────────────────────────────────────────

/**
 * Log a call activity in HubSpot and optionally associate it with a contact.
 *
 * Creates a CRM v3 "calls" object with call metadata (duration, disposition,
 * transcript summary) and links it to a contact record if provided.
 *
 * @param accessToken - Valid OAuth access token
 * @param data        - Call details including numbers, duration, and optional contact
 * @returns Created call activity object
 * @throws {HubSpotError} On API failure
 */
export async function createHubSpotCallActivity(
  accessToken: string,
  data: {
    toNumber: string
    fromNumber: string
    durationMs: number
    disposition: string
    body: string
    timestamp: number
    associatedContactId?: string
  },
): Promise<HubSpotCallActivity> {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/calls`

  logger.info('HubSpot createCallActivity', {
    disposition: data.disposition,
    durationMs: data.durationMs,
    hasAssociatedContact: !!data.associatedContactId,
  })

  // HubSpot call properties
  // hs_timestamp expects epoch ms as a string
  // hs_call_duration expects milliseconds as a string
  const properties: Record<string, string> = {
    hs_timestamp: String(data.timestamp),
    hs_call_title: `Call ${data.fromNumber} → ${data.toNumber}`,
    hs_call_body: data.body,
    hs_call_duration: String(data.durationMs),
    hs_call_from_number: data.fromNumber,
    hs_call_to_number: data.toNumber,
    hs_call_disposition: data.disposition,
    hs_call_direction: 'OUTBOUND',
    hs_call_status: 'COMPLETED',
  }

  // Build associations if a contact ID is provided
  const associations = data.associatedContactId
    ? [
        {
          to: { id: data.associatedContactId },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 194, // calls-to-contacts
            },
          ],
        },
      ]
    : undefined

  const payload: Record<string, unknown> = { properties }
  if (associations) {
    payload.associations = associations
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'createHubSpotCallActivity')
    throw err
  }

  return (await res.json()) as HubSpotCallActivity
}

// ─── Field Discovery ─────────────────────────────────────────────────────────

/**
 * Get available CRM properties for an object type.
 *
 * Used by the field-mapping UI to let users pick which HubSpot fields
 * to sync with Word Is Bond contact/call records.
 *
 * @param accessToken - Valid OAuth access token
 * @param objectType  - CRM object type (e.g. 'contacts', 'deals', 'calls', 'companies')
 * @returns Array of property definitions with name, label, type, fieldType, and groupName
 * @throws {HubSpotError} On API failure
 */
export async function getHubSpotProperties(
  accessToken: string,
  objectType: string,
): Promise<HubSpotProperty[]> {
  const url = `${HUBSPOT_API_BASE}/crm/v3/properties/${encodeURIComponent(objectType)}`

  logger.info('HubSpot getProperties', { objectType })

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseHubSpotError(res, 'getHubSpotProperties')
    throw err
  }

  const data = (await res.json()) as { results: Array<Record<string, unknown>> }

  // Map to our slimmed-down interface
  return data.results.map((p) => ({
    name: p.name as string,
    label: p.label as string,
    type: p.type as string,
    fieldType: p.fieldType as string,
    groupName: p.groupName as string,
  }))
}

// ─── Rate-Limit Helper ──────────────────────────────────────────────────────

/**
 * HubSpot rate limits (as of API v3):
 *  - Free/Starter: 100 requests per 10 seconds
 *  - Pro/Enterprise: 150 requests per 10 seconds
 *  - Private apps: 200 requests per 10 seconds per account
 *
 * Extract rate-limit headers from a HubSpot response for upstream tracking.
 *
 * @param res - Fetch Response from a HubSpot API call
 * @returns Parsed rate-limit metadata
 */
export function extractHubSpotRateLimits(res: Response): {
  dailyRemaining: number | null
  secondlyRemaining: number | null
} {
  return {
    dailyRemaining: parseHeaderInt(res.headers.get('X-HubSpot-RateLimit-Daily-Remaining')),
    secondlyRemaining: parseHeaderInt(res.headers.get('X-HubSpot-RateLimit-Secondly-Remaining')),
  }
}

function parseHeaderInt(value: string | null): number | null {
  if (value === null) return null
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}
