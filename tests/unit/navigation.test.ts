/**
 * Unit tests for lib/navigation.ts
 *
 * Covers: getRoleShell, getRoleLanding, getNavGroups, getAllNavItems, isNavActive
 * P0 backlog item #4 from NAV_OVERHAUL_QA_REPORT.md
 */

import { describe, it, expect } from 'vitest'
import {
  getRoleShell,
  getRoleLanding,
  getNavGroups,
  getAllNavItems,
  isNavActive,
} from '@/lib/navigation'

// ─────────────────────────────────────────────
// getRoleShell
// ─────────────────────────────────────────────

describe('getRoleShell', () => {
  it('maps owner → admin', () => {
    expect(getRoleShell('owner')).toBe('admin')
  })

  it('maps admin → admin', () => {
    expect(getRoleShell('admin')).toBe('admin')
  })

  it('maps analyst → manager', () => {
    expect(getRoleShell('analyst')).toBe('manager')
  })

  it('maps manager → manager', () => {
    expect(getRoleShell('manager')).toBe('manager')
  })

  it('maps compliance → manager', () => {
    expect(getRoleShell('compliance')).toBe('manager')
  })

  it('maps operator → agent', () => {
    expect(getRoleShell('operator')).toBe('agent')
  })

  it('maps agent → agent', () => {
    expect(getRoleShell('agent')).toBe('agent')
  })

  it('maps viewer → agent', () => {
    expect(getRoleShell('viewer')).toBe('agent')
  })

  it('maps member → agent', () => {
    expect(getRoleShell('member')).toBe('agent')
  })

  it('maps null → agent (default)', () => {
    expect(getRoleShell(null)).toBe('agent')
  })
})

// ─────────────────────────────────────────────
// getRoleLanding
// ─────────────────────────────────────────────

describe('getRoleLanding', () => {
  it('owners land on /command', () => {
    expect(getRoleLanding('owner')).toBe('/command')
  })

  it('agents land on /work', () => {
    expect(getRoleLanding('operator')).toBe('/work')
  })

  it('managers land on /command', () => {
    expect(getRoleLanding('analyst')).toBe('/command')
  })

  it('null lands on /work (agent default)', () => {
    expect(getRoleLanding(null)).toBe('/work')
  })
})

// ─────────────────────────────────────────────
// getNavGroups
// ─────────────────────────────────────────────

describe('getNavGroups', () => {
  it('agent shell has non-empty nav groups', () => {
    const groups = getNavGroups('agent')
    expect(groups.length).toBeGreaterThan(0)
  })

  it('manager shell has non-empty nav groups', () => {
    const groups = getNavGroups('manager')
    expect(groups.length).toBeGreaterThan(0)
  })

  it('admin shell includes manager groups + admin extras', () => {
    const adminGroups = getNavGroups('admin')
    const managerGroups = getNavGroups('manager')
    expect(adminGroups.length).toBeGreaterThan(managerGroups.length)
  })

  it('each group has a unique id', () => {
    const groups = getNavGroups('admin') // admin has the most groups
    const ids = groups.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every nav item has href, label, and icon', () => {
    for (const shell of ['agent', 'manager', 'admin'] as const) {
      for (const group of getNavGroups(shell)) {
        for (const item of group.items) {
          expect(item.href).toBeTruthy()
          expect(item.label).toBeTruthy()
          expect(item.icon).toBeTruthy()
        }
      }
    }
  })

  it('all hrefs start with /', () => {
    for (const shell of ['agent', 'manager', 'admin'] as const) {
      for (const group of getNavGroups(shell)) {
        for (const item of group.items) {
          expect(item.href).toMatch(/^\//)
        }
      }
    }
  })
})

// ─────────────────────────────────────────────
// getAllNavItems
// ─────────────────────────────────────────────

describe('getAllNavItems', () => {
  it('returns flat array of items', () => {
    const items = getAllNavItems('agent')
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toHaveProperty('href')
  })

  it('admin gets more items than agent', () => {
    const adminItems = getAllNavItems('admin')
    const agentItems = getAllNavItems('agent')
    expect(adminItems.length).toBeGreaterThanOrEqual(agentItems.length)
  })
})

// ─────────────────────────────────────────────
// isNavActive
// ─────────────────────────────────────────────

describe('isNavActive', () => {
  it('exact match on root paths (/work)', () => {
    expect(isNavActive('/work', '/work')).toBe(true)
  })

  it('does NOT prefix match on root paths', () => {
    expect(isNavActive('/work/queue', '/work')).toBe(false)
  })

  it('exact match on sub-paths', () => {
    expect(isNavActive('/work/queue', '/work/queue')).toBe(true)
  })

  it('prefix match on sub-paths', () => {
    expect(isNavActive('/compliance/violations/123', '/compliance/violations')).toBe(true)
  })

  it('does not match unrelated paths', () => {
    expect(isNavActive('/settings', '/work')).toBe(false)
  })

  it('exact match only for /command root', () => {
    expect(isNavActive('/command', '/command')).toBe(true)
    expect(isNavActive('/command/live', '/command')).toBe(false)
  })

  it('exact match only for /admin root', () => {
    expect(isNavActive('/admin', '/admin')).toBe(true)
    expect(isNavActive('/admin/billing', '/admin')).toBe(false)
  })
})
