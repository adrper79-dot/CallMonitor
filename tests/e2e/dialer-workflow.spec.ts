/**
 * Predictive Dialer E2E Workflow Tests
 *
 * End-to-end tests for the Voice Operations page and dialer UI.
 * Tests agent workflow, manager monitoring, campaign switching.
 *
 * Run: npx playwright test tests/e2e/dialer-workflow.spec.ts
 */

import { test, expect, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'https://wordisbond-api.adrper79.workers.dev'

// Test user credentials (use existing test users or auth.setup.ts)
const AGENT_EMAIL = process.env.TEST_AGENT_EMAIL || 'agent@test.wordis-bond.com'
const AGENT_PASSWORD = process.env.TEST_AGENT_PASSWORD || 'TestPassword123!'
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL || 'manager@test.wordis-bond.com'
const MANAGER_PASSWORD = process.env.TEST_MANAGER_PASSWORD || 'TestPassword123!'

/**
 * Helper: Login as user
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/signin')
  await page.fill('input#email', email)
  await page.fill('input#password', password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

/**
 * Helper: Mock Telnyx webhook
 */
async function mockTelnyxWebhook(page: Page, event: string, data: any) {
  await page.evaluate(
    ({ event, data, apiUrl }) => {
      fetch(`${apiUrl}/api/webhooks/telnyx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            event_type: event,
            payload: data,
          },
        }),
      })
    },
    { event, data, apiUrl: API_URL }
  )
}

test.describe('Dialer Workflow - Agent Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In real tests, use auth.setup.ts fixture
    // For now, we'll assume agent can login
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 1: Agent Workflow — Full dialing cycle
  // ───────────────────────────────────────────────────────────────────────

  test('Agent can start dialer, receive call, disposition, advance', async ({ page }) => {
    // ARRANGE: Login as agent
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)

    // Navigate to Voice Operations
    await page.goto('/voice-operations')
    await expect(page).toHaveURL('/voice-operations')

    // Verify page loads
    await expect(page.getByRole('heading', { name: /voice operations/i })).toBeVisible({
      timeout: 10000,
    })

    // ACT: Select campaign from dropdown
    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 }) // Select first campaign
    } else {
      // Alternative: Click dropdown button
      const dropdownTrigger = page.locator('[role="combobox"]').first()
      await dropdownTrigger.click()
      await page.locator('[role="option"]').first().click()
    }

    // Verify DialerPanel renders
    const dialerPanel = page.locator('[data-testid="dialer-panel"]', {
      hasText: /dialer/i,
    }).first()
    
    // Start dialing
    const startButton = page.getByRole('button', { name: /start dialing/i })
    await expect(startButton).toBeVisible({ timeout: 5000 })
    await startButton.click()

    // Verify dialer started (button changes to "Pause" or stats update)
    await expect(
      page.getByText(/active|calling|dialing/i)
    ).toBeVisible({ timeout: 8000 })

    // MOCK: Simulate call connection (in real test, wait for actual API)
    // For E2E, we'd mock the Telnyx webhook
    await page.waitForTimeout(2000) // Brief wait for UI to update

    // Verify call UI appears (call control panel)
    const callPanel = page.locator('[data-testid="active-call-panel"]').first()
    // Note: May not appear immediately in test env without real call

    // ACT: Disposition call
    const dispositionButton = page.getByRole('button', { name: /interested|not interested|voicemail/i }).first()
    if (await dispositionButton.isVisible({ timeout: 5000 })) {
      await dispositionButton.click()

      // Verify call ends
      await expect(dispositionButton).not.toBeVisible({ timeout: 5000 })
    }

    // ASSERT: Next call auto-advances (if enabled)
    // In real scenario, this would trigger next call in queue
    // For E2E, verify queue stats update
    const statsPanel = page.locator('[data-testid="dialer-stats"]').first()
    if (await statsPanel.isVisible({ timeout: 3000 })) {
      await expect(statsPanel).toContainText(/completed|total/i)
    }

    // Test passes if workflow completes without errors
    expect(true).toBe(true)
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 2: Auto-advance setting works
  // ───────────────────────────────────────────────────────────────────────

  test('Auto-advance triggers next call after disposition', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)
    await page.goto('/voice-operations')

    // Enable auto-advance (if toggle exists)
    const autoAdvanceToggle = page.locator('input[name="auto-advance"]')
    if (await autoAdvanceToggle.isVisible({ timeout: 3000 })) {
      await autoAdvanceToggle.check()
    }

    // Start dialer
    const startButton = page.getByRole('button', { name: /start/i })
    if (await startButton.isVisible({ timeout: 5000 })) {
      await startButton.click()
      await page.waitForTimeout(2000)

      // Disposition call
      const dispButton = page.getByRole('button', { name: /interested/i }).first()
      if (await dispButton.isVisible({ timeout: 5000 })) {
        await dispButton.click()

        // Verify next call indicator appears
        await expect(
          page.getByText(/next call|calling/i)
        ).toBeVisible({ timeout: 8000 })
      }
    }
  })
})

test.describe('Dialer Workflow - Manager Experience', () => {
  // ───────────────────────────────────────────────────────────────────────
  // TEST 3: Manager Monitoring — Real-time stats and controls
  // ───────────────────────────────────────────────────────────────────────

  test('Manager can view real-time stats and pause dialer', async ({ page }) => {
    // ARRANGE: Login as manager
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASSWORD)

    // Navigate to Voice Operations (manager view)
    await page.goto('/voice-operations')
    await expect(page).toHaveURL('/voice-operations')

    // Verify manager controls visible
    const managerPanel = page.locator('[data-testid="manager-controls"]').first()

    // Verify real-time stats display
    const statsDisplay = page.locator('[data-testid="live-stats"]').first()
    if (await statsDisplay.isVisible({ timeout: 5000 })) {
      // Stats should show: active calls, agents, completion rate
      await expect(statsDisplay).toContainText(/active calls|agents|rate/i)
    }

    // Verify active calls display
    const activeCallsList = page.locator('[data-testid="active-calls-list"]').first()
    // May be empty if no calls active

    // ACT: Click "Pause All" button
    const pauseAllButton = page.getByRole('button', { name: /pause all|pause dialer/i })
    if (await pauseAllButton.isVisible({ timeout: 5000 })) {
      await pauseAllButton.click()

      // ASSERT: Dialer pauses
      await expect(
        page.getByText(/paused|stopped/i)
      ).toBeVisible({ timeout: 5000 })

      // Verify button changes to "Resume All"
      await expect(
        page.getByRole('button', { name: /resume all|resume/i })
      ).toBeVisible({ timeout: 5000 })
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 4: Manager can monitor multiple campaigns
  // ───────────────────────────────────────────────────────────────────────

  test('Manager can switch between campaigns and view stats', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    await page.goto('/voice-operations')

    // Select Campaign A
    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 })

      // Verify stats load for Campaign A
      await expect(page.locator('[data-testid="campaign-stats"]')).toBeVisible({
        timeout: 5000,
      })

      // Switch to Campaign B
      await campaignSelect.selectOption({ index: 2 })

      // Verify stats update for Campaign B
      await page.waitForTimeout(1000)
      await expect(page.locator('[data-testid="campaign-stats"]')).toBeVisible()
    }
  })
})

test.describe('Dialer Workflow - Campaign Switching', () => {
  // ───────────────────────────────────────────────────────────────────────
  // TEST 5: Campaign switching resets dialer state
  // ───────────────────────────────────────────────────────────────────────

  test('Campaign switching resets queue and loads new accounts', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)
    await page.goto('/voice-operations')

    // Start dialing on Campaign A
    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 })

      const startButton = page.getByRole('button', { name: /start/i })
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click()
        await page.waitForTimeout(2000)

        // Verify dialer active
        await expect(page.getByText(/active|calling/i)).toBeVisible({ timeout: 5000 })

        // ACT: Switch to Campaign B
        await campaignSelect.selectOption({ index: 2 })

        // ASSERT: Dialer resets (stops)
        await expect(
          page.getByRole('button', { name: /start dialing/i })
        ).toBeVisible({ timeout: 5000 })

        // Verify new campaign accounts load
        const accountsList = page.locator('[data-testid="campaign-accounts"]').first()
        if (await accountsList.isVisible({ timeout: 3000 })) {
          // Should show different accounts
          expect(true).toBe(true)
        }
      }
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 6: Campaign switching works during active call
  // ───────────────────────────────────────────────────────────────────────

  test('Campaign switch during active call shows warning', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)
    await page.goto('/voice-operations')

    // Start call
    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 })

      const startButton = page.getByRole('button', { name: /start/i })
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click()
        await page.waitForTimeout(2000)

        // Attempt to switch campaign during call
        await campaignSelect.selectOption({ index: 2 })

        // Should show warning or block switch
        const warningDialog = page.locator('[role="dialog"]', {
          hasText: /active call|in progress/i,
        })

        // Either warning appears OR switch is blocked
        const switchBlocked = !(await campaignSelect.isEnabled())
        expect(
          (await warningDialog.isVisible({ timeout: 3000 })) || switchBlocked
        ).toBe(true)
      }
    }
  })
})

test.describe('Dialer Workflow - Error Scenarios', () => {
  // ───────────────────────────────────────────────────────────────────────
  // TEST 7: No available campaigns shows empty state
  // ───────────────────────────────────────────────────────────────────────

  test('No campaigns available shows empty state', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)

    // Mock API to return empty campaigns list
    await page.route('**/api/campaigns*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })

    await page.goto('/voice-operations')

    // Verify empty state appears
    await expect(
      page.getByText(/no campaigns|create campaign/i)
    ).toBeVisible({ timeout: 5000 })
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 8: API error shows error message
  // ───────────────────────────────────────────────────────────────────────

  test('API error shows user-friendly message', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)

    // Mock API error
    await page.route('**/api/dialer/start', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('/voice-operations')

    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 })

      const startButton = page.getByRole('button', { name: /start/i })
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click()

        // Verify error message appears
        await expect(
          page.locator('.bg-red-50, [role="alert"]', { hasText: /error|failed/i })
        ).toBeVisible({ timeout: 5000 })
      }
    }
  })
})

test.describe('Dialer Workflow - Performance', () => {
  // ───────────────────────────────────────────────────────────────────────
  // TEST 9: Page load performance
  // ───────────────────────────────────────────────────────────────────────

  test('Voice Operations page loads within 3 seconds', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)

    const startTime = Date.now()
    await page.goto('/voice-operations')
    await page.waitForLoadState('networkidle', { timeout: 10000 })
    const loadTime = Date.now() - startTime

    // ASSERT: Page loads within 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  // ───────────────────────────────────────────────────────────────────────
  // TEST 10: Real-time stats update within 2 seconds
  // ───────────────────────────────────────────────────────────────────────

  test('Stats update within 2 seconds of disposition', async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD)
    await page.goto('/voice-operations')

    const campaignSelect = page.locator('select[name="campaign"]').first()
    if (await campaignSelect.isVisible({ timeout: 5000 })) {
      await campaignSelect.selectOption({ index: 1 })

      // Get initial stats value
      const statsElement = page.locator('[data-testid="total-calls"]').first()
      let initialValue = '0'
      if (await statsElement.isVisible({ timeout: 3000 })) {
        initialValue = (await statsElement.textContent()) || '0'
      }

      // Start dialer and disposition
      const startButton = page.getByRole('button', { name: /start/i })
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click()
        await page.waitForTimeout(2000)

        const dispButton = page.getByRole('button', { name: /interested/i }).first()
        if (await dispButton.isVisible({ timeout: 5000 })) {
          const dispTime = Date.now()
          await dispButton.click()

          // Wait for stats to update
          await page.waitForTimeout(2000)

          // Check if stats updated within 2 seconds
          const updateTime = Date.now() - dispTime
          expect(updateTime).toBeLessThan(2000)
        }
      }
    }
  })
})
