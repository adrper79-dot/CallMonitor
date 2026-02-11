/**
 * PII Redaction Layer - Protect sensitive data before sending to AI providers
 *
 * Redacts personally identifiable information (PII) and protected health
 * information (PHI) from text before sending to external AI APIs.
 *
 * Compliance: HIPAA, GDPR, CCPA, SOC2
 *
 * @module workers/src/lib/pii-redactor
 */

import { logger } from './logger'

export interface RedactedEntity {
  type: string
  value: string
  start: number
  end: number
}

export interface RedactionResult {
  redacted: string
  original: string
  entities: RedactedEntity[]
  redactionCount: number
}

/**
 * PII patterns to detect and redact
 */
const PII_PATTERNS: Record<string, RegExp> = {
  // Financial
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g, // 123-45-6789
  ssn_no_dash: /\b\d{9}\b/g, // 123456789 (9 digits only)
  credit_card: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 4111-1111-1111-1111
  cvv: /\b\d{3,4}\b(?=\s*(cvv|cvc|security code))/gi, // 123 CVV

  // Contact information
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // (555) 123-4567
  phone_international: /\b\+\d{1,3}[-.\s]?\d{1,14}\b/g, // +1-555-123-4567

  // Dates (potential PHI)
  date_of_birth: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-]\d{2,4}\b/g, // 12/31/1990
  date_mmddyyyy: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,

  // Medical (HIPAA)
  medical_record: /\b(mrn|medical record|patient id|health id)[\s:]+[\w-]+\b/gi,

  // Addresses
  zip_code: /\b\d{5}(-\d{4})?\b/g, // 12345 or 12345-6789
  street_address: /\b\d+\s+[A-Za-z0-9\s,]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct)\b/gi,

  // Government IDs
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g, // A1234567
  drivers_license: /\b[A-Z]{1,2}\d{5,8}\b/g,

  // IP addresses (technical PII)
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // 192.168.1.1
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
}

/**
 * Replacement tokens for redacted entities
 */
const REDACTION_TOKENS: Record<string, string> = {
  ssn: '[REDACTED_SSN]',
  ssn_no_dash: '[REDACTED_SSN]',
  credit_card: '[REDACTED_CREDIT_CARD]',
  cvv: '[REDACTED_CVV]',
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
  phone_international: '[REDACTED_PHONE]',
  date_of_birth: '[REDACTED_DOB]',
  date_mmddyyyy: '[REDACTED_DATE]',
  medical_record: '[REDACTED_MEDICAL_ID]',
  zip_code: '[REDACTED_ZIP]',
  street_address: '[REDACTED_ADDRESS]',
  passport: '[REDACTED_PASSPORT]',
  drivers_license: '[REDACTED_DL]',
  ipv4: '[REDACTED_IP]',
  ipv6: '[REDACTED_IP]',
}

/**
 * Redact PII from text
 *
 * @param text - Text to redact
 * @param options - Redaction options
 * @returns RedactionResult with redacted text and entity list
 */
export function redactPII(
  text: string,
  options: {
    enabled?: boolean
    patterns?: string[] // Specific patterns to apply (default: all)
    preserveFormat?: boolean // Keep same text length with asterisks
  } = {}
): RedactionResult {
  const { enabled = true, patterns, preserveFormat = false } = options

  if (!enabled) {
    return {
      redacted: text,
      original: text,
      entities: [],
      redactionCount: 0,
    }
  }

  let redacted = text
  const entities: RedactedEntity[] = []

  // Determine which patterns to apply
  const patternsToApply = patterns || Object.keys(PII_PATTERNS)

  // Apply each pattern
  patternsToApply.forEach((patternName) => {
    const pattern = PII_PATTERNS[patternName]
    if (!pattern) return

    const matches = [...text.matchAll(pattern)]

    matches.forEach((match) => {
      if (!match[0]) return

      const value = match[0]
      const start = match.index || 0
      const end = start + value.length

      entities.push({
        type: patternName,
        value,
        start,
        end,
      })

      // Replace with redaction token
      const replacement = preserveFormat
        ? '*'.repeat(value.length)
        : REDACTION_TOKENS[patternName] || '[REDACTED]'

      redacted = redacted.replace(value, replacement)
    })
  })

  logger.debug('PII redaction complete', {
    original_length: text.length,
    redacted_length: redacted.length,
    entities_redacted: entities.length,
  })

  return {
    redacted,
    original: text,
    entities,
    redactionCount: entities.length,
  }
}

/**
 * Redact PII from multiple fields (batch operation)
 */
export function redactPIIBatch(
  fields: Record<string, string>,
  options?: Parameters<typeof redactPII>[1]
): Record<string, RedactionResult> {
  const results: Record<string, RedactionResult> = {}

  Object.entries(fields).forEach(([key, value]) => {
    results[key] = redactPII(value, options)
  })

  return results
}

/**
 * Check if text contains PII (without redacting)
 */
export function containsPII(text: string): {
  hasPII: boolean
  types: string[]
  count: number
} {
  const types = new Set<string>()
  let count = 0

  Object.entries(PII_PATTERNS).forEach(([patternName, pattern]) => {
    const matches = [...text.matchAll(pattern)]
    if (matches.length > 0) {
      types.add(patternName)
      count += matches.length
    }
  })

  return {
    hasPII: types.size > 0,
    types: Array.from(types),
    count,
  }
}

/**
 * Middleware: Redact PII from request body before AI processing
 */
export function redactRequestBody<T extends Record<string, any>>(
  body: T,
  fieldsToRedact: string[] = ['transcript', 'text', 'content', 'message']
): { redacted: T; redactionLog: RedactionResult[] } {
  const redacted = { ...body }
  const redactionLog: RedactionResult[] = []

  fieldsToRedact.forEach((field) => {
    if (typeof redacted[field] === 'string') {
      const result = redactPII(redacted[field])
      redacted[field] = result.redacted
      redactionLog.push(result)
    }
  })

  return { redacted, redactionLog }
}

/**
 * Get redaction statistics for audit logging
 */
export function getRedactionStats(results: RedactionResult[]): {
  totalEntities: number
  entitiesByType: Record<string, number>
  piiDetected: boolean
} {
  const entitiesByType: Record<string, number> = {}
  let totalEntities = 0

  results.forEach((result) => {
    totalEntities += result.entities.length

    result.entities.forEach((entity) => {
      entitiesByType[entity.type] = (entitiesByType[entity.type] || 0) + 1
    })
  })

  return {
    totalEntities,
    entitiesByType,
    piiDetected: totalEntities > 0,
  }
}

/**
 * Example usage for call transcripts
 */
export async function redactCallTranscript(
  transcript: string,
  orgId: string
): Promise<{ redacted: string; auditLog: any }> {
  const result = redactPII(transcript, {
    enabled: true,
    preserveFormat: false,
  })

  // Create audit log entry
  const auditLog = {
    org_id: orgId,
    action: 'PII_REDACTION',
    timestamp: new Date().toISOString(),
    entities_redacted: result.redactionCount,
    types: [...new Set(result.entities.map((e) => e.type))],
  }

  logger.info('Call transcript PII redaction', auditLog)

  return {
    redacted: result.redacted,
    auditLog,
  }
}
