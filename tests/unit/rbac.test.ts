/**
 * Unit tests for lib/rbac.ts
 *
 * Covers: normalizeRole, ROLE_HIERARCHY, hasPermission, canPerformAction, checkApiPermission
 * P0 backlog item #4 from NAV_OVERHAUL_QA_REPORT.md
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeRole,
  ROLE_HIERARCHY,
  hasPermission,
  canPerformAction,
  checkApiPermission,
  type UserRole,
} from '@/lib/rbac'

// ─────────────────────────────────────────────
// normalizeRole
// ─────────────────────────────────────────────

describe('normalizeRole', () => {
  it('returns known roles unchanged', () => {
    const roles: UserRole[] = ['owner', 'admin', 'manager', 'operator', 'compliance', 'agent', 'analyst', 'viewer', 'member']
    for (const r of roles) {
      expect(normalizeRole(r)).toBe(r)
    }
  })

  it('handles case-insensitive input', () => {
    expect(normalizeRole('OWNER')).toBe('owner')
    expect(normalizeRole('Admin')).toBe('admin')
  })

  it('returns member for null/undefined', () => {
    expect(normalizeRole(null)).toBe('member')
    expect(normalizeRole(undefined)).toBe('member')
  })

  it('returns member for unknown roles', () => {
    expect(normalizeRole('superuser')).toBe('member')
    expect(normalizeRole('')).toBe('member')
  })

  it('trims whitespace', () => {
    expect(normalizeRole('  admin  ')).toBe('admin')
  })
})

// ─────────────────────────────────────────────
// ROLE_HIERARCHY
// ─────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('owner has highest level (5)', () => {
    expect(ROLE_HIERARCHY.owner).toBe(5)
  })

  it('admin has level 4', () => {
    expect(ROLE_HIERARCHY.admin).toBe(4)
  })

  it('manager = operator = compliance at level 3', () => {
    expect(ROLE_HIERARCHY.manager).toBe(3)
    expect(ROLE_HIERARCHY.operator).toBe(3)
    expect(ROLE_HIERARCHY.compliance).toBe(3)
  })

  it('agent = analyst at level 2', () => {
    expect(ROLE_HIERARCHY.agent).toBe(2)
    expect(ROLE_HIERARCHY.analyst).toBe(2)
  })

  it('viewer = member at level 1', () => {
    expect(ROLE_HIERARCHY.viewer).toBe(1)
    expect(ROLE_HIERARCHY.member).toBe(1)
  })

  it('matches workers/src/lib/auth.ts hierarchy', () => {
    // This test documents the contract between client and server
    const serverHierarchy: Record<string, number> = {
      viewer: 1,
      agent: 2,
      analyst: 2,
      operator: 3,
      manager: 3,
      compliance: 3,
      admin: 4,
      owner: 5,
    }
    for (const [role, level] of Object.entries(serverHierarchy)) {
      expect(ROLE_HIERARCHY[role as UserRole]).toBe(level)
    }
  })
})

// ─────────────────────────────────────────────
// hasPermission
// ─────────────────────────────────────────────

describe('hasPermission', () => {
  it('owner can write voice_config on pro plan', () => {
    expect(hasPermission('owner', 'pro', 'voice_config', 'write')).toBe(true)
  })

  it('viewer cannot write voice_config', () => {
    expect(hasPermission('viewer', 'pro', 'voice_config', 'write')).toBe(false)
  })

  it('agent can execute calls', () => {
    expect(hasPermission('agent', 'pro', 'call', 'execute')).toBe(true)
  })

  it('base plan does not get recording', () => {
    expect(hasPermission('owner', 'base', 'recording', 'read')).toBe(false)
  })

  it('pro plan gets recording', () => {
    expect(hasPermission('owner', 'pro', 'recording', 'read')).toBe(true)
  })
})

// ─────────────────────────────────────────────
// canPerformAction
// ─────────────────────────────────────────────

describe('canPerformAction', () => {
  it('admin can write recording', () => {
    expect(canPerformAction('admin', 'recording', 'write')).toBe(true)
  })

  it('viewer cannot write recording', () => {
    expect(canPerformAction('viewer', 'recording', 'write')).toBe(false)
  })

  it('manager can execute calls', () => {
    expect(canPerformAction('manager', 'call', 'execute')).toBe(true)
  })
})

// ─────────────────────────────────────────────
// checkApiPermission
// ─────────────────────────────────────────────

describe('checkApiPermission', () => {
  it('allows owner to POST voice call', () => {
    const result = checkApiPermission('/api/voice/call', 'POST', 'owner', 'pro')
    expect(result.allowed).toBe(true)
  })

  it('denies viewer from POST voice call', () => {
    const result = checkApiPermission('/api/voice/call', 'POST', 'viewer', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Insufficient role')
  })

  it('denies unknown endpoint', () => {
    const result = checkApiPermission('/api/unknown', 'GET', 'owner', 'pro')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Unknown endpoint')
  })

  it('denies wrong plan', () => {
    const result = checkApiPermission('/api/surveys/results', 'GET', 'owner', 'base')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Plan does not support this feature')
  })

  it('allows agent to POST voice call', () => {
    const result = checkApiPermission('/api/voice/call', 'POST', 'agent', 'pro')
    expect(result.allowed).toBe(true)
  })
})
