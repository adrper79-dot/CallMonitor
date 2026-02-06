/**
 * Circuit Breaker Pattern for External Service Degradation
 * 
 * Per ERROR_HANDLING_REVIEW.md recommendations and ARCH_DOCS standards:
 * - Prevents cascading failures when external services degrade
 * - Fails fast when service is unavailable
 * - Automatically recovers when service returns
 * - Monitors vendor health for alerting
 * 
 * @see ERROR_HANDLING_REVIEW.md - Priority 2 Recommendation
 * @see ARCH_DOCS/01-CORE/ERROR_HANDLING_PLAN.txt - Vendor health monitoring
 */

import { logger } from '@/lib/logger'
import { AppError } from '@/types/app-error'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /**
   * Timeout for individual requests (ms)
   */
  timeout: number
  
  /**
   * Error threshold percentage to open circuit (0-100)
   */
  errorThresholdPercentage: number
  
  /**
   * Time to wait before attempting recovery (ms)
   */
  resetTimeout: number
  
  /**
   * Minimum number of requests before opening circuit
   */
  volumeThreshold: number
  
  /**
   * Vendor name for logging
   */
  vendorName: string
}

interface CircuitMetrics {
  successCount: number
  failureCount: number
  totalCount: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  consecutiveFailures: number
  state: CircuitState
  stateChangedAt: number
}

/**
 * Circuit Breaker for External Services
 * 
 * State Machine:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing recovery, limited requests allowed
 * 
 * Transitions:
 * - CLOSED → OPEN: When error rate exceeds threshold
 * - OPEN → HALF_OPEN: After reset timeout
 * - HALF_OPEN → CLOSED: When test request succeeds
 * - HALF_OPEN → OPEN: When test request fails
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private metrics: CircuitMetrics
  private resetTimer: NodeJS.Timeout | null = null
  
  constructor(config: CircuitBreakerConfig) {
    this.config = config
    this.metrics = {
      successCount: 0,
      failureCount: 0,
      totalCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      consecutiveFailures: 0,
      state: 'CLOSED',
      stateChangedAt: Date.now()
    }
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.metrics.state === 'OPEN') {
      // Check if enough time has passed to attempt recovery
      const timeSinceOpen = Date.now() - this.metrics.stateChangedAt
      
      if (timeSinceOpen >= this.config.resetTimeout) {
        this.transitionToHalfOpen()
      } else {
        // Fail fast - circuit is open
        throw new AppError({
          code: `${this.config.vendorName.toUpperCase()}_CIRCUIT_OPEN`,
          message: `${this.config.vendorName} circuit breaker is open`,
          user_message: `${this.config.vendorName} service is temporarily unavailable. Please try again in a few moments.`,
          severity: 'HIGH',
          retriable: true,
          details: {
            state: this.metrics.state,
            timeSinceOpen: Math.floor(timeSinceOpen / 1000),
            resetIn: Math.floor((this.config.resetTimeout - timeSinceOpen) / 1000)
          }
        })
      }
    }
    
    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(fn)
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error as Error)
      throw error
    }
  }
  
  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${this.config.vendorName} request timeout after ${this.config.timeout}ms`))
      }, this.config.timeout)
      
      fn()
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.metrics.successCount++
    this.metrics.totalCount++
    this.metrics.lastSuccessTime = Date.now()
    this.metrics.consecutiveFailures = 0
    
    // If in HALF_OPEN state, transition back to CLOSED
    if (this.metrics.state === 'HALF_OPEN') {
      this.transitionToClosed()
    }
  }
  
  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.metrics.failureCount++
    this.metrics.totalCount++
    this.metrics.lastFailureTime = Date.now()
    this.metrics.consecutiveFailures++
    
    logger.warn(`${this.config.vendorName} circuit breaker: failure recorded`, {
      error: error.message,
      consecutiveFailures: this.metrics.consecutiveFailures,
      state: this.metrics.state
    })
    
    // If in HALF_OPEN state, transition back to OPEN
    if (this.metrics.state === 'HALF_OPEN') {
      this.transitionToOpen()
      return
    }
    
    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionToOpen()
    }
  }
  
  /**
   * Check if circuit should open based on error threshold
   */
  private shouldOpenCircuit(): boolean {
    // Need minimum volume before opening
    if (this.metrics.totalCount < this.config.volumeThreshold) {
      return false
    }
    
    // Calculate error percentage
    const errorPercentage = (this.metrics.failureCount / this.metrics.totalCount) * 100
    
    return errorPercentage >= this.config.errorThresholdPercentage
  }
  
  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    if (this.metrics.state === 'OPEN') return
    
    this.metrics.state = 'OPEN'
    this.metrics.stateChangedAt = Date.now()
    
    logger.error(`${this.config.vendorName} circuit breaker OPENED`, undefined, {
      failureCount: this.metrics.failureCount,
      totalCount: this.metrics.totalCount,
      errorPercentage: Math.round((this.metrics.failureCount / this.metrics.totalCount) * 100),
      consecutiveFailures: this.metrics.consecutiveFailures
    })
    
    // Schedule automatic transition to HALF_OPEN
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
    }
    this.resetTimer = setTimeout(() => {
      this.transitionToHalfOpen()
    }, this.config.resetTimeout)
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    if (this.metrics.state === 'HALF_OPEN') return
    
    this.metrics.state = 'HALF_OPEN'
    this.metrics.stateChangedAt = Date.now()
    
    logger.warn(`${this.config.vendorName} circuit breaker HALF_OPEN - testing recovery`, {
      timeSinceOpen: Math.floor((Date.now() - this.metrics.stateChangedAt) / 1000)
    })
  }
  
  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    if (this.metrics.state === 'CLOSED') return
    
    const previousState = this.metrics.state
    this.metrics.state = 'CLOSED'
    this.metrics.stateChangedAt = Date.now()
    
    // Reset metrics
    this.metrics.successCount = 0
    this.metrics.failureCount = 0
    this.metrics.totalCount = 0
    this.metrics.consecutiveFailures = 0
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    
    logger.info(`${this.config.vendorName} circuit breaker CLOSED - service recovered`, {
      previousState,
      downtime: previousState === 'OPEN' ? Math.floor((Date.now() - this.metrics.stateChangedAt) / 1000) : 0
    })
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.metrics.state
  }
  
  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics }
  }
  
  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean
    state: CircuitState
    errorRate: number
    consecutiveFailures: number
  } {
    const errorRate = this.metrics.totalCount > 0
      ? (this.metrics.failureCount / this.metrics.totalCount) * 100
      : 0
    
    return {
      healthy: this.metrics.state === 'CLOSED',
      state: this.metrics.state,
      errorRate: Math.round(errorRate),
      consecutiveFailures: this.metrics.consecutiveFailures
    }
  }
  
  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  reset(): void {
    this.transitionToClosed()
    logger.info(`${this.config.vendorName} circuit breaker manually reset`)
  }
}

