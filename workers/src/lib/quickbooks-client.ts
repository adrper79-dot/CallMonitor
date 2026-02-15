/**
 * QuickBooks Online API Client for Cloudflare Workers
 *
 * Auto-generate invoices from call logs for BPO/collections call centers
 * that bill by the hour/call. Uses raw fetch() — no NPM SDKs.
 *
 * QuickBooks API uses minor version param (minorversion=73).
 * All requests require Accept/Content-Type: application/json + Bearer token.
 *
 * @see https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice
 */

import { logger } from './logger'

// ── Constants ────────────────────────────────────────────────────────────────

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
const QBO_MINOR_VERSION = 73
const QBO_SCOPES = 'com.intuit.quickbooks.accounting'

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuickBooksAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  environment: 'sandbox' | 'production'
}

export interface QuickBooksTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  x_refresh_token_expires_in: number
}

export interface QuickBooksCustomer {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  CompanyName?: string
}

export interface QuickBooksInvoice {
  Id: string
  DocNumber: string
  TotalAmt: number
  Balance: number
  DueDate: string
  CustomerRef: { value: string; name: string }
}

export interface QuickBooksLineItem {
  DetailType: 'SalesItemLineDetail'
  Amount: number
  Description: string
  SalesItemLineDetail: {
    ItemRef: { value: string; name: string }
    Qty: number
    UnitPrice: number
  }
}

/** Structured error from QuickBooks API responses */
export interface QuickBooksApiError {
  code: string
  message: string
  detail?: string
  element?: string
}

// ── Error Handling ───────────────────────────────────────────────────────────

export class QuickBooksError extends Error {
  public readonly statusCode: number
  public readonly qbErrors: QuickBooksApiError[]
  public readonly intuitTid?: string

  constructor(message: string, statusCode: number, qbErrors: QuickBooksApiError[] = [], intuitTid?: string) {
    super(message)
    this.name = 'QuickBooksError'
    this.statusCode = statusCode
    this.qbErrors = qbErrors
    this.intuitTid = intuitTid
  }
}

/**
 * Parse a QuickBooks error response. QBO returns errors in a Fault object:
 * { Fault: { Error: [{ Message, Detail, code, element }], type } }
 */
async function parseQBErrorResponse(res: Response): Promise<QuickBooksError> {
  const intuitTid = res.headers.get('intuit_tid') || undefined
  let body: any

  try {
    body = await res.json()
  } catch {
    return new QuickBooksError(
      `QuickBooks API error: HTTP ${res.status}`,
      res.status,
      [],
      intuitTid
    )
  }

  const fault = body?.Fault
  if (fault?.Error && Array.isArray(fault.Error)) {
    const qbErrors: QuickBooksApiError[] = fault.Error.map((e: any) => ({
      code: e.code || 'UNKNOWN',
      message: e.Message || 'Unknown error',
      detail: e.Detail || undefined,
      element: e.element || undefined,
    }))

    const primaryMessage = qbErrors[0]?.message || 'QuickBooks API error'
    return new QuickBooksError(
      `QuickBooks: ${primaryMessage} (HTTP ${res.status})`,
      res.status,
      qbErrors,
      intuitTid
    )
  }

  // Fallback for non-Fault error shapes (e.g. OAuth errors)
  const errorDesc = body?.error_description || body?.error || `HTTP ${res.status}`
  return new QuickBooksError(
    `QuickBooks: ${errorDesc}`,
    res.status,
    [{ code: body?.error || 'UNKNOWN', message: errorDesc }],
    intuitTid
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the QuickBooks API base URL for the given environment.
 */
export function getQuickBooksBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

/**
 * Build standard headers for QuickBooks API requests.
 */
function qbHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

/**
 * Append minorversion query parameter to a URL.
 */
function withMinorVersion(url: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}minorversion=${QBO_MINOR_VERSION}`
}

// ── OAuth Flow ───────────────────────────────────────────────────────────────

/**
 * Generate the QuickBooks OAuth2 authorization URL.
 * Redirect the user here to begin the OAuth connect flow.
 */
export function getQuickBooksAuthUrl(config: QuickBooksAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: QBO_SCOPES,
    state: crypto.randomUUID(),
  })

  return `${QBO_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 *
 * @param config  - QuickBooks auth configuration
 * @param code    - Authorization code from the OAuth callback
 * @param realmId - The QuickBooks company ID (realmId) from the callback
 * @returns Token response with the realmId attached
 */
export async function exchangeQuickBooksCode(
  config: QuickBooksAuthConfig,
  code: string,
  realmId: string
): Promise<QuickBooksTokenResponse & { realmId: string }> {
  logger.info('Exchanging QuickBooks auth code', { realmId })

  const basicAuth = btoa(`${config.clientId}:${config.clientSecret}`)

  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }).toString(),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks code exchange failed', {
      statusCode: err.statusCode,
      error: err.message,
      intuitTid: err.intuitTid,
    })
    throw err
  }

  const tokens: QuickBooksTokenResponse = await res.json()
  logger.info('QuickBooks code exchange successful', { realmId })

  return { ...tokens, realmId }
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshQuickBooksToken(
  config: QuickBooksAuthConfig,
  refreshToken: string
): Promise<QuickBooksTokenResponse> {
  logger.info('Refreshing QuickBooks access token')

  const basicAuth = btoa(`${config.clientId}:${config.clientSecret}`)

  const res = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks token refresh failed', {
      statusCode: err.statusCode,
      error: err.message,
    })
    throw err
  }

  const tokens: QuickBooksTokenResponse = await res.json()
  logger.info('QuickBooks token refresh successful')

  return tokens
}

