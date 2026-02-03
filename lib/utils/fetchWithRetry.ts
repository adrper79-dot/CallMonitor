/**
 * Retry Utility for External API Calls
 * 
 * Per ERROR_HANDLING_REVIEW.md recommendations and ARCH_DOCS standards:
 * - Implements exponential backoff for transient failures
 * - Used for SignalWire, AssemblyAI, ElevenLabs API calls
 * - Respects architectural principle: graceful degradation
 * 
 * @see ERROR_HANDLING_REVIEW.md - Priority 1 Recommendation
 * @see ARCH_DOCS/01-CORE/ERROR_HANDLING_PLAN.txt - Recovery mechanisms
 */

import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  shouldRetry?: (error: Error, response?: Response) => boolean
}

export interface RetryContext {
  attempt: number
  maxRetries: number
  lastError?: Error
  vendor: string
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: defaultShouldRetry
}

/**
 * Default retry logic: Retry on network errors or 5xx server errors
 */
function defaultShouldRetry(error: Error, response?: Response): boolean {
  // Network errors (no response)
  if (!response) return true
  
  // Server errors (5xx) - transient failures
  if (response.status >= 500 && response.status < 600) return true
  
  // Rate limiting (429) - back off and retry
  if (response.status === 429) return true
  
  // Don't retry client errors (4xx except 429)
  return false
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5)
  
  // Cap at maxDelay
  const delay = Math.min(exponentialDelay + jitter, maxDelay)
  
  return Math.floor(delay)
}

/**
 * Fetch with automatic retry and exponential backoff
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param config - Retry configuration
 * @returns Promise<Response>
 * @throws AppError with retriable flag
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const { maxRetries, baseDelay, maxDelay } = finalConfig
  const shouldRetry = finalConfig.shouldRetry ?? defaultShouldRetry
  
  // Extract vendor name from URL for logging
  const vendor = extractVendorName(url)
  
  let lastError: Error | null = null
  let lastResponse: Response | undefined
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const context: RetryContext = {
      attempt,
      maxRetries,
      lastError: lastError || undefined,
      vendor
    }
    
    try {
      // Log retry attempts
      if (attempt > 0) {
        logger.info(`Retrying ${vendor} API call`, {
          attempt,
          maxRetries,
          url: sanitizeUrl(url)
        })
      }
      
      const response = await fetch(url, options)
      
      // Success - return immediately
      if (response.ok) {
        if (attempt > 0) {
          logger.info(`${vendor} API call succeeded after retry`, {
            attempt,
            status: response.status
          })
        }
        return response
      }
      
      // Check if we should retry this error
      lastResponse = response.clone()
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      
      if (!shouldRetry(error, response)) {
        // Don't retry - throw immediately
        logger.warn(`${vendor} API call failed (non-retriable)`, {
          status: response.status,
          statusText: response.statusText
        })
        throw new AppError({
          code: `${vendor.toUpperCase()}_API_ERROR`,
          message: `${vendor} API returned ${response.status}`,
          user_message: `${vendor} service returned an error. Please try again.`,
          severity: response.status >= 500 ? 'HIGH' : 'MEDIUM',
          retriable: false,
          details: { status: response.status, statusText: response.statusText }
        })
      }
      
      lastError = error
      
      // Reached max retries?
      if (attempt === maxRetries) {
        logger.error(`${vendor} API call failed after ${maxRetries} retries`, error, {
          status: response.status,
          attempts: attempt + 1
        })
        throw new AppError({
          code: `${vendor.toUpperCase()}_API_FAILED`,
          message: `${vendor} API failed after ${maxRetries} retries`,
          user_message: `${vendor} service is temporarily unavailable. Please try again later.`,
          severity: 'HIGH',
          retriable: true,
          details: { 
            status: response.status, 
            attempts: attempt + 1,
            lastError: error.message 
          }
        })
      }
      
      // Calculate backoff delay
      const delay = calculateDelay(attempt, baseDelay, maxDelay)
      logger.info(`${vendor} API call failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries,
        status: response.status
      })
      
      // Wait before retry
      await sleep(delay)
      
    } catch (err: any) {
      // Network error or fetch failure
      lastError = err
      
      // If it's already an AppError, preserve it
      if (err instanceof AppError) {
        throw err
      }
      
      // Check if we should retry network errors
      if (!shouldRetry(err)) {
        throw new AppError({
          code: `${vendor.toUpperCase()}_NETWORK_ERROR`,
          message: `Network error contacting ${vendor}`,
          user_message: `Unable to reach ${vendor} service. Please check your connection.`,
          severity: 'HIGH',
          retriable: false,
          details: { error: err?.message }
        })
      }
      
      // Reached max retries?
      if (attempt === maxRetries) {
        logger.error(`${vendor} network error after ${maxRetries} retries`, err, {
          attempts: attempt + 1
        })
        throw new AppError({
          code: `${vendor.toUpperCase()}_UNREACHABLE`,
          message: `${vendor} unreachable after ${maxRetries} retries`,
          user_message: `Unable to reach ${vendor} service. Please try again later.`,
          severity: 'CRITICAL',
          retriable: true,
          details: { 
            error: err?.message,
            attempts: attempt + 1
          }
        })
      }
      
      // Calculate backoff delay
      const delay = calculateDelay(attempt, baseDelay, maxDelay)
      logger.info(`${vendor} network error, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: err?.message
      })
      
      // Wait before retry
      await sleep(delay)
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw new AppError({
    code: `${vendor.toUpperCase()}_RETRY_EXHAUSTED`,
    message: `${vendor} API retry exhausted`,
    user_message: `Service temporarily unavailable. Please try again.`,
    severity: 'HIGH',
    retriable: true
  })
}

/**
 * Extract vendor name from URL for logging
 */
function extractVendorName(url: string): string {
  try {
    const hostname = new URL(url).hostname
    
    if (hostname.includes('signalwire')) return 'SignalWire'
    if (hostname.includes('assemblyai')) return 'AssemblyAI'
    if (hostname.includes('elevenlabs')) return 'ElevenLabs'
    if (hostname.includes('resend')) return 'Resend'
    
    return 'External'
  } catch {
    return 'External'
  }
}

/**
 * Sanitize URL for logging (remove sensitive params)
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    
    // Remove auth tokens from query params
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '[REDACTED]')
    }
    if (parsed.searchParams.has('api_key')) {
      parsed.searchParams.set('api_key', '[REDACTED]')
    }
    
    return parsed.toString()
  } catch {
    return '[INVALID_URL]'
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Specialized retry for SignalWire API calls
 */
export async function fetchSignalWireWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(url, options, {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  })
}

/**
 * Specialized retry for AssemblyAI API calls
 */
export async function fetchAssemblyAIWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(url, options, {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000
  })
}

/**
 * Specialized retry for ElevenLabs API calls
 */
export async function fetchElevenLabsWithRetry(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(url, options, {
    maxRetries: 3,
    baseDelay: 1500,
    maxDelay: 12000
  })
}
