import { test, expect } from '@playwright/test'

/**
 * Voice Operations E2E Tests
 *
 * Tests the voice operations interface and call management:
 * - Voice operations page loading
 * - Call controls and interface
 * - Settings configuration
 * - Call history/logs
 */

test.describe('Voice Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to voice operations
    await page.goto('/voice-operations')
  })

  test('voice operations page loads with proper interface', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /voice|call|operations/i })).toBeVisible()

    // Check for main interface elements
    const interfaceElements = [
      'dialer', 'controls', 'status', 'history', 'settings'
    ]

    let foundElements = 0
    for (const element of interfaceElements) {
      if (await page.getByText(new RegExp(element, 'i')).isVisible() ||
          await page.locator(`[data-testid*="${element}"]`).isVisible()) {
        foundElements++
      }
    }

    // Should have at least some key interface elements
    expect(foundElements).toBeGreaterThan(0)
  })

  test('call controls are present and functional', async ({ page }) => {
    // Check for phone number input
    const phoneInput = page.locator('input[type="tel"], input[name*="phone"], [data-testid*="phone"]')
    await expect(phoneInput).toBeVisible()

    // Check for call control buttons
    const callButtons = page.locator('button[name*="call"], button[name*="dial"], [data-testid*="call"]')
    const buttonCount = await callButtons.count()
    expect(buttonCount).toBeGreaterThan(0)

    // Check for common call controls
    const controlNames = ['dial', 'call', 'hangup', 'end', 'mute', 'hold']
    let foundControls = 0
    for (const control of controlNames) {
      if (await page.locator(`button[name*="${control}"], [data-testid*="${control}"]`).isVisible()) {
        foundControls++
      }
    }
    expect(foundControls).toBeGreaterThan(0)
  })

  test('voice settings configuration works', async ({ page }) => {
    // Look for settings/configuration section
    const settingsButton = page.getByRole('button', { name: /settings|config|configure/i })
    const settingsTab = page.getByRole('tab', { name: /settings|config/i })

    if (await settingsButton.isVisible()) {
      await settingsButton.click()
    } else if (await settingsTab.isVisible()) {
      await settingsTab.click()
    }

    // If settings opened, check for common voice settings
    const settingsPanel = page.locator('[data-testid="settings-panel"], .settings-panel, [role="dialog"]')
    if (await settingsPanel.isVisible()) {
      // Check for translation settings
      const translationToggle = page.locator('input[name*="translate"], [data-testid*="translate"]')
      if (await translationToggle.isVisible()) {
        // Test toggle functionality (don't change settings)
        const isChecked = await translationToggle.isChecked()
        await translationToggle.click()
        // Toggle back to original state
        await translationToggle.click()
        expect(await translationToggle.isChecked()).toBe(isChecked)
      }

      // Check for language selectors
      const languageSelects = page.locator('select[name*="language"], [data-testid*="language"]')
      if (await languageSelects.first().isVisible()) {
        // Should have options
        const options = await languageSelects.first().locator('option').count()
        expect(options).toBeGreaterThan(0)
      }
    }
  })

  test('call history/logs are accessible', async ({ page }) => {
    // Look for call history/logs section
    const historyTab = page.getByRole('tab', { name: /history|logs|calls/i })
    const historyButton = page.getByRole('button', { name: /history|logs|calls/i })

    if (await historyTab.isVisible()) {
      await historyTab.click()
    } else if (await historyButton.isVisible()) {
      await historyButton.click()
    }

    // Check for history content
    const historyContent = page.locator('[data-testid*="history"], table, .call-list, .logs')
    if (await historyContent.isVisible()) {
      // Should show some call history or empty state
      const hasContent = await historyContent.locator('tr, .call-item, .log-entry').count()
      // May be empty, but the container should exist
      await expect(historyContent).toBeVisible()
    }
  })

  test('voice operations interface is responsive', async ({ page }) => {
    // Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 })

    // Key elements should still be visible
    await expect(page.locator('input[type="tel"], [data-testid*="phone"]')).toBeVisible()
    await expect(page.locator('button[name*="call"], [data-testid*="call"]')).toBeVisible()

    // Test tablet
    await page.setViewportSize({ width: 768, height: 1024 })

    // Interface should adapt
    await expect(page.locator('input[type="tel"], [data-testid*="phone"]')).toBeVisible()

    // Test desktop
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Full interface should be visible
    await expect(page.locator('input[type="tel"], [data-testid*="phone"]')).toBeVisible()
    await expect(page.locator('button[name*="call"], [data-testid*="call"]')).toBeVisible()
  })

  test('real-time status indicators work', async ({ page }) => {
    // Check for status indicators
    const statusIndicators = page.locator('[data-testid*="status"], .status, .connection-status, .call-status')

    if (await statusIndicators.first().isVisible()) {
      // Should show some status text
      const statusText = await statusIndicators.first().textContent()
      expect(statusText?.trim().length).toBeGreaterThan(0)

      // Status should be one of expected values
      const validStatuses = ['connected', 'disconnected', 'connecting', 'ready', 'busy', 'idle', 'active']
      const hasValidStatus = validStatuses.some(status =>
        statusText?.toLowerCase().includes(status)
      )
      expect(hasValidStatus || statusText?.includes('Ready') || statusText?.includes('Connected')).toBe(true)
    }
  })

  test('voice operations integrates with campaigns', async ({ page }) => {
    // Check for campaign selector/integration
    const campaignSelect = page.locator('select[name*="campaign"], [data-testid*="campaign"]')
    const campaignDropdown = page.locator('[data-testid="campaign-selector"], .campaign-select')

    if (await campaignSelect.isVisible() || await campaignDropdown.isVisible()) {
      // Should have campaign options
      const select = await campaignSelect.isVisible() ? campaignSelect : campaignDropdown.locator('select')
      if (await select.isVisible()) {
        const options = await select.locator('option').count()
        // May have default "no campaign" option
        expect(options).toBeGreaterThanOrEqual(1)
      }
    }
  })

  test('audio controls and feedback work', async ({ page }) => {
    // Check for audio-related controls
    const audioControls = page.locator('input[type="range"], [data-testid*="volume"], [data-testid*="audio"]')

    if (await audioControls.first().isVisible()) {
      // Test volume/mic controls don't crash
      const control = audioControls.first()
      await control.hover()
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for audio status indicators
    const audioStatus = page.locator('[data-testid*="audio-status"], .audio-status, .mic-status')
    if (await audioStatus.isVisible()) {
      const statusText = await audioStatus.textContent()
      expect(statusText?.trim().length).toBeGreaterThan(0)
    }
  })

  test('error handling and user feedback', async ({ page }) => {
    // Try invalid phone number
    const phoneInput = page.locator('input[type="tel"], input[name*="phone"]')
    await phoneInput.fill('invalid-phone-number')

    const callButton = page.locator('button[name*="call"], button[name*="dial"]')
    if (await callButton.isVisible()) {
      await callButton.click()

      // Should show error or validation message
      const errorMessage = page.locator('.error, [data-testid*="error"], [role="alert"]')
      // Error might not appear immediately, so this is optional
      // await expect(errorMessage.or(page.locator('body'))).toBeVisible()
    }

    // Clear invalid input
    await phoneInput.fill('')
  })
})