/**
 * Revoke a QuickBooks OAuth token (access or refresh).
 */
export async function revokeQuickBooksToken(
  config: QuickBooksAuthConfig,
  token: string
): Promise<void> {
  logger.info('Revoking QuickBooks token')

  const basicAuth = btoa(`${config.clientId}:${config.clientSecret}`)

  const res = await fetch(QBO_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ token }),
  })

  if (!res.ok) {
    // Revocation failures are non-fatal — log but don't throw
    logger.warn('QuickBooks token revocation failed', {
      statusCode: res.status,
    })
  } else {
    logger.info('QuickBooks token revoked successfully')
  }
}

// ── Customers ────────────────────────────────────────────────────────────────

/**
 * List all customers in the QuickBooks company.
 */
export async function listQuickBooksCustomers(
  baseUrl: string,
  accessToken: string,
  realmId: string
): Promise<QuickBooksCustomer[]> {
  const query = encodeURIComponent('SELECT * FROM Customer MAXRESULTS 1000')
  const url = withMinorVersion(`${baseUrl}/v3/company/${realmId}/query?query=${query}`)

  const res = await fetch(url, {
    method: 'GET',
    headers: qbHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks list customers failed', {
      realmId,
      statusCode: err.statusCode,
      error: err.message,
    })
    throw err
  }

  const data: any = await res.json()
  return (data?.QueryResponse?.Customer || []) as QuickBooksCustomer[]
}

/**
 * Find a customer by display name or email.
 */
export async function findQuickBooksCustomer(
  baseUrl: string,
  accessToken: string,
  realmId: string,
  query: string
): Promise<QuickBooksCustomer | null> {
  // Escape single quotes in the query value
  const escaped = query.replace(/'/g, "\\'")
  const sql = encodeURIComponent(
    `SELECT * FROM Customer WHERE DisplayName LIKE '%${escaped}%' MAXRESULTS 1`
  )
  const url = withMinorVersion(`${baseUrl}/v3/company/${realmId}/query?query=${sql}`)

  const res = await fetch(url, {
    method: 'GET',
    headers: qbHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks find customer failed', {
      realmId,
      statusCode: err.statusCode,
      error: err.message,
    })
    throw err
  }

  const data: any = await res.json()
  const customers = data?.QueryResponse?.Customer || []
  return customers.length > 0 ? (customers[0] as QuickBooksCustomer) : null
}

/**
 * Create a new customer in QuickBooks.
 */
export async function createQuickBooksCustomer(
  baseUrl: string,
  accessToken: string,
  realmId: string,
  data: {
    displayName: string
    email?: string
    phone?: string
    companyName?: string
  }
): Promise<QuickBooksCustomer> {
  const url = withMinorVersion(`${baseUrl}/v3/company/${realmId}/customer`)

  const body: Record<string, unknown> = {
    DisplayName: data.displayName,
  }
  if (data.email) body.PrimaryEmailAddr = { Address: data.email }
  if (data.phone) body.PrimaryPhone = { FreeFormNumber: data.phone }
  if (data.companyName) body.CompanyName = data.companyName

  const res = await fetch(url, {
    method: 'POST',
    headers: qbHeaders(accessToken),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks create customer failed', {
      realmId,
      statusCode: err.statusCode,
      error: err.message,
    })
    throw err
  }

  const result: any = await res.json()
  logger.info('QuickBooks customer created', {
    realmId,
    customerId: result?.Customer?.Id,
  })

  return result.Customer as QuickBooksCustomer
}

