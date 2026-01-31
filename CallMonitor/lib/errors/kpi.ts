/**
 * Error KPI Collection
 * 
 * Tracks error frequency, endpoint health, and system status.
 * Per ERROR_HANDLING_PLAN.txt
 */

import { TrackedError } from './errorTracker'

interface ErrorKPI {
  code: string
  count: number
  lastOccurrence: string
  severity: string
}

interface EndpointKPI {
  endpoint: string
  method: string
  errorCount: number
  successCount: number
  lastError?: string
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  criticalErrors: number
  highErrors: number
  lastUpdated: string
}

// In-memory storage (for production, use Redis or database)
const errorKPIs: Map<string, ErrorKPI> = new Map()
const endpointKPIs: Map<string, EndpointKPI> = new Map()
let systemHealth: SystemHealth = {
  status: 'healthy',
  criticalErrors: 0,
  highErrors: 0,
  lastUpdated: new Date().toISOString()
}

/**
 * Record error KPI
 */
export function recordErrorKPI(trackedError: TrackedError) {
  const key = trackedError.code
  const existing = errorKPIs.get(key) || {
    code: trackedError.code,
    count: 0,
    lastOccurrence: '',
    severity: trackedError.severity
  }

  existing.count += 1
  existing.lastOccurrence = trackedError.timestamp
  existing.severity = trackedError.severity

  errorKPIs.set(key, existing)

  // Update system health
  if (trackedError.severity === 'CRITICAL') {
    systemHealth.criticalErrors += 1
  } else if (trackedError.severity === 'HIGH') {
    systemHealth.highErrors += 1
  }

  // Update system status
  if (systemHealth.criticalErrors > 0) {
    systemHealth.status = 'critical'
  } else if (systemHealth.highErrors > 10) {
    systemHealth.status = 'degraded'
  } else {
    systemHealth.status = 'healthy'
  }

  systemHealth.lastUpdated = new Date().toISOString()

  // Record endpoint KPI if endpoint available
  if (trackedError.endpoint && trackedError.method) {
    const endpointKey = `${trackedError.method} ${trackedError.endpoint}`
    const endpointKPI = endpointKPIs.get(endpointKey) || {
      endpoint: trackedError.endpoint,
      method: trackedError.method,
      errorCount: 0,
      successCount: 0
    }

    endpointKPI.errorCount += 1
    endpointKPI.lastError = trackedError.timestamp
    endpointKPIs.set(endpointKey, endpointKPI)
  }
}

/**
 * Record success KPI for endpoint
 */
export function recordSuccessKPI(endpoint: string, method: string) {
  const key = `${method} ${endpoint}`
  const endpointKPI = endpointKPIs.get(key) || {
    endpoint,
    method,
    errorCount: 0,
    successCount: 0
  }

  endpointKPI.successCount += 1
  endpointKPIs.set(key, endpointKPI)
}

/**
 * Get error KPIs
 */
export function getErrorKPIs(): ErrorKPI[] {
  return Array.from(errorKPIs.values())
}

/**
 * Get endpoint KPIs
 */
export function getEndpointKPIs(): EndpointKPI[] {
  return Array.from(endpointKPIs.values())
}

/**
 * Get system health
 */
export function getSystemHealth(): SystemHealth {
  return { ...systemHealth }
}

/**
 * Reset KPIs (for testing or periodic reset)
 */
export function resetKPIs() {
  errorKPIs.clear()
  endpointKPIs.clear()
  systemHealth = {
    status: 'healthy',
    criticalErrors: 0,
    highErrors: 0,
    lastUpdated: new Date().toISOString()
  }
}
