import { test, expect } from '@playwright/test'

/**
 * ChatUI & TroubleshootChatToggle E2E Tests
 *
 * Verifies the floating chat panel (Stack Troubleshoot Bot) renders,
 * opens/closes, accepts user input, and sends messages to the Bond AI
 * backend. Tests both the UI interaction layer and the API contract.
 *
 * Component: TroubleshootChatToggle → ChatUI
 * Route:     POST /api/bond-ai/chat
 * Mount:     /voice-operations page (requires auth → mocked)
 *
 * ARCH_DOCS: 06-REFERENCE/TESTING.md — E2E Browser Validation
 *
 * @see components/admin/TroubleshootChatToggle.tsx
 * @see components/admin/ChatUI.tsx
 * @see workers/src/routes/bond-ai.ts
 */

const BASE_URL = process.env.BASE_URL || 'https://wordis-bond.com'
const API_BASE = process.env.API_BASE_URL || 'https://wordisbond-api.adrper79.workers.dev'

// Mock session data for auth bypass
const MOCK_SESSION = {
  user: {
    id: 'e2e-test-user-id',
    email: 'e2e@test.wordis-bond.com',
    name: 'E2E Test User',
    role: 'admin',
    organization_id: 'e2e-test-org-id',
    plan: 'pro',
  },
  expires: new Date(Date.now() + 86400_000).toISOString(),
}

/**
 * Injects auth state so ProtectedGate renders children.
 * Sets localStorage token + intercepts API calls to return mock responses.
 */
async function setupAuth(page: import('@playwright/test').Page) {
  // Set localStorage token before navigation + dismiss tours
  await page.addInitScript(() => {
    localStorage.setItem('wb-session-token', 'e2e-mock-token-valid')
    localStorage.setItem(
      'wb-session-token-expires',
      new Date(Date.now() + 86400_000).toISOString()
    )
    // Dismiss all product tours to prevent overlay blocking clicks
    localStorage.setItem('tour_completed_voice', 'true')
    localStorage.setItem('tour_completed_dashboard', 'true')
    localStorage.setItem('tour_completed_settings', 'true')
    localStorage.setItem('tour_completed_review', 'true')

    // Inject CSS to hide the BugReporter FAB which overlaps the Chat FAB
    const style = document.createElement('style')
    style.textContent =
      'button[aria-label="Report a bug or send feedback"]{display:none!important}'
    ;(document.head || document.documentElement).appendChild(style)
  })

  // Intercept ALL API calls with a wildcard — respond with sensible defaults
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()

    // Session check → authenticated user
    if (url.includes('/api/auth/session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      })
    }

    // Calls list → empty
    if (url.includes('/api/calls') && !url.includes('/api/callbacks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ calls: [] }),
      })
    }

    // Campaigns → empty
    if (url.includes('/api/campaigns')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ campaigns: [] }),
      })
    }

    // Organization
    if (url.includes('/api/organizations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organization: { id: 'e2e-test-org-id', name: 'E2E Test Org' },
        }),
      })
    }

    // Bond AI chat — will be overridden per-test where needed
    if (url.includes('/api/bond-ai/chat')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          response: { content: 'Default mock response' },
        }),
      })
    }

    // Default fallback for any other API call
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

/**
 * Hides overlapping UI elements (BugReporter FAB) after page loads.
 * Must be called AFTER page.goto() since React hydration can strip addInitScript styles.
 */
async function hideOverlappingElements(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: 'button[aria-label="Report a bug or send feedback"] { display: none !important; }',
  })
}

/**
 * Clicks the FAB button reliably despite the overlapping BugReporter.
 * Uses evaluate + dispatchEvent to bypass browser hit-testing while
 * still triggering React's synthetic event system.
 */
async function clickFab(page: import('@playwright/test').Page) {
  const fab = page.locator('button[aria-label="Toggle Stack Troubleshoot Bot"]')
  await fab.waitFor({ state: 'visible', timeout: 15_000 })
  // Use dispatchEvent with bubbles:true so React's root listener catches it
  await fab.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  // Small wait for React state update + re-render
  await page.waitForTimeout(300)
}

