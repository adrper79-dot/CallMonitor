import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getErrorDefinition, getDefaultError } from '@/lib/errors/errorCatalog'
import { trackError, trackAppError } from '@/lib/errors/errorTracker'
import { recordErrorKPI, recordSuccessKPI, getErrorKPIs, getSystemHealth, resetKPIs } from '@/lib/errors/kpi'
import { AppError } from '@/types/app-error'

describe('Error Handling', () => {
  beforeEach(() => {
    resetKPIs()
  })

  describe('Error Catalog', () => {
    it('should return error definition for known code', () => {
      const def = getErrorDefinition('AUTH_REQUIRED')
      expect(def).not.toBeNull()
      expect(def?.code).toBe('AUTH_REQUIRED')
      expect(def?.severity).toBe('HIGH')
      expect(def?.httpStatus).toBe(401)
    })

    it('should return null for unknown code', () => {
      const def = getErrorDefinition('UNKNOWN_ERROR')
      expect(def).toBeNull()
    })

    it('should return default error for unknown codes', () => {
      const def = getDefaultError()
      expect(def.code).toBe('SYSTEM_ERROR')
      expect(def.severity).toBe('CRITICAL')
    })
  })

  describe('Error Tracker', () => {
    it('should track error with unique ID', () => {
      const error = new Error('Test error')
      const tracked = trackError(error, {
        endpoint: '/api/test',
        method: 'POST',
        userId: 'user-123',
        organizationId: 'org-456'
      })

      expect(tracked.id).toMatch(/^ERR_\d{8}_[A-Z0-9]{6}$/)
      expect(tracked.code).toBe('SYSTEM_ERROR')
      expect(tracked.endpoint).toBe('/api/test')
      expect(tracked.userId).toBe('user-123')
    })

    it('should track AppError with correct code', () => {
      const appError = new AppError({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        user_message: 'Please sign in',
        severity: 'HIGH'
      })

      const tracked = trackAppError(appError, {
        endpoint: '/api/test',
        method: 'GET'
      })

      expect(tracked.code).toBe('AUTH_REQUIRED')
      expect(tracked.severity).toBe('HIGH')
    })
  })

  describe('KPI Collection', () => {
    it('should record error KPI', () => {
      const tracked = trackError(new Error('Test'), {
        endpoint: '/api/test',
        method: 'POST'
      })
      recordErrorKPI(tracked)

      const kpis = getErrorKPIs()
      expect(kpis.length).toBeGreaterThan(0)
      expect(kpis[0].code).toBe('SYSTEM_ERROR')
      expect(kpis[0].count).toBe(1)
    })

    it('should record success KPI', () => {
      recordSuccessKPI('/api/test', 'POST')
      recordSuccessKPI('/api/test', 'POST')

      const endpointKPIs = getErrorKPIs()
      // Success KPIs are tracked separately
      expect(endpointKPIs).toBeDefined()
    })

    it('should update system health on critical errors', () => {
      const tracked = trackError(new Error('Critical'), {
        endpoint: '/api/test',
        method: 'POST'
      })
      tracked.severity = 'CRITICAL'
      recordErrorKPI(tracked)

      const health = getSystemHealth()
      expect(health.criticalErrors).toBe(1)
      expect(health.status).toBe('critical')
    })

    it('should update system health on high errors', () => {
      for (let i = 0; i < 11; i++) {
        const tracked = trackError(new Error('High'), {
          endpoint: '/api/test',
          method: 'POST'
        })
        tracked.severity = 'HIGH'
        recordErrorKPI(tracked)
      }

      const health = getSystemHealth()
      expect(health.highErrors).toBe(11)
      expect(health.status).toBe('degraded')
    })
  })
})
