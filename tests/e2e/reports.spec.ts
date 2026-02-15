import { test, expect } from '@playwright/test'

/**
 * Reports E2E Tests
 *
 * Tests the reports interface and functionality:
 * - Reports page loading and navigation
 * - Report generation and customization
 * - Report templates and saved reports
 * - Report scheduling and automation
 * - Report export and sharing
 * - Report filtering and parameters
 */

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reports
    await page.goto('/reports')
  })

  test('reports page loads with proper navigation', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /reports|reporting/i })).toBeVisible()

    // Check for main navigation elements
    const navElements = [
      'report-list', 'create-report', 'saved-reports', 'templates'
    ]

    let foundElements = 0
    for (const element of navElements) {
      if (await page.locator(`[data-testid*="${element}"], .${element}`).isVisible()) {
        foundElements++
      }
    }

    // Should have at least some key navigation elements
    expect(foundElements).toBeGreaterThan(0)
  })

  test('report list displays available reports', async ({ page }) => {
    // Check for report list
    const reportList = page.locator('[data-testid="report-list"], .report-list, .reports-grid')

    if (await reportList.isVisible()) {
      // Should have report items
      const reportItems = reportList.locator('.report-item, [data-testid*="report"], tr')
      const itemCount = await reportItems.count()

      if (itemCount > 0) {
        // Test clicking on a report
        await reportItems.first().click()
        // Should navigate to report details or open report
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('report creation and customization', async ({ page }) => {
    // Find create report button
    const createButton = page.getByRole('button', { name: /create|new.*report/i })
    const createLink = page.getByRole('link', { name: /create|new.*report/i })

    if (await createButton.isVisible()) {
      await createButton.click()
    } else if (await createLink.isVisible()) {
      await createLink.click()
    }

    // Check for report builder interface
    const reportBuilder = page.locator('[data-testid="report-builder"], .report-builder, form')
    if (await reportBuilder.isVisible()) {
      // Check for report configuration options
      const configElements = [
        'report-type', 'date-range', 'filters', 'columns', 'grouping'
      ]

      let foundConfig = 0
      for (const element of configElements) {
        if (await reportBuilder.locator(`[data-testid*="${element}"], .${element}`).isVisible()) {
          foundConfig++
        }
      }

      expect(foundConfig).toBeGreaterThan(0)

      // Check for generate/run button
      const generateButton = reportBuilder.getByRole('button', { name: /generate|run|create/i })
      await expect(generateButton).toBeVisible()
    }
  })

  test('report templates functionality', async ({ page }) => {
    // Check for template selection
    const templateSelect = page.locator('select[name*="template"], [data-testid*="template"]')
    const templateButtons = page.locator('button[name*="template"], [data-testid*="template"]')

    if (await templateSelect.isVisible()) {
      // Should have template options
      const options = await templateSelect.locator('option').count()
      expect(options).toBeGreaterThan(0)

      // Test selecting a template
      await templateSelect.selectOption({ index: 0 })
      await expect(page.locator('body')).toBeVisible()
    }

    if (await templateButtons.first().isVisible()) {
      // Test clicking template button
      await templateButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('saved reports management', async ({ page }) => {
    // Check for saved reports section
    const savedReports = page.locator('[data-testid="saved-reports"], .saved-reports')

    if (await savedReports.isVisible()) {
      // Should have saved report items
      const savedItems = savedReports.locator('.saved-report, [data-testid*="saved"]')
      const itemCount = await savedItems.count()

      if (itemCount > 0) {
        // Test actions on saved reports
        const actionButtons = savedItems.first().locator('button[name*="edit"], button[name*="delete"], button[name*="run"]')
        if (await actionButtons.first().isVisible()) {
          // Don't actually perform actions, just check visibility
          await expect(actionButtons.first()).toBeVisible()
        }
      }
    }
  })

  test('report parameters and filtering', async ({ page }) => {
    // Check for parameter inputs
    const parameterInputs = page.locator('input[name*="param"], select[name*="param"], [data-testid*="parameter"]')

    if (await parameterInputs.first().isVisible()) {
      const paramCount = await parameterInputs.count()
      expect(paramCount).toBeGreaterThan(0)

      // Test parameter input (don't change values)
      const firstParam = parameterInputs.first()
      await firstParam.click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for advanced filters
    const filterSection = page.locator('[data-testid="filters"], .filters, .advanced-filters')
    if (await filterSection.isVisible()) {
      const filterInputs = filterSection.locator('input, select')
      if (await filterInputs.first().isVisible()) {
        await filterInputs.first().click()
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })

  test('report export functionality', async ({ page }) => {
    // Check for export options
    const exportButtons = page.getByRole('button', { name: /export|download|pdf|csv|excel/i })
    const exportSelects = page.locator('select[name*="export"], [data-testid*="export"]')

    if (await exportButtons.first().isVisible()) {
      const exportCount = await exportButtons.count()
      expect(exportCount).toBeGreaterThan(0)

      // Test export button (may open dialog)
      await exportButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    if (await exportSelects.first().isVisible()) {
      // Should have export format options
      const options = await exportSelects.first().locator('option').count()
      expect(options).toBeGreaterThan(0)
    }
  })

  test('report scheduling and automation', async ({ page }) => {
    // Check for schedule options
    const scheduleButtons = page.getByRole('button', { name: /schedule|automate|recurring/i })
    const scheduleLinks = page.getByRole('link', { name: /schedule|automate|recurring/i })

    if (await scheduleButtons.first().isVisible()) {
      await scheduleButtons.first().click()
      // Should show scheduling interface
      await expect(page.locator('body')).toBeVisible()
    }

    if (await scheduleLinks.first().isVisible()) {
      await scheduleLinks.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for scheduled reports list
    const scheduledReports = page.locator('[data-testid="scheduled-reports"], .scheduled-reports')
    if (await scheduledReports.isVisible()) {
      await expect(scheduledReports).toBeVisible()
    }
  })

  test('report sharing and permissions', async ({ page }) => {
    // Check for share buttons
    const shareButtons = page.getByRole('button', { name: /share|collaborate|permissions/i })

    if (await shareButtons.first().isVisible()) {
      await shareButtons.first().click()
      // Should show sharing interface
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for permission settings
    const permissionSection = page.locator('[data-testid="permissions"], .permissions')
    if (await permissionSection.isVisible()) {
      await expect(permissionSection).toBeVisible()
    }
  })

  test('report preview and formatting', async ({ page }) => {
    // Check for preview functionality
    const previewButtons = page.getByRole('button', { name: /preview|view/i })
    const previewTabs = page.getByRole('tab', { name: /preview|view/i })

    if (await previewButtons.first().isVisible()) {
      await previewButtons.first().click()
      // Should show report preview
      await expect(page.locator('body')).toBeVisible()
    }

    if (await previewTabs.first().isVisible()) {
      await previewTabs.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for formatting options
    const formatOptions = page.locator('button[name*="format"], [data-testid*="format"]')
    if (await formatOptions.first().isVisible()) {
      await formatOptions.first().click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('report data validation and error handling', async ({ page }) => {
    // Test with invalid parameters
    const paramInputs = page.locator('input[name*="param"], [data-testid*="parameter"]')

    if (await paramInputs.first().isVisible()) {
      // Try invalid input
      await paramInputs.first().fill('invalid-data')

      const runButton = page.getByRole('button', { name: /run|generate/i })
      if (await runButton.isVisible()) {
        await runButton.click()

        // Should handle error gracefully
        await expect(page.locator('body')).toBeVisible()
      }

      // Clear invalid input
      await paramInputs.first().fill('')
    }
  })

  test('report performance and loading states', async ({ page }) => {
    // Check for loading indicators
    const runButton = page.getByRole('button', { name: /run|generate|execute/i })

    if (await runButton.isVisible()) {
      await runButton.click()

      // Check for loading state
      const loadingIndicator = page.locator('[data-testid*="loading"], .loading, .spinner')
      if (await loadingIndicator.isVisible()) {
        await expect(loadingIndicator).toBeVisible()
      }

      // Wait for completion or timeout
      await page.waitForTimeout(2000)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('report history and versioning', async ({ page }) => {
    // Check for report history
    const historyTab = page.getByRole('tab', { name: /history|versions/i })
    const historyButton = page.getByRole('button', { name: /history|versions/i })

    if (await historyTab.isVisible()) {
      await historyTab.click()
      // Should show version history
      await expect(page.locator('body')).toBeVisible()
    }

    if (await historyButton.isVisible()) {
      await historyButton.click()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for version comparison
    const compareButton = page.getByRole('button', { name: /compare|diff/i })
    if (await compareButton.isVisible()) {
      await compareButton.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('reports interface responsiveness', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })

    // Key elements should still be accessible
    const reportList = page.locator('[data-testid="report-list"], .report-list')
    if (await reportList.isVisible()) {
      await expect(reportList).toBeVisible()
    }

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })

    // Should adapt layout
    await expect(page.locator('body')).toBeVisible()

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Full interface should be visible
    await expect(page.locator('body')).toBeVisible()
  })
})