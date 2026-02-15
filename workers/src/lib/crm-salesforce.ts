/**
 * Salesforce REST API Client
 *
 * OAuth 2.0 flow + data operations for the CRM integration.
 * Uses raw fetch() — no NPM SDKs — to keep the Workers bundle small.
 *
 * Never logs tokens or secrets.
 *
 * @module crm-salesforce
 */

import { logger } from './logger'

// ── Constants ──────────────────────────────────────────────

const SF_LOGIN_URL = 'https://login.salesforce.com'
const SF_API_VERSION = 'v59.0'

// ── Types ──────────────────────────────────────────────────

export interface SalesforceAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface SalesforceTokenResponse {
  access_token: string
  refresh_token: string
  /** e.g. https://yourorg.my.salesforce.com */
  instance_url: string
  token_type: string
  /** Identity URL */
  id: string
  issued_at: string
}

export interface SalesforceContact {
  Id: string
  FirstName: string | null
  LastName: string
  Email: string | null
  Phone: string | null
  [key: string]: any
}

export interface SalesforceDeal {
  Id: string
  Name: string
  StageName: string
  Amount: number | null
  [key: string]: any
}

export interface SalesforceTask {
  Id: string
  Subject: string
  [key: string]: any
}

export interface SalesforceError {
  errorCode: string
  message: string
  fields?: string[]
}

export interface SoqlResult<T = any> {
  totalSize: number
  done: boolean
  nextRecordsUrl?: string
  records: T[]
}

// ── Error Class ────────────────────────────────────────────

export class SalesforceApiError extends Error {
  public readonly statusCode: number
  public readonly errors: SalesforceError[]

  constructor(statusCode: number, errors: SalesforceError[]) {
    const summary = errors.map((e) => `[${e.errorCode}] ${e.message}`).join('; ')
    super(`Salesforce API error ${statusCode}: ${summary}`)
    this.name = 'SalesforceApiError'
    this.statusCode = statusCode
    this.errors = errors
  }
}

// ── Internal Helpers ───────────────────────────────────────

/**
 * Parse a Salesforce error response body into structured errors.
 * SF returns either a JSON array of `{ errorCode, message }` or a
 * single `{ error, error_description }` object for OAuth errors.
 */
async function parseSfError(res: Response): Promise<SalesforceError[]> {
  try {
    const body = await res.json()
    // OAuth error shape
    if (body && typeof body === 'object' && 'error' in body) {
      return [{ errorCode: (body as any).error, message: (body as any).error_description ?? '' }]
    }
    // Standard REST API error shape (array)
    if (Array.isArray(body)) {
      return body.map((e: any) => ({
        errorCode: e.errorCode ?? 'UNKNOWN',
        message: e.message ?? '',
        fields: e.fields,
      }))
    }
    return [{ errorCode: 'UNKNOWN', message: JSON.stringify(body) }]
  } catch {
    return [{ errorCode: 'PARSE_ERROR', message: `HTTP ${res.status} — could not parse body` }]
  }
}

/**
 * Make an authenticated request to the Salesforce REST API.
 * Throws `SalesforceApiError` on non-2xx responses.
 */
async function sfFetch<T>(
  instanceUrl: string,
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${instanceUrl}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  })

  if (!res.ok) {
    const errors = await parseSfError(res)
    logger.error('Salesforce API request failed', {
      path,
      status: res.status,
      errors: errors.map((e) => e.errorCode),
    })
    throw new SalesforceApiError(res.status, errors)
  }

  // 204 No Content
  if (res.status === 204) return {} as T

  return (await res.json()) as T
}

// ── OAuth Flow ─────────────────────────────────────────────

/**
 * Build the Salesforce OAuth 2.0 authorization URL.
 * Redirect the user's browser here to start the consent flow.
 */