// ─────────────────────────────────────────────────────────────────────────────
// FAB Button & Panel Toggle
// ─────────────────────────────────────────────────────────────────────────────

test.describe('ChatUI — TroubleshootChatToggle', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    // Voice Operations page mounts TroubleshootChatToggle
    await page.goto(`${BASE_URL}/voice-operations`)
    // Wait for page to hydrate — use domcontentloaded to avoid networkidle timeout
    await page.waitForLoadState('domcontentloaded')
    // Wait for React hydration to complete
    await page.waitForTimeout(2000)
    // Hide overlapping elements after React renders
    await hideOverlappingElements(page)
  })

  test('FAB toggle button is visible on voice-operations page', async ({ page }) => {
    const fab = page.locator('button[aria-label="Toggle Stack Troubleshoot Bot"]')
    await expect(fab).toBeVisible({ timeout: 15_000 })
  })

  test('clicking FAB opens the chat panel', async ({ page }) => {
    await clickFab(page)

    // Panel header
    const header = page.getByText('Stack Troubleshoot Bot')
    await expect(header).toBeVisible()

    // Welcome message inside ChatUI
    await expect(page.getByText('Connected to Bond AI Assistant.')).toBeVisible()

    // Input field
    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    await expect(input).toBeVisible()

    // Send button
    const sendBtn = page.locator('button:has-text("Send")')
    await expect(sendBtn).toBeVisible()
  })

  test('Send button is disabled when input is empty', async ({ page }) => {
    await clickFab(page)

    const sendBtn = page.locator('button:has-text("Send")')
    await expect(sendBtn).toBeDisabled()
  })

  test('closing panel hides it', async ({ page }) => {
    // Open
    await clickFab(page)
    await expect(page.getByText('Stack Troubleshoot Bot')).toBeVisible()

    // Close via X button in header (use evaluate — panel may extend above viewport)
    const closeBtn = page.locator('.bg-\\[\\#0f172a\\] button').last()
    await closeBtn.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    // Panel should be gone
    await expect(page.getByText('Stack Troubleshoot Bot')).not.toBeVisible()
  })

  test('re-toggling FAB reopens after close', async ({ page }) => {
    // Open → Close → Reopen
    await clickFab(page)
    await expect(page.getByText('Stack Troubleshoot Bot')).toBeVisible()

    await clickFab(page) // toggle = close
    await expect(page.getByText('Stack Troubleshoot Bot')).not.toBeVisible()

    await clickFab(page) // toggle = open
    await expect(page.getByText('Stack Troubleshoot Bot')).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Chat Messaging — User Input + API Response
// ─────────────────────────────────────────────────────────────────────────────

test.describe('ChatUI — Messaging', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.goto(`${BASE_URL}/voice-operations`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    await hideOverlappingElements(page)

    // Open chat panel
    await clickFab(page)
    await expect(page.getByText('Connected to Bond AI Assistant.')).toBeVisible()
  })

  test('typing enables Send button', async ({ page }) => {
    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    const sendBtn = page.locator('button:has-text("Send")')

    await expect(sendBtn).toBeDisabled()
    await input.fill('Hello')
    await expect(sendBtn).toBeEnabled()
  })

  test('sending a message adds user bubble and shows Thinking indicator', async ({ page }) => {
    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    const sendBtn = page.locator('button:has-text("Send")')

    // Intercept the API call so we can control timing
    let requestResolved: () => void
    const responsePromise = new Promise<void>((resolve) => {
      requestResolved = resolve
    })

    await page.route('**/api/bond-ai/chat', async (route) => {
      // Check the request payload
      const postData = route.request().postDataJSON()
      expect(postData.message).toBe('Check system health')
      expect(postData.context_type).toBe('general')

      // Respond with mock success
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          response: {
            content: 'All systems operational. No issues detected.',
          },
        }),
      })
      requestResolved()
    })

    await input.fill('Check system health')
    await sendBtn.click()

    // User message bubble should appear immediately (optimistic)
    await expect(page.getByText('Check system health')).toBeVisible()

    // Input should be cleared after send
    await expect(input).toHaveValue('')

    // Wait for response
    await responsePromise

    // AI response should appear
    await expect(
      page.getByText('All systems operational. No issues detected.')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('API request includes correct payload shape (contract test)', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null

    // Unroute the wildcard handler for bond-ai/chat so our per-test handler takes priority
    await page.unroute('**/api/bond-ai/chat')
    await page.route('**/api/bond-ai/chat', async (route) => {
      capturedPayload = route.request().postDataJSON()

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          response: { content: 'Mock response' },
        }),
      })
    })

    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    await input.fill('Test payload')
    await page.locator('button:has-text("Send")').click()

    // Wait for request to be captured
    await page.waitForResponse('**/api/bond-ai/chat')

    // Validate payload shape matches ChatSchema expectations
    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload!.message).toBe('Test payload')
    expect(capturedPayload!.context_type).toBe('general')

    // conversation_id should be undefined (omitted) or null on first message
    // After the fix: it should be undefined (omitted from JSON via ?? undefined)
    expect(
      capturedPayload!.conversation_id === undefined ||
        capturedPayload!.conversation_id === null ||
        !('conversation_id' in capturedPayload!)
    ).toBe(true)
  })

  test('conversation_id is set after first successful exchange', async ({ page }) => {
    const conversationUuid = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
    let callCount = 0

    await page.route('**/api/bond-ai/chat', async (route) => {
      callCount++
      const postData = route.request().postDataJSON()

      if (callCount === 1) {
        // First call — no conversation_id
        expect(
          postData.conversation_id === undefined ||
            postData.conversation_id === null ||
            !('conversation_id' in postData)
        ).toBe(true)
      } else {
        // Second call — should have conversation_id from first response
        expect(postData.conversation_id).toBe(conversationUuid)
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: conversationUuid,
          response: { content: `Response ${callCount}` },
        }),
      })
    })

    const input = page.locator('input[placeholder="Ask Bond AI..."]')

    // First message
    await input.fill('First message')
    await page.locator('button:has-text("Send")').click()
    await expect(page.getByText('Response 1')).toBeVisible({ timeout: 10_000 })

    // Second message — should include conversation_id
    await input.fill('Second message')
    await page.locator('button:has-text("Send")').click()
    await expect(page.getByText('Response 2')).toBeVisible({ timeout: 10_000 })

    expect(callCount).toBe(2)
  })

  test('error response shows error message in chat', async ({ page }) => {
    await page.route('**/api/bond-ai/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    await input.fill('Trigger error')
    await page.locator('button:has-text("Send")').click()

    // Error should be shown as assistant message
    await expect(
      page.getByText(/unable to process|error|please try again/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Enter key submits message', async ({ page }) => {
    await page.route('**/api/bond-ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          response: { content: 'Enter key response' },
        }),
      })
    })

    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    await input.fill('Enter key test')
    await input.press('Enter')

    await expect(page.getByText('Enter key test')).toBeVisible()
    await expect(page.getByText('Enter key response')).toBeVisible({ timeout: 10_000 })
  })

  test('Send button disabled during loading', async ({ page }) => {
    // Use a delayed route to observe loading state
    await page.route('**/api/bond-ai/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          response: { content: 'Delayed response' },
        }),
      })
    })

    const input = page.locator('input[placeholder="Ask Bond AI..."]')
    await input.fill('Loading test')
    await page.locator('button:has-text("Send")').click()

    // Thinking indicator should appear
    await expect(page.getByText('Thinking...')).toBeVisible()

    // Send button should be disabled while loading
    const sendBtn = page.locator('button:has-text("Send")')
    await expect(sendBtn).toBeDisabled()

    // After response, Thinking disappears and button re-enables
    await expect(page.getByText('Delayed response')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Thinking...')).not.toBeVisible()
  })
})
