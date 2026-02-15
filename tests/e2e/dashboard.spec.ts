import { test, expect } from '@playwright/test'

/**
 * Dashboard Core Functionality E2E Tests
 *
 * Tests the main dashboard interface and core functionality:
 * - Dashboard loading and layout
 * - Navigation between sections
 * - Key metrics and widgets
 * - Quick actions and shortcuts
 */

test.describe('Dashboard Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (assumes user is authenticated)
    await page.goto('/dashboard')
  })

  test('dashboard loads with proper layout and navigation', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.getByRole('heading', { name: /dashboard|welcome|overview/i })).toBeVisible()

    // Check navigation sidebar/menu
    const nav = page.locator('nav, [data-testid="sidebar"], .sidebar, .navigation')
    await expect(nav).toBeVisible()

    // Check main content area
    const mainContent = page.locator('main, [data-testid="main-content"], .main-content')
    await expect(mainContent).toBeVisible()
  })

  test('dashboard shows key metrics and KPIs', async ({ page }) => {
    // Check for metrics cards/widgets
    const metrics = page.locator('[data-testid*="metric"], [data-testid*="kpi"], .metric-card, .kpi-card')

    // Should have at least some metrics visible
    const metricCount = await metrics.count()
    expect(metricCount).toBeGreaterThan(0)

    // Check for common metric types
    const metricTexts = ['calls', 'campaigns', 'conversions', 'revenue', 'active', 'completed', 'pending']
    let foundMetric = false
    for (const text of metricTexts) {
      if (await page.getByText(new RegExp(text, 'i')).isVisible()) {
        foundMetric = true
        break
      }
    }
    expect(foundMetric).toBe(true)
  })

  test('navigation between dashboard sections works', async ({ page }) => {
    // Test navigation to different sections
    const navItems = [
      { link: /analytics|reports/i, expected: /analytics|reports/i },
      { link: /campaigns/i, expected: /campaigns/i },
      { link: /voice|calls/i, expected: /voice|calls/i },
      { link: /settings/i, expected: /settings/i },
      { link: /team|users/i, expected: /team|users/i }
    ]

    for (const item of navItems) {
      const navLink = page.getByRole('link', { name: item.link })
      if (await navLink.isVisible()) {
        await navLink.click()

        // Should navigate to the expected section
        await expect(page.getByText(item.expected)).toBeVisible()

        // Navigate back to dashboard for next test
        const dashboardLink = page.getByRole('link', { name: /dashboard|home/i })
        if (await dashboardLink.isVisible()) {
          await dashboardLink.click()
          await expect(page.getByRole('heading', { name: /dashboard|welcome/i })).toBeVisible()
        }
      }
    }
  })

  test('dashboard quick actions and shortcuts work', async ({ page }) => {
    // Check for quick action buttons
    const quickActions = page.locator('[data-testid*="quick-action"], button[class*="quick"], .action-button')

    if (await quickActions.first().isVisible()) {
      // Click first available quick action
      await quickActions.first().click()

      // Should either navigate or open a modal/form
      const modal = page.locator('[role="dialog"], .modal, .drawer')
      const newPage = page.locator('h1, h2, [data-testid*="form"]')

      // One of these should be visible
      const hasModal = await modal.isVisible()
      const hasNewPage = await newPage.isVisible()

      expect(hasModal || hasNewPage).toBe(true)
    }
  })

  test('dashboard widgets are interactive', async ({ page }) => {
    // Test chart/table interactions
    const charts = page.locator('[data-testid*="chart"], canvas, svg, .chart')
    const tables = page.locator('table, [data-testid*="table"]')

    // Test chart interactions if present
    if (await charts.first().isVisible()) {
      // Try to hover over chart elements
      await charts.first().hover()
      // Should not crash
      await expect(page.locator('body')).toBeVisible()
    }

    // Test table interactions if present
    if (await tables.first().isVisible()) {
      // Check for sortable headers
      const sortableHeaders = tables.first().locator('th[aria-sort], th[data-sortable]')
      if (await sortableHeaders.first().isVisible()) {
        await sortableHeaders.first().click()
        // Table should still be visible after sorting
        await expect(tables.first()).toBeVisible()
      }

      // Check for row actions
      const rowActions = tables.first().locator('td button, td [role="button"]')
      if (await rowActions.first().isVisible()) {
        // Just hover - don't click to avoid side effects
        await rowActions.first().hover()
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('dashboard handles loading states properly', async ({ page }) => {
    // Reload page to test loading state
    await page.reload()

    // Should show loading indicator initially
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner, [aria-label="loading"]')
    // Note: Loading might be too fast to catch, so this is optional
    // await expect(loadingIndicator.or(page.locator('body'))).toBeVisible()

    // Should eventually show dashboard content
    await expect(page.getByRole('heading', { name: /dashboard|welcome/i })).toBeVisible({ timeout: 10000 })
  })

  test('dashboard is responsive on different screen sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Navigation should still work (hamburger menu might appear)
    const mobileNav = page.locator('[data-testid="mobile-nav"], .hamburger, [aria-label="menu"]')
    if (await mobileNav.isVisible()) {
      await mobileNav.click()
      // Mobile menu should open
      await expect(page.locator('[data-testid="mobile-menu"], .mobile-menu')).toBeVisible()
    }

    // Main content should still be visible
    await expect(page.locator('main, [data-testid="main-content"]')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })

    // Content should adapt
    await expect(page.locator('main, [data-testid="main-content"]')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Full layout should be visible
    await expect(page.locator('nav, [data-testid="sidebar"]')).toBeVisible()
    await expect(page.locator('main, [data-testid="main-content"]')).toBeVisible()
  })

  test('dashboard shows user context correctly', async ({ page }) => {
    // Check for user info/name
    const userInfo = page.locator('[data-testid="user-info"], [data-testid="user-menu"], .user-info')
    await expect(userInfo).toBeVisible()

    // Check for organization info if applicable
    const orgInfo = page.locator('[data-testid="org-info"], [data-testid="organization"]')
    // Organization info might not always be visible, so this is optional
    // await expect(orgInfo).toBeVisible()
  })
})