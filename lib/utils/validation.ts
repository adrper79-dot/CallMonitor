/**
 * Input Validation Utilities
 * 
 * Per ARCH_DOCS: Validate early, fail fast with clear error messages
 */

// UUID v4 regex pattern (matches lowercase and uppercase)
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validates if a string is a valid UUID v4 format
 */
export function isValidUUID(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false
  return UUID_V4_REGEX.test(value)
}

/**
 * Validates if a string is a valid email format
 */
export function isValidEmail(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false
  // Simple email regex - covers most cases
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Validates if a string is a valid phone number (E.164 format)
 */
export function isValidPhone(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false
  // E.164 format: +[country code][number], 10-15 digits total
  return /^\+[1-9]\d{9,14}$/.test(value)
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 */
export function sanitizeString(value: string, maxLength: number = 1000): string {
  if (!value || typeof value !== 'string') return ''
  // Remove null bytes and control characters, trim, and limit length
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength)
}

/**
 * Validates if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates if a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Validates if a value is a valid ISO date string
 */
export function isValidISODate(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') return false
  const date = new Date(value)
  return !isNaN(date.getTime()) && date.toISOString() === value
}