// ── Invoices ─────────────────────────────────────────────────────────────────

/**
 * Create an invoice in QuickBooks.
 */
export async function createQuickBooksInvoice(
  baseUrl: string,
  accessToken: string,
  realmId: string,
  data: {
    customerId: string
    lineItems: QuickBooksLineItem[]
    dueDate?: string
    notes?: string
    docNumber?: string
  }
): Promise<QuickBooksInvoice> {
  const url = withMinorVersion(`${baseUrl}/v3/company/${realmId}/invoice`)

  const body: Record<string, unknown> = {
    CustomerRef: { value: data.customerId },
    Line: data.lineItems,
  }
  if (data.dueDate) body.DueDate = data.dueDate
  if (data.notes) body.CustomerMemo = { value: data.notes }
  if (data.docNumber) body.DocNumber = data.docNumber

  const res = await fetch(url, {
    method: 'POST',
    headers: qbHeaders(accessToken),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks create invoice failed', {
      realmId,
      statusCode: err.statusCode,
      error: err.message,
      intuitTid: err.intuitTid,
    })
    throw err
  }

  const result: any = await res.json()
  logger.info('QuickBooks invoice created', {
    realmId,
    invoiceId: result?.Invoice?.Id,
    docNumber: result?.Invoice?.DocNumber,
    totalAmt: result?.Invoice?.TotalAmt,
  })

  return result.Invoice as QuickBooksInvoice
}

/**
 * List invoices with optional filters.
 */
export async function listQuickBooksInvoices(
  baseUrl: string,
  accessToken: string,
  realmId: string,
  options?: {
    customerId?: string
    startDate?: string
    endDate?: string
  }
): Promise<QuickBooksInvoice[]> {
  const clauses: string[] = []

  if (options?.customerId) {
    clauses.push(`CustomerRef = '${options.customerId}'`)
  }
  if (options?.startDate) {
    clauses.push(`TxnDate >= '${options.startDate}'`)
  }
  if (options?.endDate) {
    clauses.push(`TxnDate <= '${options.endDate}'`)
  }

  let sql = 'SELECT * FROM Invoice'
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' AND ')}`
  }
  sql += ' ORDERBY TxnDate DESC MAXRESULTS 100'

  const url = withMinorVersion(
    `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(sql)}`
  )

  const res = await fetch(url, {
    method: 'GET',
    headers: qbHeaders(accessToken),
  })

  if (!res.ok) {
    const err = await parseQBErrorResponse(res)
    logger.error('QuickBooks list invoices failed', {
      realmId,
      statusCode: err.statusCode,
      error: err.message,
    })
    throw err
  }

  const data: any = await res.json()
  return (data?.QueryResponse?.Invoice || []) as QuickBooksInvoice[]
}

// ── Call Data → Invoice Line Items ───────────────────────────────────────────

/**
 * Build QuickBooks invoice line items from call log data.
 *
 * Converts raw call records into billable line items using a per-minute rate.
 * Each call becomes a separate line item with duration, caller ID, and disposition.
 *
 * @param calls          - Array of call records from the calls table
 * @param ratePerMinute  - Billing rate per minute (e.g. 0.75 = $0.75/min)
 * @returns Array of QuickBooks-compatible line items
 */
export function buildCallInvoiceLineItems(
  calls: Array<{
    id: string
    duration_seconds: number
    caller_id: string
    started_at: string
    disposition: string
  }>,
  ratePerMinute: number
): QuickBooksLineItem[] {
  return calls.map((call) => {
    const minutes = Math.ceil(call.duration_seconds / 60) // Round up to nearest minute
    const amount = parseFloat((minutes * ratePerMinute).toFixed(2))
    const callDate = new Date(call.started_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    return {
      DetailType: 'SalesItemLineDetail' as const,
      Amount: amount,
      Description: `Call ${call.caller_id} — ${callDate} — ${minutes} min — ${call.disposition}`,
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' }, // Default "Services" item
        Qty: minutes,
        UnitPrice: ratePerMinute,
      },
    }
  })
}
