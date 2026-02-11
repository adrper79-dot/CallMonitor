/**
 * Prompt Sanitization Layer - Prevent prompt injection attacks
 *
 * Sanitizes user input to prevent prompt injection, jailbreaking,
 * and other adversarial attacks on LLMs.
 *
 * Security Threats Mitigated:
 * - Instruction injection ("Ignore previous instructions...")
 * - Role manipulation ("You are now a different AI...")
 * - Delimiter injection (adding fake system/assistant messages)
 * - Token smuggling (special tokens that manipulate model behavior)
 * - Encoded payloads (base64, hex, unicode escapes)
 *
 * @module workers/src/lib/prompt-sanitizer
 */

import { logger } from './logger'

/**
 * Dangerous patterns that indicate prompt injection attempts
 */
const INJECTION_PATTERNS = [
  // Instruction manipulation
  /ignore\s+(previous|all|prior)\s+instructions?/gi,
  /disregard\s+(previous|all|prior)\s+instructions?/gi,
  /forget\s+(previous|all|prior)\s+instructions?/gi,
  /override\s+(previous|all|prior)\s+instructions?/gi,

  // Role manipulation
  /you\s+are\s+now\s+a?\s*\w+/gi,
  /act\s+as\s+a?\s*\w+/gi,
  /pretend\s+(to\s+be|you\s+are)\s+a?\s*\w+/gi,
  /roleplay\s+as/gi,

  // System/assistant injection (common delimiters)
  /system\s*:/gi,
  /assistant\s*:/gi,
  /user\s*:/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|endoftext\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<s>/gi,
  /<\/s>/gi,

  // Prompt leaking attempts
  /repeat\s+(your|the)\s+(instructions?|system\s+prompt)/gi,
  /what\s+(is|are)\s+your\s+(instructions?|system\s+prompt)/gi,
  /show\s+me\s+your\s+(instructions?|system\s+prompt)/gi,
  /print\s+(your|the)\s+prompt/gi,

  // Developer mode / jailbreak
  /developer\s+mode/gi,
  /jailbreak/gi,
  /bypass\s+restrictions?/gi,
  /enable\s+(dan|dev)\s+mode/gi,

  // Encoding tricks
  /base64\s*:/gi,
  /\\x[0-9a-fA-F]{2}/g, // Hex encoding
  /\\u[0-9a-fA-F]{4}/g, // Unicode escapes
]

/**
 * Suspicious keywords that warrant logging (but not blocking)
 */
const SUSPICIOUS_KEYWORDS = [
  'openai',
  'anthropic',
  'chatgpt',
  'gpt-4',
  'claude',
  'api key',
  'secret',
  'password',
  'token',
  'jailbreak',
  'prompt injection',
]

/**
 * Maximum allowed input length (tokens ~= chars/4)
 */
const MAX_INPUT_LENGTH = 4000 // ~1000 tokens

/**
 * Sanitize user input for AI processing
 *
 * @param input - User-provided text
 * @param options - Sanitization options
 * @returns Sanitized text
 */
export function sanitizePrompt(
  input: string,
  options: {
    enabled?: boolean
    maxLength?: number
    strictMode?: boolean // Block on suspicious patterns vs just log
    preserveNewlines?: boolean
  } = {}
): {
  sanitized: string
  blocked: boolean
  violations: string[]
  modified: boolean
} {
  const {
    enabled = true,
    maxLength = MAX_INPUT_LENGTH,
    strictMode = false,
    preserveNewlines = true,
  } = options

  if (!enabled) {
    return {
      sanitized: input,
      blocked: false,
      violations: [],
      modified: false,
    }
  }

  let sanitized = input
  const violations: string[] = []
  let modified = false

  // 1. Length check
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
    violations.push(`input_truncated_to_${maxLength}_chars`)
    modified = true
  }

  // 2. Remove null bytes and control characters (except newlines/tabs)
  const controlCharsRemoved = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  if (controlCharsRemoved !== sanitized) {
    sanitized = controlCharsRemoved
    violations.push('control_characters_removed')
    modified = true
  }

  // 3. Normalize whitespace (optional)
  if (!preserveNewlines) {
    const normalized = sanitized.replace(/\s+/g, ' ').trim()
    if (normalized !== sanitized) {
      sanitized = normalized
      violations.push('whitespace_normalized')
      modified = true
    }
  }

  // 4. Check for injection patterns
  INJECTION_PATTERNS.forEach((pattern) => {
    if (pattern.test(sanitized)) {
      const patternName = pattern.source.slice(0, 50) // First 50 chars of regex
      violations.push(`injection_pattern_detected:${patternName}`)

      // In strict mode, remove the matching text
      if (strictMode) {
        sanitized = sanitized.replace(pattern, '[REMOVED]')
        modified = true
      }
    }
  })

  // 5. Check for suspicious keywords (log only, don't block)
  const suspiciousFound: string[] = []
  SUSPICIOUS_KEYWORDS.forEach((keyword) => {
    if (sanitized.toLowerCase().includes(keyword.toLowerCase())) {
      suspiciousFound.push(keyword)
    }
  })

  if (suspiciousFound.length > 0) {
    violations.push(`suspicious_keywords:${suspiciousFound.join(',')}`)
  }

  // 6. Determine if input should be blocked
  const blocked = strictMode && violations.some((v) => v.startsWith('injection_pattern_detected'))

  logger.debug('Prompt sanitization complete', {
    input_length: input.length,
    sanitized_length: sanitized.length,
    violations_count: violations.length,
    blocked,
    modified,
  })

  return {
    sanitized,
    blocked,
    violations,
    modified,
  }
}

