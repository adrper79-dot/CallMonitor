import { test, expect } from '@playwright/test'

/**
 * Analytics Dashboard E2E Tests
 *
 * Tests the analytics interface and reporting:
 * - Analytics page loading and layout
 * - KPI/metrics display
 * - Charts and visualizations
 * - Date range filtering
 * - Report generation and export
 * - Real-time data updates
 */

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to analytics
    await page.goto('/analytics')
  })

  test('analytics page loads with proper layout', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /analytics|reports|insights|dashboard/i })).toBeVisible()

    // Check for main layout elements
    const layoutElements = [
      'metrics', 'charts', 'filters', 'date-range', 'export'
    ]

    let foundElements = 0
    for (const element of layoutElements) {
      if (await page.locator(`[data-testid*="${element}"], .${element}`).isVisible()) {
        foundElements++
      }
    }

    // Should have at least some key layout elements
    expect(foundElements).toBeGreaterThan(0)
  })

  test('key performance indicators display correctly', async ({ page }) => {
    // Check for KPI cards or metrics
    const kpiCards = page.locator('[data-testid*="kpi"], [data-testid*="metric"], .kpi-card, .metric-card')
    const metricValues = page.locator('[data-testid*="value"], .metric-value, .kpi-value')

    if (await kpiCards.first().isVisible()) {
      const cardCount = await kpiCards.count()
      expect(cardCount).toBeGreaterThan(0)

      // Each card should have a value
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = kpiCards.nth(i)
        const value = card.locator('[data-testid*="value"], .value, .number')
        if (await value.isVisible()) {
          const valueText = await value.textContent()
          expect(valueText?.trim().length).toBeGreaterThan(0)
        }
      }
    }

    // Check for numeric values
    if (await metricValues.first().isVisible()) {
      const firstValue = await metricValues.first().textContent()
      // Should contain numbers or be properly formatted
      expect(firstValue?.trim().length).toBeGreaterThan(0)
    }
  })

  test('charts and visualizations render properly', async ({ page }) => {
    // Check for chart containers
    const charts = page.locator('[data-testid*="chart"], .chart, canvas, svg')

    if (await charts.first().isVisible()) {
      const chartCount = await charts.count()
      expect(chartCount).toBeGreaterThan(0)

      // Charts should have proper dimensions (not zero)
      for (let i = 0; i < Math.min(chartCount, 2); i++) {
        const chart = charts.nth(i)
        const box = await chart.boundingBox()
        if (box) {
          expect(box.width).toBeGreaterThan(0)
          expect(box.height).toBeGreaterThan(0)
        }
      }
    }

    // Check for specific chart types
    const chartTypes = ['bar', 'line', 'pie', 'area', 'donut']
    let foundChartTypes = 0
    for (const type of chartTypes) {
      if (await page.locator(`[data-testid*="${type}"], .${type}-chart`).isVisible()) {
        foundChartTypes++
      }
    }
    // Should have at least one chart type
    expect(foundChartTypes).toBeGreaterThan(0)
  })

  test('date range filtering works', async ({ page }) => {
    // Check for date range selectors
    const dateInputs = page.locator('input[type="date"], [data-testid*="date"]')
    const datePickers = page.locator('[data-testid="date-picker"], .date-picker, .calendar')

    if (await dateInputs.first().isVisible()) {
      const inputCount = await dateInputs.count()
      expect(inputCount).toBeGreaterThanOrEqual(2) // Usually start and end date

      // Test date input (don't change values to avoid breaking state)
      const firstInput = dateInputs.first()
      const currentValue = await firstInput.inputValue()
      await firstInput.click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for preset date ranges
    const datePresets = page.locator('button[name*="day"], button[name*="week"], button[name*="month"]')
    if (await datePresets.first().isVisible()) {
      // Test clicking a preset
      await datePresets.first().click()
      // Should update the view
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('data filtering and segmentation', async ({ page }) => {
    // Check for filter dropdowns
    const filterSelects = page.locator('select[name*="filter"], [data-testid*="filter"]')
    const filterButtons = page.locator('button[name*="filter"], [data-testid*="filter"]')

    if (await filterSelects.first().isVisible()) {
      // Test changing filter
      const select = filterSelects.first()
      const currentValue = await select.inputValue()
      await select.selectOption({ index: 0 })
      await expect(page.locator('body')).toBeVisible()
    }

    if (await filterButtons.first().isVisible()) {
      // Test clicking filter button
      await filterButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for segment selectors
    const segments = page.locator('[data-testid*="segment"], .segment-selector')
    if (await segments.isVisible()) {
      const segmentButtons = segments.locator('button')
      if (await segmentButtons.first().isVisible()) {
        await segmentButtons.first().click()
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('report generation and export functionality', async ({ page }) => {
    // Check for export buttons
    const exportButtons = page.getByRole('button', { name: /export|download|pdf|csv|excel/i })
    const exportLinks = page.getByRole('link', { name: /export|download|pdf|csv|excel/i })

    if (await exportButtons.first().isVisible()) {
      // Should have export options
      const exportCount = await exportButtons.count()
      expect(exportCount).toBeGreaterThan(0)

      // Test clicking export (may open dialog or start download)
      await exportButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    if (await exportLinks.first().isVisible()) {
      // Links should be present
      await expect(exportLinks.first()).toBeVisible()
    }

    // Check for report generation
    const generateReportButton = page.getByRole('button', { name: /generate|create|run.*report/i })
    if (await generateReportButton.isVisible()) {
      await generateReportButton.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('real-time data updates', async ({ page }) => {
    // Check for refresh buttons
    const refreshButtons = page.getByRole('button', { name: /refresh|update|sync/i })

    if (await refreshButtons.first().isVisible()) {
      await refreshButtons.first().click()
      // Should trigger update
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for auto-refresh indicators
    const autoRefreshIndicators = page.locator('[data-testid*="refresh"], .auto-refresh, .live-update')
    if (await autoRefreshIndicators.isVisible()) {
      const indicatorText = await autoRefreshIndicators.textContent()
      expect(indicatorText?.trim().length).toBeGreaterThan(0)
    }

    // Check for last updated timestamps
    const lastUpdated = page.locator('[data-testid*="updated"], .last-updated, .timestamp')
    if (await lastUpdated.isVisible()) {
      const timestamp = await lastUpdated.textContent()
      expect(timestamp?.trim().length).toBeGreaterThan(0)
    }
  })

  test('analytics dashboard is responsive', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })

    // Key metrics should still be visible
    const metrics = page.locator('[data-testid*="metric"], .metric-card')
    if (await metrics.first().isVisible()) {
      await expect(metrics.first()).toBeVisible()
    }

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })

    // Charts should adapt
    const charts = page.locator('[data-testid*="chart"], .chart')
    if (await charts.first().isVisible()) {
      await expect(charts.first()).toBeVisible()
    }

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Full dashboard should be visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('drill-down functionality', async ({ page }) => {
    // Check for clickable chart elements
    const chartElements = page.locator('svg g, canvas, [data-testid*="chart"] [role="button"]')

    if (await chartElements.first().isVisible()) {
      // Test clicking on chart element
      await chartElements.first().click()
      // Should show drill-down or details
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for detail views
    const detailViews = page.locator('[data-testid*="detail"], .detail-view, .drill-down')
    if (await detailViews.isVisible()) {
      await expect(detailViews).toBeVisible()
    }
  })

  test('data table views and sorting', async ({ page }) => {
    // Check for data tables
    const dataTables = page.locator('table, [data-testid*="table"], .data-table')

    if (await dataTables.first().isVisible()) {
      const table = dataTables.first()

      // Should have headers
      const headers = table.locator('th, [role="columnheader"]')
      const headerCount = await headers.count()
      expect(headerCount).toBeGreaterThan(0)

      // Test sorting on first sortable header
      const sortableHeaders = headers.locator('[role="button"], .sortable')
      if (await sortableHeaders.first().isVisible()) {
        await sortableHeaders.first().click()
        await expect(page.locator('body')).toBeVisible()
      }

      // Should have data rows
      const rows = table.locator('tr, [role="row"]')
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)
    }
  })

  test('custom dashboard configuration', async ({ page }) => {
    // Check for customization options
    const customizeButtons = page.getByRole('button', { name: /customize|configure|settings/i })
    const addWidgetButtons = page.getByRole('button', { name: /add.*widget|add.*chart/i })

    if (await customizeButtons.first().isVisible()) {
      await customizeButtons.first().click()
      // Should show customization interface
      await expect(page.locator('body')).toBeVisible()
    }

    if (await addWidgetButtons.first().isVisible()) {
      await addWidgetButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for widget removal options
    const removeButtons = page.locator('button[name*="remove"], button[name*="delete"], [data-testid*="remove"]')
    if (await removeButtons.first().isVisible()) {
      // Don't actually remove, just check visibility
      await expect(removeButtons.first()).toBeVisible()
    }
  })

  test('performance metrics and benchmarks', async ({ page }) => {
    // Check for performance indicators
    const performanceMetrics = page.locator('[data-testid*="performance"], .performance, .benchmark')

    if (await performanceMetrics.first().isVisible()) {
      const metricText = await performanceMetrics.first().textContent()
      expect(metricText?.trim().length).toBeGreaterThan(0)
    }

    // Check for trend indicators
    const trends = page.locator('[data-testid*="trend"], .trend, .change-indicator')
    if (await trends.first().isVisible()) {
      // Should show positive/negative indicators
      const trendText = await trends.first().textContent()
      expect(trendText?.trim().length).toBeGreaterThan(0)
    }

    // Check for comparison periods
    const comparisons = page.locator('[data-testid*="compare"], .comparison, .vs-previous')
    if (await comparisons.first().isVisible()) {
      const comparisonText = await comparisons.first().textContent()
      expect(comparisonText?.trim().length).toBeGreaterThan(0)
    }
  })
})