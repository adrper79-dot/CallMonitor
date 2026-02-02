import { describe, it, expect } from 'vitest'
import { hasPermission, planSupportsFeature, canPerformAction, checkApiPermission } from '@/lib/rbac'
import type { UserRole, Plan } from '@/lib/rbac'

describe('RBAC', () => {
  describe('hasPermission', () => {
    it('should allow owner to write voice_config', () => {
      expect(hasPermission('owner', 'pro', 'voice_config', 'write')).toBe(true)
    })

    it('should allow admin to write voice_config', () => {
      expect(hasPermission('admin', 'pro', 'voice_config', 'write')).toBe(true)
    })

    it('should deny operator from writing voice_config', () => {
      expect(hasPermission('operator', 'pro', 'voice_config', 'write')).toBe(false)
    })

    it('should allow all roles to read voice_config', () => {
      expect(hasPermission('owner', 'base', 'voice_config', 'read')).toBe(true)
      expect(hasPermission('admin', 'base', 'voice_config', 'read')).toBe(true)
      expect(hasPermission('operator', 'base', 'voice_config', 'read')).toBe(true)
      expect(hasPermission('analyst', 'base', 'voice_config', 'read')).toBe(true)
      expect(hasPermission('viewer', 'base', 'voice_config', 'read')).toBe(true)
    })

    it('should enforce plan requirements for recording', () => {
      expect(hasPermission('owner', 'base', 'recording', 'read')).toBe(false)
      expect(hasPermission('owner', 'pro', 'recording', 'read')).toBe(true)
      expect(hasPermission('owner', 'insights', 'recording', 'read')).toBe(true)
    })

    it('should enforce plan requirements for translation', () => {
      expect(hasPermission('owner', 'pro', 'translation', 'read')).toBe(false)
      expect(hasPermission('owner', 'global', 'translation', 'read')).toBe(true)
    })

    it('should enforce plan requirements for survey', () => {
      expect(hasPermission('owner', 'pro', 'survey', 'read')).toBe(false)
      expect(hasPermission('owner', 'insights', 'survey', 'read')).toBe(true)
    })

    it('should enforce plan requirements for secret_shopper', () => {
      expect(hasPermission('owner', 'pro', 'secret_shopper', 'read')).toBe(false)
      expect(hasPermission('owner', 'insights', 'secret_shopper', 'read')).toBe(true)
    })
  })

  describe('planSupportsFeature', () => {
    it('should return true for base plan on call feature', () => {
      expect(planSupportsFeature('base', 'call')).toBe(true)
    })

    it('should return false for base plan on recording', () => {
      expect(planSupportsFeature('base', 'recording')).toBe(false)
    })

    it('should return true for pro plan on recording', () => {
      expect(planSupportsFeature('pro', 'recording')).toBe(true)
    })

    it('should return true for insights plan on survey', () => {
      expect(planSupportsFeature('insights', 'survey')).toBe(true)
    })

    it('should return false for pro plan on translation', () => {
      expect(planSupportsFeature('pro', 'translation')).toBe(false)
    })
  })

  describe('canPerformAction', () => {
    it('should allow owner to execute calls', () => {
      expect(canPerformAction('owner', 'call', 'execute')).toBe(true)
    })

    it('should allow operator to execute calls', () => {
      expect(canPerformAction('operator', 'call', 'execute')).toBe(true)
    })

    it('should deny analyst from executing calls', () => {
      expect(canPerformAction('analyst', 'call', 'execute')).toBe(false)
    })

    it('should deny viewer from executing calls', () => {
      expect(canPerformAction('viewer', 'call', 'execute')).toBe(false)
    })
  })

  describe('checkApiPermission', () => {
    it('should allow owner to POST /api/voice/call', () => {
      const result = checkApiPermission('/api/voice/call', 'POST', 'owner', 'base')
      expect(result.allowed).toBe(true)
    })

    it('should allow operator to POST /api/voice/call', () => {
      const result = checkApiPermission('/api/voice/call', 'POST', 'operator', 'base')
      expect(result.allowed).toBe(true)
    })

    it('should deny analyst from POST /api/voice/call', () => {
      const result = checkApiPermission('/api/voice/call', 'POST', 'analyst', 'base')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Insufficient role')
    })

    it('should allow owner to PUT /api/voice/config', () => {
      const result = checkApiPermission('/api/voice/config', 'PUT', 'owner', 'base')
      expect(result.allowed).toBe(true)
    })

    it('should deny operator from PUT /api/voice/config', () => {
      const result = checkApiPermission('/api/voice/config', 'PUT', 'operator', 'base')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Insufficient role')
    })

    it('should enforce plan requirements for GET /api/recordings', () => {
      const resultBase = checkApiPermission('/api/recordings', 'GET', 'owner', 'base')
      expect(resultBase.allowed).toBe(false)
      expect(resultBase.reason).toBe('Plan does not support this feature')

      const resultPro = checkApiPermission('/api/recordings', 'GET', 'owner', 'pro')
      expect(resultPro.allowed).toBe(true)
    })
  })
})
