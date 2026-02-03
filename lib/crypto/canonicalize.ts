import crypto from 'node:crypto'

/**
 * Canonical JSON Serialization for Cryptographic Hashing
 * 
 * Ensures deterministic output regardless of key insertion order.
 * Required for hash reproducibility per SYSTEM_OF_RECORD_COMPLIANCE.
 * 
 * Used by:
 * - Evidence manifests (immutable hash)
 * - Evidence bundles (bundle_hash)
 * - Transcript versions (transcript_hash)
 * 
 * Per ARCH_DOCS/01-CORE/THE_FINAL_ARCHITECTURE_MINIMAL_ADDITIONS.md:
 * "Use deterministic JSON serialization: stable key ordering (lexicographic)"
 */

/**
 * Recursively sort object keys for deterministic serialization
 */
export function sortObject(value: any): any {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(sortObject)
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    const sorted: Record<string, any> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObject(value[key])
    }
    return sorted
  }

  return value
}

/**
 * Convert value to canonical JSON string
 * 
 * Properties:
 * - Keys sorted lexicographically at all levels
 * - No whitespace variance
 * - Strict UTF-8
 */
export function stableStringify(value: any): string {
  return JSON.stringify(sortObject(value))
}

/**
 * Compute hash of canonicalized payload
 * 
 * @param payload - Any JSON-serializable value
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Hex-encoded hash string
 */
export function hashPayload(payload: any, algorithm: string = 'sha256'): string {
  const canonical = stableStringify(payload)
  return crypto.createHash(algorithm).update(canonical, 'utf8').digest('hex')
}

/**
 * Compute hash with algorithm prefix
 * 
 * @param payload - Any JSON-serializable value
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Prefixed hash string (e.g., "sha256:abc123...")
 */
export function hashPayloadPrefixed(payload: any, algorithm: string = 'sha256'): string {
  const hash = hashPayload(payload, algorithm)
  return `${algorithm}:${hash}`
}

/**
 * Verify that a payload matches an expected hash
 * 
 * @param payload - Value to verify
 * @param expectedHash - Expected hash (with or without algorithm prefix)
 * @returns True if hash matches
 */
export function verifyHash(payload: any, expectedHash: string): boolean {
  // Parse algorithm from prefix if present
  const match = expectedHash.match(/^(\w+):(.+)$/)
  const algorithm = match ? match[1] : 'sha256'
  const hashValue = match ? match[2] : expectedHash

  const computed = hashPayload(payload, algorithm)

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(hashValue)
    )
  } catch {
    // Length mismatch
    return computed === hashValue
  }
}