/**
 * Circuit Breaker Registry - Singleton instances per vendor
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()
  
  /**
   * Get or create circuit breaker for vendor
   */
  getBreaker(vendorName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(vendorName)) {
      const defaultConfig: CircuitBreakerConfig = {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10,
        vendorName,
        ...config
      }
      
      this.breakers.set(vendorName, new CircuitBreaker(defaultConfig))
    }
    
    return this.breakers.get(vendorName)!
  }
  
  /**
   * Get all breaker health statuses
   */
  getHealthStatuses(): Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> {
    const statuses: Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> = {}
    
    this.breakers.forEach((breaker, name) => {
      statuses[name] = breaker.getHealthStatus()
    })
    
    return statuses
  }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

/**
 * Pre-configured circuit breakers for known vendors
 */
export const signalWireBreaker = circuitBreakerRegistry.getBreaker('SignalWire', {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10
})

export const assemblyAIBreaker = circuitBreakerRegistry.getBreaker('AssemblyAI', {
  timeout: 15000,
  errorThresholdPercentage: 40,
  resetTimeout: 60000,
  volumeThreshold: 5
})

export const elevenLabsBreaker = circuitBreakerRegistry.getBreaker('ElevenLabs', {
  timeout: 20000,
  errorThresholdPercentage: 45,
  resetTimeout: 45000,
  volumeThreshold: 8
})

export const telnyxBreaker = circuitBreakerRegistry.getBreaker('Telnyx', {
  timeout: 15000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10
})