export function getSalesforceAuthUrl(config: SalesforceAuthConfig): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'full refresh_token',
  })
  return `${SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 *
 * @param config - OAuth client credentials
 * @param code  - Authorization code from the callback
 * @returns Token response including `instance_url`
 */
export async function exchangeSalesforceCode(
  config: SalesforceAuthConfig,
  code: string,
): Promise<SalesforceTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  })

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errors = await parseSfError(res)
    logger.error('Salesforce OAuth code exchange failed', { status: res.status })
    throw new SalesforceApiError(res.status, errors)
  }

  const token = (await res.json()) as SalesforceTokenResponse
  logger.info('Salesforce OAuth code exchanged successfully')
  return token
}

/**
 * Refresh an expired access token using a refresh token.
 *
 * @param config       - OAuth client credentials
 * @param refreshToken - Previously issued refresh token
 * @returns New token response (may not include a new `refresh_token`)
 */
export async function refreshSalesforceToken(
  config: SalesforceAuthConfig,
  refreshToken: string,
): Promise<SalesforceTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  })

  const res = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errors = await parseSfError(res)
    logger.error('Salesforce OAuth token refresh failed', { status: res.status })
    throw new SalesforceApiError(res.status, errors)
  }

  const token = (await res.json()) as SalesforceTokenResponse
  logger.info('Salesforce access token refreshed')
  return token
}

// ── SOQL Queries ───────────────────────────────────────────

/**
 * Execute a SOQL query against the Salesforce REST API.
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param query       - SOQL query string
 * @returns Query result with `records`, `totalSize`, and pagination info
 */
export async function soqlQuery<T = any>(
  instanceUrl: string,
  accessToken: string,
  query: string,
): Promise<SoqlResult<T>> {
  const encoded = encodeURIComponent(query)
  return sfFetch<SoqlResult<T>>(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/query?q=${encoded}`,
  )
}

/**
 * Continue a paginated SOQL query using the `nextRecordsUrl`.
 *
 * @param instanceUrl    - Salesforce org instance URL
 * @param accessToken    - Valid access token
 * @param nextRecordsUrl - URL returned from a previous query result
 * @returns Next page of query results
 */
export async function soqlQueryMore<T = any>(
  instanceUrl: string,
  accessToken: string,
  nextRecordsUrl: string,
): Promise<SoqlResult<T>> {
  return sfFetch<SoqlResult<T>>(instanceUrl, accessToken, nextRecordsUrl)
}

// ── Contacts ───────────────────────────────────────────────

