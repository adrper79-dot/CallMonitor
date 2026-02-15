import type { Env } from '../index'
import { logger } from './logger'

// ─── Types ───────────────────────────────────────────────────────────────────

/** OAuth token payload stored encrypted in KV */
export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number // epoch ms
  token_type: string
  scope?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Fixed salt for PBKDF2 key derivation (deterministic across encrypt/decrypt) */
const PBKDF2_SALT = new Uint8Array([
  0x57, 0x6f, 0x72, 0x64, 0x49, 0x73, 0x42, 0x6f,
  0x6e, 0x64, 0x43, 0x52, 0x4d, 0x4b, 0x65, 0x79,
]) // "WordIsBondCRMKey" in hex

const PBKDF2_ITERATIONS = 100_000
const IV_LENGTH = 12 // 96-bit IV for AES-GCM
const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

// ─── Key Helpers ─────────────────────────────────────────────────────────────

/**
 * Build the KV key for a given org + CRM type.
 * Format: `crm:tokens:{org_id}:{crm_type}`
 */
function kvKey(orgId: string, crmType: string): string {
  return `crm:tokens:${orgId}:${crmType}`
}

// ─── Crypto Internals ────────────────────────────────────────────────────────

/**
 * Derive an AES-256-GCM CryptoKey from raw key material via PBKDF2.
 * Uses a fixed salt so the same material always yields the same key.
 */
async function deriveKey(keyMaterial: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyMaterial),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * 1. Derives a CryptoKey from `keyMaterial` using PBKDF2 + fixed salt.
 * 2. Generates a random 12-byte IV.
 * 3. Encrypts the data with AES-GCM.
 * 4. Returns `base64(iv ‖ ciphertext)`.
 *
 * @param data - Plaintext to encrypt
 * @param keyMaterial - Raw encryption key (≥ 32 chars, from CRM_ENCRYPTION_KEY)
 * @returns Base64-encoded `iv + ciphertext`
 */
async function encrypt(data: string, keyMaterial: string): Promise<string> {
  const key = await deriveKey(keyMaterial)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const enc = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data),
  )

  // Concatenate IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)

  // Base64-encode the combined buffer
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64-encoded `iv + ciphertext` payload with AES-256-GCM.
 *
 * 1. Derives the same CryptoKey from `keyMaterial`.
 * 2. Extracts the first 12 bytes as IV, remainder as ciphertext.
 * 3. Decrypts with AES-GCM.
 * 4. Returns the original plaintext string.
 *
 * @param encrypted - Base64 string produced by `encrypt()`
 * @param keyMaterial - Same raw key used for encryption
 * @returns Original plaintext
 */
async function decrypt(encrypted: string, keyMaterial: string): Promise<string> {
  const key = await deriveKey(keyMaterial)

  // Decode base64 → Uint8Array
  const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))

  const iv = raw.slice(0, IV_LENGTH)
  const ciphertext = raw.slice(IV_LENGTH)

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  return new TextDecoder().decode(plainBuf)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypt and store OAuth tokens in Cloudflare KV.
 *
 * Tokens are AES-256-GCM encrypted before storage — raw tokens never touch
 * the database or logs.
 *
 * @param env    - Worker environment (must include `KV` and `CRM_ENCRYPTION_KEY`)
 * @param orgId  - Organisation ID (multi-tenant isolation)
 * @param crmType - CRM provider identifier (e.g. `salesforce`, `hubspot`)
 * @param tokens - OAuth token payload to store
 * @returns The KV key under which the tokens were stored
 * @throws If `CRM_ENCRYPTION_KEY` is missing or too short
 */
export async function storeTokens(
  env: Env,
  orgId: string,
  crmType: string,
  tokens: OAuthTokens,
): Promise<string> {
  const encryptionKey = (env as unknown as Record<string, unknown>).CRM_ENCRYPTION_KEY as string | undefined
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('CRM_ENCRYPTION_KEY must be set and at least 32 characters')
  }

  const key = kvKey(orgId, crmType)
  const plaintext = JSON.stringify(tokens)
  const ciphertext = await encrypt(plaintext, encryptionKey)

  await env.KV.put(key, ciphertext, {
    // Auto-expire KV entry 90 days after last write as a safety net
    expirationTtl: 90 * 24 * 60 * 60,
  })

  logger.info('CRM tokens stored', {
    orgId,
    crmType,
    kvKey: key,
    expiresAt: new Date(tokens.expires_at).toISOString(),
  })

  return key
}

/**
 * Retrieve and decrypt OAuth tokens from Cloudflare KV.
 *
 * Returns `null` if no tokens exist for the given org + CRM type.
 *
 * @param env     - Worker environment
 * @param orgId   - Organisation ID
 * @param crmType - CRM provider identifier
 * @returns Decrypted token payload, or `null` if not found
 * @throws If decryption fails (e.g. key rotation mismatch)
 */
export async function getTokens(
  env: Env,
  orgId: string,
  crmType: string,
): Promise<OAuthTokens | null> {
  const encryptionKey = (env as unknown as Record<string, unknown>).CRM_ENCRYPTION_KEY as string | undefined
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('CRM_ENCRYPTION_KEY must be set and at least 32 characters')
  }

  const key = kvKey(orgId, crmType)
  const ciphertext = await env.KV.get(key)

  if (!ciphertext) {
    logger.debug('No CRM tokens found', { orgId, crmType, kvKey: key })
    return null
  }

  try {
    const plaintext = await decrypt(ciphertext, encryptionKey)
    const tokens: OAuthTokens = JSON.parse(plaintext)

    logger.debug('CRM tokens retrieved', {
      orgId,
      crmType,
      kvKey: key,
      expiresAt: new Date(tokens.expires_at).toISOString(),
      isExpired: isTokenExpired(tokens),
    })

    return tokens
  } catch (err) {
    logger.error('Failed to decrypt CRM tokens', {
      orgId,
      crmType,
      kvKey: key,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    throw new Error(`Failed to decrypt CRM tokens for ${crmType}: token data may be corrupted or key may have rotated`)
  }
}

/**
 * Delete OAuth tokens from Cloudflare KV.
 *
 * Idempotent — succeeds even if the key does not exist.
 *
 * @param env     - Worker environment
 * @param orgId   - Organisation ID
 * @param crmType - CRM provider identifier
 */
export async function deleteTokens(
  env: Env,
  orgId: string,
  crmType: string,
): Promise<void> {
  const key = kvKey(orgId, crmType)
  await env.KV.delete(key)

  logger.info('CRM tokens deleted', { orgId, crmType, kvKey: key })
}

/**
 * Check whether an OAuth token payload has expired.
 *
 * Applies a 5-minute buffer so callers can proactively refresh before
 * the token actually expires.
 *
 * @param tokens - Token payload to check
 * @returns `true` if the token is expired or will expire within 5 minutes
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  return Date.now() >= tokens.expires_at - EXPIRY_BUFFER_MS
}
