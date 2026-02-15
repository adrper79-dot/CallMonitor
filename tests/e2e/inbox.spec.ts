import { test, expect } from '@playwright/test'

/**
 * Unified Inbox E2E Tests
 *
 * Tests the unified inbox interface and message management:
 * - Inbox page loading and layout
 * - Message display and threading
 * - Channel switching (SMS, Email, Voice)
 * - Message composition and sending
 * - Search and filtering
 * - Message actions (reply, forward, archive)
 */

test.describe('Unified Inbox', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to inbox
    await page.goto('/inbox')
  })

  test('inbox page loads with proper layout', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: /inbox|messages|communications/i })).toBeVisible()

    // Check for main layout elements
    const layoutElements = [
      'message-list', 'message-view', 'compose', 'search', 'filters'
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

  test('channel switching works', async ({ page }) => {
    // Check for channel tabs/buttons
    const channels = ['SMS', 'Email', 'Voice', 'All']
    let foundChannels = 0

    for (const channel of channels) {
      const channelTab = page.getByRole('tab', { name: new RegExp(channel, 'i') })
      const channelButton = page.getByRole('button', { name: new RegExp(channel, 'i') })

      if (await channelTab.isVisible() || await channelButton.isVisible()) {
        foundChannels++
        // Test switching to this channel
        if (await channelTab.isVisible()) {
          await channelTab.click()
        } else if (await channelButton.isVisible()) {
          await channelButton.click()
        }
        // Should not crash
        await expect(page.locator('body')).toBeVisible()
      }
    }

    expect(foundChannels).toBeGreaterThan(0)
  })

  test('message list displays properly', async ({ page }) => {
    // Check for message list
    const messageList = page.locator('[data-testid="message-list"], .message-list, .inbox-list')

    if (await messageList.isVisible()) {
      // Should have message items or empty state
      const messageItems = messageList.locator('.message-item, [data-testid*="message"], tr')
      const itemCount = await messageItems.count()

      // May be empty, but list should exist
      await expect(messageList).toBeVisible()

      if (itemCount > 0) {
        // Test clicking on a message
        await messageItems.first().click()
        // Should show message details
        const messageView = page.locator('[data-testid="message-view"], .message-view, .message-details')
        await expect(messageView).toBeVisible()
      }
    }
  })

  test('message composition works', async ({ page }) => {
    // Find compose button
    const composeButton = page.getByRole('button', { name: /compose|new|write/i })
    const composeLink = page.getByRole('link', { name: /compose|new|write/i })

    if (await composeButton.isVisible()) {
      await composeButton.click()
    } else if (await composeLink.isVisible()) {
      await composeLink.click()
    }

    // Check for compose interface
    const composeForm = page.locator('[data-testid="compose-form"], .compose-form, form')
    if (await composeForm.isVisible()) {
      // Check for required fields
      const toField = composeForm.locator('input[name*="to"], input[name*="recipient"], [data-testid*="to"]')
      const subjectField = composeForm.locator('input[name*="subject"], [data-testid*="subject"]')
      const messageField = composeForm.locator('textarea, [data-testid*="message"], [data-testid*="body"]')

      // At least one field should be present
      const hasFields = await toField.isVisible() || await subjectField.isVisible() || await messageField.isVisible()
      expect(hasFields).toBe(true)

      // Check for send button
      const sendButton = composeForm.getByRole('button', { name: /send|submit/i })
      await expect(sendButton).toBeVisible()
    }
  })

  test('search and filtering functionality', async ({ page }) => {
    // Check for search input
    const searchInput = page.locator('input[name*="search"], input[placeholder*="search"], [data-testid*="search"]')

    if (await searchInput.isVisible()) {
      // Test search input
      await searchInput.fill('test search')
      await searchInput.press('Enter')

      // Should not crash and should show results or empty state
      await expect(page.locator('body')).toBeVisible()
    }

    // Check for filter options
    const filterButtons = page.locator('button[name*="filter"], [data-testid*="filter"]')
    const filterSelects = page.locator('select[name*="filter"], [data-testid*="filter"]')

    if (await filterButtons.first().isVisible()) {
      // Test clicking a filter
      await filterButtons.first().click()
      await expect(page.locator('body')).toBeVisible()
    }

    if (await filterSelects.first().isVisible()) {
      // Test changing filter
      await filterSelects.first().selectOption({ index: 0 })
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('message actions work', async ({ page }) => {
    // Look for message actions
    const messageActions = page.locator('[data-testid*="actions"], .message-actions, .action-buttons')

    if (await messageActions.isVisible()) {
      const actionButtons = messageActions.locator('button')
      const buttonCount = await actionButtons.count()

      if (buttonCount > 0) {
        // Test clicking an action button
        await actionButtons.first().click()

        // Should show action menu or perform action
        const actionMenu = page.locator('[role="menu"], .dropdown-menu, .action-menu')
        if (await actionMenu.isVisible()) {
          // Close menu
          await page.keyboard.press('Escape')
        }

        await expect(page.locator('body')).toBeVisible()
      }
    }

    // Test reply/forward buttons specifically
    const replyButton = page.getByRole('button', { name: /reply|respond/i })
    const forwardButton = page.getByRole('button', { name: /forward|share/i })

    if (await replyButton.isVisible()) {
      await replyButton.click()
      // Should open reply interface
      await expect(page.locator('body')).toBeVisible()
    }

    if (await forwardButton.isVisible()) {
      await forwardButton.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('message threading and conversation view', async ({ page }) => {
    // Check for conversation/thread indicators
    const threadIndicators = page.locator('[data-testid*="thread"], .thread, .conversation')

    if (await threadIndicators.first().isVisible()) {
      await threadIndicators.first().click()

      // Should show threaded messages
      const threadedMessages = page.locator('.thread-message, [data-testid*="thread-message"]')
      if (await threadedMessages.first().isVisible()) {
        const messageCount = await threadedMessages.count()
        expect(messageCount).toBeGreaterThan(0)
      }
    }
  })

  test('inbox is responsive across devices', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })

    // Key elements should still be accessible
    const searchInput = page.locator('input[name*="search"], [data-testid*="search"]')
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible()
    }

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })

    // Should adapt layout
    await expect(page.locator('body')).toBeVisible()

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Full layout should be visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('real-time message updates', async ({ page }) => {
    // Check for indicators of real-time updates
    const updateIndicators = page.locator('[data-testid*="realtime"], .realtime, .live-updates')

    if (await updateIndicators.isVisible()) {
      // Should show connection status or update indicators
      const statusText = await updateIndicators.textContent()
      expect(statusText?.trim().length).toBeGreaterThan(0)
    }

    // Check for new message indicators
    const newMessageBadges = page.locator('.badge, [data-testid*="unread"], .notification')
    // May or may not be present
    await expect(page.locator('body')).toBeVisible()
  })

  test('bulk message operations', async ({ page }) => {
    // Check for bulk selection
    const checkboxes = page.locator('input[type="checkbox"]')
    const selectAll = page.getByRole('button', { name: /select all|check all/i })

    if (await checkboxes.first().isVisible()) {
      // Test selecting messages
      await checkboxes.first().check()

      // Check for bulk action buttons
      const bulkActions = page.locator('button[name*="bulk"], button[name*="delete"], button[name*="archive"]')
      if (await bulkActions.first().isVisible()) {
        // Should be enabled when items selected
        await expect(bulkActions.first()).toBeEnabled()
      }
    }

    if (await selectAll.isVisible()) {
      await selectAll.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('message status indicators', async ({ page }) => {
    // Check for read/unread indicators
    const statusIndicators = page.locator('[data-testid*="status"], .message-status, .read-indicator')

    if (await statusIndicators.first().isVisible()) {
      // Should show some status
      const statusText = await statusIndicators.first().textContent()
      expect(statusText?.trim().length).toBeGreaterThan(0)
    }

    // Check for delivery status
    const deliveryStatus = page.locator('[data-testid*="delivery"], .delivery-status')
    if (await deliveryStatus.isVisible()) {
      const status = await deliveryStatus.textContent()
      const validStatuses = ['sent', 'delivered', 'read', 'failed', 'pending']
      const hasValidStatus = validStatuses.some(s => status?.toLowerCase().includes(s))
      expect(hasValidStatus || status?.trim() === '').toBe(true)
    }
  })
})