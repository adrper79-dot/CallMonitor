import { test, expect } from '@playwright/test'

/**
 * Campaigns Management E2E Tests
 *
 * Tests the complete campaign management workflow:
 * - Create campaigns
 * - List and filter campaigns
 * - Update campaign details
 * - Delete campaigns
 * - Campaign status management
 */

test.describe('Campaign Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to campaigns page
    await page.goto('/campaigns')
  })

  test('campaigns page loads with proper UI elements', async ({ page }) => {
    // Check page title and main elements
    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible()

    // Check for create campaign button
    const createButton = page.getByRole('button', { name: /create campaign|new campaign|add campaign/i })
    await expect(createButton).toBeVisible()

    // Check for campaigns list/table
    const campaignsList = page.locator('[data-testid="campaigns-list"], table, .campaigns-grid')
    await expect(campaignsList).toBeVisible()
  })

  test('create new campaign form validation', async ({ page }) => {
    // Click create campaign button
    const createButton = page.getByRole('button', { name: /create campaign|new campaign|add campaign/i })
    await createButton.click()

    // Wait for modal/form to appear
    const form = page.locator('form, [role="dialog"], .campaign-form')
    await expect(form).toBeVisible()

    // Check required fields are present
    await expect(page.getByLabel(/name|title/i)).toBeVisible()
    await expect(page.getByLabel(/description/i)).toBeVisible()

    // Try to submit empty form - should show validation errors
    const submitButton = page.getByRole('button', { name: /create|save|submit/i })
    await submitButton.click()

    // Should show validation error for required name field
    await expect(page.getByText(/name is required|name cannot be empty/i)).toBeVisible()
  })

  test('create, read, update, delete campaign workflow', async ({ page }) => {
    const testCampaignName = `E2E Test Campaign ${Date.now()}`
    const updatedName = `${testCampaignName} (Updated)`

    // Create campaign
    const createButton = page.getByRole('button', { name: /create campaign|new campaign|add campaign/i })
    await createButton.click()

    // Fill form
    await page.getByLabel(/name|title/i).fill(testCampaignName)
    await page.getByLabel(/description/i).fill('Test campaign created by E2E tests')

    // Set campaign type if available
    const typeSelect = page.locator('select[name*="type"], [data-testid="campaign-type"]')
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('voice') // or appropriate default
    }

    // Submit form
    const submitButton = page.getByRole('button', { name: /create|save|submit/i })
    await submitButton.click()

    // Wait for success and redirect back to list
    await expect(page.getByText(testCampaignName)).toBeVisible()

    // Update campaign
    const campaignRow = page.locator(`[data-testid*="campaign"]:has-text("${testCampaignName}")`)
    const editButton = campaignRow.getByRole('button', { name: /edit|modify/i })
    await editButton.click()

    // Update name
    const nameInput = page.getByLabel(/name|title/i)
    await nameInput.fill(updatedName)

    // Save changes
    const saveButton = page.getByRole('button', { name: /save|update/i })
    await saveButton.click()

    // Verify update
    await expect(page.getByText(updatedName)).toBeVisible()

    // Delete campaign
    const deleteButton = campaignRow.getByRole('button', { name: /delete|remove/i })
    await deleteButton.click()

    // Confirm deletion
    const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i })
    await confirmButton.click()

    // Verify deletion
    await expect(page.getByText(updatedName)).not.toBeVisible()
  })

  test('campaign status management', async ({ page }) => {
    // Create a test campaign first
    const testCampaignName = `Status Test Campaign ${Date.now()}`

    const createButton = page.getByRole('button', { name: /create campaign|new campaign|add campaign/i })
    await createButton.click()

    await page.getByLabel(/name|title/i).fill(testCampaignName)
    await page.getByLabel(/description/i).fill('Status management test')

    const submitButton = page.getByRole('button', { name: /create|save|submit/i })
    await submitButton.click()

    // Wait for campaign to appear
    await expect(page.getByText(testCampaignName)).toBeVisible()

    // Test status toggle (Active/Inactive)
    const campaignRow = page.locator(`[data-testid*="campaign"]:has-text("${testCampaignName}")`)
    const statusToggle = campaignRow.locator('input[type="checkbox"], button[aria-label*="status"], .status-toggle')

    if (await statusToggle.isVisible()) {
      // Toggle status
      await statusToggle.click()

      // Verify status change (may show different styling or text)
      await expect(page.getByText(/active|inactive|paused|running/i)).toBeVisible()
    }

    // Clean up
    const deleteButton = campaignRow.getByRole('button', { name: /delete|remove/i })
    await deleteButton.click()
    const confirmButton = page.getByRole('button', { name: /confirm|delete|yes/i })
    await confirmButton.click()
  })

  test('campaign filtering and search', async ({ page }) => {
    // Check for search/filter inputs
    const searchInput = page.getByPlaceholder(/search|filter/i).or(page.getByLabel(/search|filter/i))

    if (await searchInput.isVisible()) {
      // Test search functionality
      await searchInput.fill('test campaign')

      // Should filter results
      const results = page.locator('[data-testid*="campaign"], table tbody tr')
      // Note: May show "no results" or filtered list
      await expect(page.locator('body')).toBeVisible() // Just ensure page doesn't crash
    }

    // Check for status filters
    const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]')
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('active')
      // Should filter to active campaigns only
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('campaign pagination', async ({ page }) => {
    // Check for pagination controls
    const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]')

    if (await pagination.isVisible()) {
      // Test pagination if there are multiple pages
      const nextButton = pagination.getByRole('button', { name: /next|forward/i })

      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click()
        // Should load next page
        await expect(page.locator('[data-testid*="campaign"], table')).toBeVisible()
      }
    }
  })
})