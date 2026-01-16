/**
 * Circuit Breaker and Audit Log Health Endpoint
 * 
 * Provides health status for:
 * - External service circuit breakers (SignalWire, AssemblyAI, ElevenLabs)
 * - Audit log failure monitoring
 * 
 * Per ARCH_DOCS standards and ERROR_HANDLING_REVIEW recommendations
 */

import { NextResponse } from 'next/server'
import { circuitBreakerRegistry } from '@/lib/utils/circuitBreaker'
import { getAuditLogHealth, getAuditLogMetrics } from '@/lib/monitoring/auditLogMonitor'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get circuit breaker health for all vendors
    const breakerHealth = circuitBreakerRegistry.getHealthStatuses()
    
    // Get audit log health
    const auditHealth = getAuditLogHealth()
    const auditMetrics = getAuditLogMetrics()
    
    // Calculate overall system health
    const allBreakersHealthy = Object.values(breakerHealth).every(b => b.healthy)
    const auditHealthy = auditHealth.healthy
    const overallHealthy = allBreakersHealthy && auditHealthy
    
    // Determine HTTP status code
    const status = overallHealthy ? 200 : 503
    
    return NextResponse.json({
      healthy: overallHealthy,
      timestamp: new Date().toISOString(),
      circuitBreakers: breakerHealth,
      auditLog: {
        healthy: auditHealthy,
        errorRate: auditHealth.errorRate,
        consecutiveFailures: auditHealth.consecutiveFailures,
        recentFailures: auditHealth.recentFailures,
        metrics: {
          failureCount: auditMetrics.failureCount,
          successCount: auditMetrics.successCount,
          lastFailureTime: auditMetrics.lastFailureTime 
            ? new Date(auditMetrics.lastFailureTime).toISOString() 
            : null
        }
      }
    }, { status })
  } catch (error: any) {
    return NextResponse.json({
      healthy: false,
      error: 'Failed to retrieve health status',
      details: error?.message
    }, { status: 500 })
  }
}