/**
 * Sanitize chat message array
 *
 * Useful for multi-turn conversations where each message needs sanitization
 */
export function sanitizeChatMessages(
  messages: Array<{ role: string; content: string }>,
  options?: Parameters<typeof sanitizePrompt>[1]
): {
  sanitized: Array<{ role: string; content: string }>
  violations: Record<number, string[]>
  blocked: boolean
} {
  const sanitized: Array<{ role: string; content: string }> = []
  const violations: Record<number, string[]> = {}
  let anyBlocked = false

  messages.forEach((message, index) => {
    // Only sanitize user messages (not system/assistant)
    if (message.role === 'user') {
      const result = sanitizePrompt(message.content, options)

      sanitized.push({
        role: message.role,
        content: result.sanitized,
      })

      if (result.violations.length > 0) {
        violations[index] = result.violations
      }

      if (result.blocked) {
        anyBlocked = true
      }
    } else {
      // Pass through system/assistant messages unchanged
      sanitized.push(message)
    }
  })

  return {
    sanitized,
    violations,
    blocked: anyBlocked,
  }
}

/**
 * Detect if input is likely a prompt injection attempt
 *
 * Used for monitoring/alerting without blocking
 */
export function isLikelyInjection(input: string): {
  isInjection: boolean
  confidence: number // 0.0 to 1.0
  reasons: string[]
} {
  const reasons: string[] = []
  let score = 0

  // Check each injection pattern
  INJECTION_PATTERNS.forEach((pattern) => {
    if (pattern.test(input)) {
      reasons.push(`matched_pattern:${pattern.source.slice(0, 30)}`)
      score += 0.2
    }
  })

  // Check for multiple suspicious keywords
  const suspiciousCount = SUSPICIOUS_KEYWORDS.filter((keyword) =>
    input.toLowerCase().includes(keyword.toLowerCase())
  ).length

  if (suspiciousCount >= 2) {
    reasons.push(`multiple_suspicious_keywords:${suspiciousCount}`)
    score += 0.3
  }

  // Check for excessive length (>3000 chars is unusual for normal input)
  if (input.length > 3000) {
    reasons.push('excessive_length')
    score += 0.1
  }

  // Check for encoded content
  if (/base64|\\x|\\u/.test(input)) {
    reasons.push('encoded_content')
    score += 0.2
  }

  const confidence = Math.min(score, 1.0)
  const isInjection = confidence >= 0.5

  return {
    isInjection,
    confidence,
    reasons,
  }
}

/**
 * Middleware helper: Sanitize request body fields
 */
export function sanitizeRequestFields<T extends Record<string, any>>(
  body: T,
  fields: string[] = ['message', 'prompt', 'input', 'text'],
  options?: Parameters<typeof sanitizePrompt>[1]
): {
  sanitized: T
  violations: Record<string, string[]>
  blocked: boolean
} {
  const sanitized = { ...body }
  const violations: Record<string, string[]> = {}
  let anyBlocked = false

  fields.forEach((field) => {
    if (typeof sanitized[field] === 'string') {
      const result = sanitizePrompt(sanitized[field], options)

      sanitized[field] = result.sanitized

      if (result.violations.length > 0) {
        violations[field] = result.violations
      }

      if (result.blocked) {
        anyBlocked = true
      }
    }
  })

  return {
    sanitized,
    violations,
    blocked: anyBlocked,
  }
}

/**
 * Get sanitization statistics for audit logging
 */
export function getSanitizationStats(
  results: Array<ReturnType<typeof sanitizePrompt>>
): {
  totalInputs: number
  blockedInputs: number
  modifiedInputs: number
  violationTypes: Record<string, number>
} {
  const violationTypes: Record<string, number> = {}
  let blockedInputs = 0
  let modifiedInputs = 0

  results.forEach((result) => {
    if (result.blocked) blockedInputs++
    if (result.modified) modifiedInputs++

    result.violations.forEach((violation) => {
      const type = violation.split(':')[0]
      violationTypes[type] = (violationTypes[type] || 0) + 1
    })
  })

  return {
    totalInputs: results.length,
    blockedInputs,
    modifiedInputs,
    violationTypes,
  }
}
