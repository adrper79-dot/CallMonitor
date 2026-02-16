/**
 * Nav Link Audit Test
 *
 * Structurally validates that every navigation href in AppShell, RoleShell,
 * and BottomNav maps to an actual route (page.tsx) in the app/ directory.
 *
 * Prevents nav link rot — catches broken hrefs before deployment.
 * Created after the 14-broken-link incident in the platform audit.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getNavGroups, type RoleShell } from '@/lib/navigation'

const APP_DIR = path.resolve(__dirname, '..', 'app')

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Recursively find all page.tsx/page.ts files and convert to route paths.
 * Handles Next.js conventions:
 *   - Dynamic segments [id] → skipped (nav links are static)
 *   - Route groups (group) → transparent, don't appear in URL
 */
function getActualRoutes(): Set<string> {
  const routes = new Set<string>()

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Route groups (parenthesized) are transparent in the URL
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          walk(path.join(dir, entry.name), prefix)
          continue
        }
        // Dynamic segments — still walk them, but with a placeholder
        if (entry.name.startsWith('[')) {
          walk(path.join(dir, entry.name), `${prefix}/${entry.name}`)
          continue
        }
        walk(path.join(dir, entry.name), `${prefix}/${entry.name}`)
      } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
        routes.add(prefix || '/')
      }
    }
  }

  walk(APP_DIR, '')
  return routes
}

/**
 * Extract all href: '/...' values from a TypeScript/TSX source file.
 */
function extractHrefsFromSource(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf-8')
  const hrefRegex = /href:\s*['"]([^'"]+)['"]/g
  const hrefs: string[] = []
  let match
  while ((match = hrefRegex.exec(source)) !== null) {
    hrefs.push(match[1])
  }
  return [...new Set(hrefs)]
}

/**
 * Parse AppShell.tsx and extract hrefs grouped by role section.
 * AppShell uses if(isAgent)/else if(isManager)/else if(isAdmin) blocks.
 */
