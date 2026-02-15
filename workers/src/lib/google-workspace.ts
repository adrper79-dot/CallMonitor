/**
 * Google Workspace Client — Calendar + Contacts
 *
 * Raw fetch()-based client for Cloudflare Workers (no NPM SDK).
 * Use cases: calendar booking sync, contact enrichment for call center agents.
 *
 * @see ARCH_DOCS/02-FEATURES — Google Workspace integration
 */

import { logger } from './logger'

// ── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const PEOPLE_API_BASE = 'https://people.googleapis.com/v1'
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'

export const DEFAULT_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

// ── Types ────────────────────────────────────────────────────────────────────

export interface GoogleAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface GoogleContact {
  resourceName: string
  etag: string
  names?: Array<{ displayName: string; givenName?: string; familyName?: string }>
  emailAddresses?: Array<{ value: string; type?: string }>
  phoneNumbers?: Array<{ value: string; type?: string }>
  organizations?: Array<{ name?: string; title?: string }>
}

export interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  attendees?: Array<{ email: string; responseStatus: string }>
  status: string
  htmlLink: string
}

// ── OAuth Flow ───────────────────────────────────────────────────────────────

/**
 * Build Google OAuth consent URL.
 * Uses access_type=offline and prompt=consent to guarantee a refresh_token
 * on every authorization (even re-auth of existing users).
 */
export function getGoogleAuthUrl(config: GoogleAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })

  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`
  logger.info('[google-workspace] Built OAuth URL', { redirect_uri: config.redirectUri })
  return url
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
export async function exchangeGoogleCode(
  config: GoogleAuthConfig,
  code: string
): Promise<GoogleTokenResponse> {
  logger.info('[google-workspace] Exchanging auth code for tokens')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Token exchange failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google token exchange failed: ${res.status}`)
  }

  const data = (await res.json()) as GoogleTokenResponse
  logger.info('[google-workspace] Token exchange successful', {
    has_refresh_token: !!data.refresh_token,
    expires_in: data.expires_in,
  })
  return data
}

/**
 * Refresh an expired access token using the stored refresh_token.
 */
export async function refreshGoogleToken(
  config: GoogleAuthConfig,
  refreshToken: string
): Promise<GoogleTokenResponse> {
  logger.info('[google-workspace] Refreshing access token')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Token refresh failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google token refresh failed: ${res.status}`)
  }

  const data = (await res.json()) as GoogleTokenResponse
  logger.info('[google-workspace] Token refresh successful', {
    expires_in: data.expires_in,
  })
  return data
}

/**
 * Revoke a Google OAuth token (access or refresh).
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  logger.info('[google-workspace] Revoking token')

  const res = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Token revocation failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google token revocation failed: ${res.status}`)
  }

  logger.info('[google-workspace] Token revoked successfully')
}

// ── Google Contacts (People API) ─────────────────────────────────────────────

/**
 * List a user's Google contacts with pagination and delta sync support.
 *
 * @param accessToken - Valid Google OAuth access token
 * @param options.pageSize - Results per page (max 1000, default 100)
 * @param options.pageToken - Continuation token for next page
 * @param options.syncToken - For incremental sync (returns only changes since last sync)
 */
export async function listGoogleContacts(
  accessToken: string,
  options?: {
    pageSize?: number
    pageToken?: string
    syncToken?: string
  }
): Promise<{
  connections: GoogleContact[]
  nextPageToken?: string
  nextSyncToken: string
  totalPeople: number
}> {
  const params = new URLSearchParams({
    personFields: 'names,emailAddresses,phoneNumbers,organizations',
    pageSize: String(Math.min(options?.pageSize ?? 100, 1000)),
  })

  if (options?.pageToken) params.set('pageToken', options.pageToken)
  if (options?.syncToken) params.set('syncToken', options.syncToken)

  const url = `${PEOPLE_API_BASE}/people/me/connections?${params.toString()}`

  logger.info('[google-workspace] Listing contacts', {
    pageSize: options?.pageSize,
    hasSyncToken: !!options?.syncToken,
  })

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] List contacts failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Contacts list failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    connections?: GoogleContact[]
    nextPageToken?: string
    nextSyncToken?: string
    totalPeople?: number
  }

  return {
    connections: data.connections ?? [],
    nextPageToken: data.nextPageToken,
    nextSyncToken: data.nextSyncToken ?? '',
    totalPeople: data.totalPeople ?? 0,
  }
}