const DEFAULT_CONTACT_FIELDS = ['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'AccountId']

/**
 * List contacts via SOQL. Supports delta sync using `modifiedSince`.
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param options     - Pagination, field selection, and delta filtering
 * @returns Array of contacts
 */
export async function listSalesforceContacts(
  instanceUrl: string,
  accessToken: string,
  options?: {
    limit?: number
    offset?: number
    fields?: string[]
    /** ISO 8601 date — only return contacts modified after this date */
    modifiedSince?: string
  },
): Promise<SalesforceContact[]> {
  const fields = (options?.fields ?? DEFAULT_CONTACT_FIELDS).join(', ')
  let soql = `SELECT ${fields} FROM Contact`

  if (options?.modifiedSince) {
    soql += ` WHERE LastModifiedDate > ${options.modifiedSince}`
  }

  soql += ' ORDER BY LastModifiedDate DESC'

  if (options?.limit) {
    soql += ` LIMIT ${options.limit}`
  }
  if (options?.offset) {
    soql += ` OFFSET ${options.offset}`
  }

  const result = await soqlQuery<SalesforceContact>(instanceUrl, accessToken, soql)
  return result.records
}

/**
 * Search for contacts by email or phone using Salesforce SOSL.
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param query       - Search string (email, phone, or name fragment)
 * @returns Matching contacts
 */
export async function searchSalesforceContacts(
  instanceUrl: string,
  accessToken: string,
  query: string,
): Promise<SalesforceContact[]> {
  // Escape SOSL special characters
  const sanitized = query.replace(/[?&|!{}[\]()^~*:\\"'+\-]/g, '\\$&')
  const sosl = `FIND {${sanitized}} IN ALL FIELDS RETURNING Contact(Id, FirstName, LastName, Email, Phone)`
  const encoded = encodeURIComponent(sosl)

  const result = await sfFetch<{ searchRecords: SalesforceContact[] }>(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/search/?q=${encoded}`,
  )

  return result.searchRecords ?? []
}

// ── Deals (Opportunities) ──────────────────────────────────

const DEFAULT_DEAL_FIELDS = ['Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'AccountId']

/**
 * List Salesforce Opportunities (deals).
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param options     - Pagination and field selection
 * @returns Array of opportunities
 */
export async function listSalesforceDeals(
  instanceUrl: string,
  accessToken: string,
  options?: {
    limit?: number
    offset?: number
    fields?: string[]
  },
): Promise<SalesforceDeal[]> {
  const fields = (options?.fields ?? DEFAULT_DEAL_FIELDS).join(', ')
  let soql = `SELECT ${fields} FROM Opportunity ORDER BY LastModifiedDate DESC`

  if (options?.limit) {
    soql += ` LIMIT ${options.limit}`
  }
  if (options?.offset) {
    soql += ` OFFSET ${options.offset}`
  }

  const result = await soqlQuery<SalesforceDeal>(instanceUrl, accessToken, soql)
  return result.records
}

// ── Tasks (Call Logging) ───────────────────────────────────

/**
 * Create a Task record in Salesforce to log a call.
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param data        - Task fields (subject, description, linked IDs, call metadata)
 * @returns The created Task record with its Id
 */
export async function createSalesforceTask(
  instanceUrl: string,
  accessToken: string,
  data: {
    subject: string
    description: string
    /** Contact or Lead ID to link the task to */
    whoId?: string
    /** Account or Opportunity ID to link the task to */
    whatId?: string
    status: string
    priority: string
    callDurationInSeconds?: number
    callDisposition?: string
    /** 'Inbound' | 'Outbound' | 'Internal' */
    callType?: string
  },
): Promise<SalesforceTask> {
  const taskBody: Record<string, any> = {
    Subject: data.subject,
    Description: data.description,
    Status: data.status,
    Priority: data.priority,
    TaskSubtype: 'Call',
    Type: 'Call',
  }

  if (data.whoId) taskBody.WhoId = data.whoId
  if (data.whatId) taskBody.WhatId = data.whatId
  if (data.callDurationInSeconds != null) taskBody.CallDurationInSeconds = data.callDurationInSeconds
  if (data.callDisposition) taskBody.CallDisposition = data.callDisposition
  if (data.callType) taskBody.CallType = data.callType

  const createResult = await sfFetch<{ id: string; success: boolean; errors: any[] }>(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/sobjects/Task`,
    { method: 'POST', body: JSON.stringify(taskBody) },
  )

  logger.info('Salesforce Task created', { taskId: createResult.id })

  return { Id: createResult.id, Subject: data.subject } as SalesforceTask
}

// ── Object Describe (Field Discovery) ──────────────────────

/**
 * Retrieve metadata about a Salesforce object's fields.
 * Useful for building field-mapping UIs.
 *
 * @param instanceUrl - Salesforce org instance URL
 * @param accessToken - Valid access token
 * @param objectType  - SObject API name (e.g. "Contact", "Opportunity")
 * @returns Array of field descriptors
 */
export async function describeSalesforceObject(
  instanceUrl: string,
  accessToken: string,
  objectType: string,
): Promise<
  Array<{
    name: string
    label: string
    type: string
    updateable: boolean
    nillable: boolean
  }>
> {
  const result = await sfFetch<{ fields: any[] }>(
    instanceUrl,
    accessToken,
    `/services/data/${SF_API_VERSION}/sobjects/${encodeURIComponent(objectType)}/describe`,
  )

  return result.fields.map((f: any) => ({
    name: f.name,
    label: f.label,
    type: f.type,
    updateable: f.updateable,
    nillable: f.nillable,
  }))
}