function extractAppShellHrefsByRole(filePath: string): Record<string, string[]> {
  const source = fs.readFileSync(filePath, 'utf-8')

  // Find the role blocks by their conditional boundaries
  const agentMatch = source.match(/if \(isAgent\) \{([\s\S]*?)\} else if \(isManager\)/)
  const managerMatch = source.match(/else if \(isManager\) \{([\s\S]*?)\} else if \(isAdmin\)/)
  const adminMatch = source.match(/else if \(isAdmin\) \{([\s\S]*?)\} else \{/)

  const extractHrefs = (block: string | undefined): string[] => {
    if (!block) return []
    const regex = /href:\s*['"]([^'"]+)['"]/g
    const hrefs: string[] = []
    let m
    while ((m = regex.exec(block)) !== null) {
      hrefs.push(m[1])
    }
    return [...new Set(hrefs)]
  }

  return {
    agent: extractHrefs(agentMatch?.[1]),
    manager: extractHrefs(managerMatch?.[1]),
    admin: extractHrefs(adminMatch?.[1]),
  }
}

/**
 * Check if a navigation href maps to an existing route.
 * Static nav hrefs must match exactly.
 */
function routeExists(href: string, routes: Set<string>): boolean {
  return routes.has(href)
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('Nav Link Audit', () => {
  const actualRoutes = getActualRoutes()

  it('should discover > 50 app routes', () => {
    expect(actualRoutes.size).toBeGreaterThan(50)
    // Sanity-check critical routes
    expect(actualRoutes.has('/work')).toBe(true)
    expect(actualRoutes.has('/command')).toBe(true)
    expect(actualRoutes.has('/settings')).toBe(true)
    expect(actualRoutes.has('/accounts')).toBe(true)
    expect(actualRoutes.has('/analytics')).toBe(true)
  })

  // ── AppShell (Legacy Nav) ────────────────────────────────
  describe('AppShell (legacy nav)', () => {
    const appShellPath = path.resolve(__dirname, '..', 'components', 'layout', 'AppShell.tsx')
    const hrefsByRole = extractAppShellHrefsByRole(appShellPath)

    it('agent — every href maps to an actual route', () => {
      expect(hrefsByRole.agent.length).toBeGreaterThan(10)
      const missing = hrefsByRole.agent.filter((h) => !routeExists(h, actualRoutes))
      expect(missing, `AppShell agent dead links: ${missing.join(', ')}`).toEqual([])
    })

    it('manager — every href maps to an actual route', () => {
      expect(hrefsByRole.manager.length).toBeGreaterThan(15)
      const missing = hrefsByRole.manager.filter((h) => !routeExists(h, actualRoutes))
      expect(missing, `AppShell manager dead links: ${missing.join(', ')}`).toEqual([])
    })

    it('admin — every href maps to an actual route', () => {
      expect(hrefsByRole.admin.length).toBeGreaterThan(20)
      const missing = hrefsByRole.admin.filter((h) => !routeExists(h, actualRoutes))
      expect(missing, `AppShell admin dead links: ${missing.join(', ')}`).toEqual([])
    })
  })

  // ── RoleShell (New Nav — lib/navigation.ts) ──────────────
  describe('RoleShell (new nav)', () => {
    const shells: RoleShell[] = ['agent', 'manager', 'admin']

    for (const shell of shells) {
      it(`${shell} — every href maps to an actual route`, () => {
        const groups = getNavGroups(shell)
        const hrefs = groups.flatMap((g) => g.items.map((i) => i.href))
        const unique = [...new Set(hrefs)]

        expect(unique.length).toBeGreaterThan(5)
        const missing = unique.filter((h) => !routeExists(h, actualRoutes))
        expect(missing, `RoleShell ${shell} dead links: ${missing.join(', ')}`).toEqual([])
      })
    }
  })

  // ── BottomNav (Mobile) ───────────────────────────────────
  describe('BottomNav (mobile)', () => {
    it('every href maps to an actual route', () => {
      const bottomNavPath = path.resolve(__dirname, '..', 'components', 'layout', 'BottomNav.tsx')
      const hrefs = extractHrefsFromSource(bottomNavPath)

      expect(hrefs.length).toBeGreaterThan(0)
      const missing = hrefs.filter((h) => !routeExists(h, actualRoutes))
      expect(missing, `BottomNav dead links: ${missing.join(', ')}`).toEqual([])
    })
  })

  // ── Complete Cross-Surface Audit ─────────────────────────
  describe('Complete audit', () => {
    it('zero dead links across all nav surfaces combined', () => {
      const appShellPath = path.resolve(__dirname, '..', 'components', 'layout', 'AppShell.tsx')
      const bottomNavPath = path.resolve(__dirname, '..', 'components', 'layout', 'BottomNav.tsx')

      const appShellHrefs = extractHrefsFromSource(appShellPath)
      const bottomNavHrefs = extractHrefsFromSource(bottomNavPath)
      const roleShellHrefs = (['agent', 'manager', 'admin'] as RoleShell[]).flatMap((shell) =>
        getNavGroups(shell).flatMap((g) => g.items.map((i) => i.href))
      )

      const allUnique = new Set([...appShellHrefs, ...roleShellHrefs, ...bottomNavHrefs])

      console.log(`\n📊 Nav Link Audit Summary:`)
      console.log(`   AppShell:    ${appShellHrefs.length} unique hrefs`)
      console.log(`   RoleShell:   ${new Set(roleShellHrefs).size} unique hrefs`)
      console.log(`   BottomNav:   ${bottomNavHrefs.length} unique hrefs`)
      console.log(`   Total unique: ${allUnique.size}`)
      console.log(`   App routes:   ${actualRoutes.size}`)

      const allMissing = [...allUnique].filter((h) => !routeExists(h, actualRoutes))
      expect(allMissing, `Dead nav links found: ${allMissing.join(', ')}`).toEqual([])
    })
  })
})