/**
 * Search a user's Google contacts by query string (name, email, phone).
 */
export async function searchGoogleContacts(
  accessToken: string,
  query: string
): Promise<GoogleContact[]> {
  const params = new URLSearchParams({
    query,
    readMask: 'names,emailAddresses,phoneNumbers,organizations',
    pageSize: '30',
  })

  const url = `${PEOPLE_API_BASE}/people:searchContacts?${params.toString()}`

  logger.info('[google-workspace] Searching contacts', { query })

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Search contacts failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Contacts search failed: ${res.status}`)
  }

  const data = (await res.json()) as { results?: Array<{ person: GoogleContact }> }
  return (data.results ?? []).map((r) => r.person)
}

// ── Google Calendar ──────────────────────────────────────────────────────────

/**
 * List all calendars the authenticated user has access to.
 */
export async function listCalendars(
  accessToken: string
): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const url = `${CALENDAR_API_BASE}/users/me/calendarList`

  logger.info('[google-workspace] Listing calendars')

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] List calendars failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Calendar list failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>
  }

  return (data.items ?? []).map((cal) => ({
    id: cal.id,
    summary: cal.summary,
    primary: cal.primary ?? false,
  }))
}

/**
 * List events from a specific calendar with time-range filtering.
 */
export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: {
    timeMin?: string
    timeMax?: string
    maxResults?: number
    pageToken?: string
    singleEvents?: boolean
  }
): Promise<{ items: GoogleCalendarEvent[]; nextPageToken?: string }> {
  const params = new URLSearchParams()

  if (options?.timeMin) params.set('timeMin', options.timeMin)
  if (options?.timeMax) params.set('timeMax', options.timeMax)
  if (options?.maxResults) params.set('maxResults', String(options.maxResults))
  if (options?.pageToken) params.set('pageToken', options.pageToken)
  if (options?.singleEvents !== undefined) params.set('singleEvents', String(options.singleEvents))

  // Default: order by start time when singleEvents is true
  if (options?.singleEvents) params.set('orderBy', 'startTime')

  const encodedCalId = encodeURIComponent(calendarId)
  const url = `${CALENDAR_API_BASE}/calendars/${encodedCalId}/events?${params.toString()}`

  logger.info('[google-workspace] Listing calendar events', { calendarId })

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] List events failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Calendar events list failed: ${res.status}`)
  }

  const data = (await res.json()) as {
    items?: GoogleCalendarEvent[]
    nextPageToken?: string
  }

  return {
    items: data.items ?? [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Create a calendar event (booking sync).
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string
    description?: string
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    attendees?: Array<{ email: string }>
    conferenceDataVersion?: number
  }
): Promise<GoogleCalendarEvent> {
  const encodedCalId = encodeURIComponent(calendarId)
  const params = new URLSearchParams()
  if (event.conferenceDataVersion) {
    params.set('conferenceDataVersion', String(event.conferenceDataVersion))
  }

  const url = `${CALENDAR_API_BASE}/calendars/${encodedCalId}/events?${params.toString()}`

  logger.info('[google-workspace] Creating calendar event', {
    calendarId,
    summary: event.summary,
    attendeeCount: event.attendees?.length ?? 0,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Create event failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Calendar create event failed: ${res.status}`)
  }

  const data = (await res.json()) as GoogleCalendarEvent
  logger.info('[google-workspace] Calendar event created', { eventId: data.id })
  return data
}

/**
 * Delete (cancel) a calendar event.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const encodedCalId = encodeURIComponent(calendarId)
  const encodedEventId = encodeURIComponent(eventId)
  const url = `${CALENDAR_API_BASE}/calendars/${encodedCalId}/events/${encodedEventId}`

  logger.info('[google-workspace] Deleting calendar event', { calendarId, eventId })

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // 204 No Content = success, 410 Gone = already deleted
  if (!res.ok && res.status !== 410) {
    const errorBody = await res.text()
    logger.error('[google-workspace] Delete event failed', {
      status: res.status,
      body: errorBody,
    })
    throw new Error(`Google Calendar delete event failed: ${res.status}`)
  }

  logger.info('[google-workspace] Calendar event deleted', { eventId })
}
