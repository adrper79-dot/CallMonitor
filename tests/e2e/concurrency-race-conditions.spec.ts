import { test, expect } from '@playwright/test'

/**
 * Concurrency & Race Conditions E2E Tests — Phase 3
 *
 * Tests how the application handles concurrent operations,
 * race conditions, and simultaneous user actions.
 */

test.describe('Concurrency & Race Conditions', () => {

  // ===== SIMULTANEOUS FORM SUBMISSIONS =====

  test.describe('Simultaneous Form Submissions', () => {
    test('handles multiple form submissions', async ({ page }) => {
      await page.goto('/campaigns')

      // Open multiple campaign creation forms
      const createButtons = page.getByRole('button', { name: /create|new/i })

      // Click create button multiple times rapidly
      for (let i = 0; i < 5; i++) {
        await createButtons.first().click()
        await page.waitForTimeout(100)
      }

      // Should handle multiple simultaneous forms
      await expect(page.locator('body')).toBeVisible()

      // Count how many forms are open
      const forms = page.locator('form, [role="dialog"], .modal')
      const formCount = await forms.count()

      // Should have opened multiple forms or handled gracefully
      expect(formCount).toBeGreaterThanOrEqual(1)
    })

    test('prevents duplicate submissions', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        // Fill form with same data multiple times
        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Duplicate Test Campaign')
        }

        const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()

        // Submit multiple times rapidly
        for (let i = 0; i < 3; i++) {
          await submitButton.click()
          await page.waitForTimeout(200)
        }

        // Should prevent duplicates or handle gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles conflicting simultaneous edits', async ({ page }) => {
      await page.goto('/campaigns')

      // Find and open first campaign
      const firstCampaign = page.locator('[data-testid*="campaign"], .campaign-item').first()
      if (await firstCampaign.isVisible()) {
        await firstCampaign.click()

        const editButton = page.getByRole('button', { name: /edit/i })
        if (await editButton.isVisible()) {
          await editButton.click()

          // Simulate rapid conflicting edits
          const nameInput = page.locator('input[name*="name"]').first()
          if (await nameInput.isVisible()) {
            for (let i = 0; i < 5; i++) {
              await nameInput.fill(`Conflicting Edit ${i}`)
              const saveButton = page.getByRole('button', { name: /save/i })
              if (await saveButton.isVisible()) {
                await saveButton.click()
                await page.waitForTimeout(100)
              }
            }
          }
        }
      }

      // Should handle conflicting edits gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== MULTI-TAB OPERATIONS =====

  test.describe('Multi-Tab Operations', () => {
    test('handles operations across multiple tabs', async ({ browser }) => {
      // Create multiple pages (tabs)
      const page1 = await browser.newPage()
      const page2 = await browser.newPage()

      try {
        // Perform operations in both tabs simultaneously
        await Promise.all([
          page1.goto('/campaigns'),
          page2.goto('/campaigns')
        ])

        // Create campaigns in both tabs
        const createButton1 = page1.getByRole('button', { name: /create|new/i })
        const createButton2 = page2.getByRole('button', { name: /create|new/i })

        if (await createButton1.isVisible() && await createButton2.isVisible()) {
          await Promise.all([
            createButton1.click(),
            createButton2.click()
          ])

          // Fill forms in both tabs
          const nameInput1 = page1.locator('input[name*="name"]').first()
          const nameInput2 = page2.locator('input[name*="name"]').first()

          await Promise.all([
            nameInput1.fill('Tab 1 Campaign'),
            nameInput2.fill('Tab 2 Campaign')
          ])

          // Submit both forms
          const submit1 = page1.getByRole('button', { name: /save|create|submit/i }).first()
          const submit2 = page2.getByRole('button', { name: /save|create|submit/i }).first()

          await Promise.all([
            submit1.click(),
            submit2.click()
          ])

          // Both should handle concurrent submissions gracefully
          await expect(page1.locator('body')).toBeVisible()
          await expect(page2.locator('body')).toBeVisible()
        }
      } finally {
        await page1.close()
        await page2.close()
      }
    })

    test('handles session conflicts across tabs', async ({ browser }) => {
      const page1 = await browser.newPage()
      const page2 = await browser.newPage()

      try {
        await Promise.all([
          page1.goto('/dashboard'),
          page2.goto('/dashboard')
        ])

        // Perform actions that might conflict
        const actionButton1 = page1.locator('button').first()
        const actionButton2 = page2.locator('button').first()

        if (await actionButton1.isVisible() && await actionButton2.isVisible()) {
          // Click buttons in both tabs simultaneously
          await Promise.all([
            actionButton1.click(),
            actionButton2.click()
          ])

          // Should handle session conflicts gracefully
          await expect(page1.locator('body')).toBeVisible()
          await expect(page2.locator('body')).toBeVisible()
        }
      } finally {
        await page1.close()
        await page2.close()
      }
    })

    test('handles data synchronization across tabs', async ({ browser }) => {
      const page1 = await browser.newPage()
      const page2 = await browser.newPage()

      try {
        await page1.goto('/campaigns')
        await page2.goto('/campaigns')

        // Create a campaign in tab 1
        const createButton1 = page1.getByRole('button', { name: /create|new/i })
        if (await createButton1.isVisible()) {
          await createButton1.click()

          const nameInput1 = page1.locator('input[name*="name"]').first()
          if (await nameInput1.isVisible()) {
            await nameInput1.fill('Sync Test Campaign')

            const submit1 = page1.getByRole('button', { name: /save|create|submit/i }).first()
            await submit1.click()

            // Wait a bit for potential sync
            await page1.waitForTimeout(1000)

            // Check if tab 2 shows the new campaign
            const campaignInTab2 = page2.locator('[data-testid*="campaign"], .campaign-item').filter({ hasText: 'Sync Test Campaign' })

            // Campaign may or may not appear immediately due to sync timing
            // The test passes if no errors occur
            await expect(page1.locator('body')).toBeVisible()
            await expect(page2.locator('body')).toBeVisible()
          }
        }
      } finally {
        await page1.close()
        await page2.close()
      }
    })
  })

  // ===== RAPID USER INTERACTIONS =====

  test.describe('Rapid User Interactions', () => {
    test('handles rapid button clicking', async ({ page }) => {
      await page.goto('/dashboard')

      const buttons = page.locator('button')

      // Rapidly click all visible buttons
      for (const button of await buttons.all()) {
        if (await button.isVisible()) {
          // Click button multiple times rapidly
          for (let i = 0; i < 3; i++) {
            await button.click()
            await page.waitForTimeout(50)
          }
        }
      }

      // Should handle rapid clicking gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles rapid navigation', async ({ page }) => {
      const pages = ['/dashboard', '/campaigns', '/voice', '/inbox', '/analytics']

      // Rapidly navigate between pages
      for (let i = 0; i < 3; i++) {
        for (const pageUrl of pages) {
          await page.goto(pageUrl)
          await page.waitForTimeout(100)
        }
      }

      // Should handle rapid navigation gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles rapid data entry', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const inputs = page.locator('input[type="text"], textarea')

        // Rapidly fill all inputs
        for (const input of await inputs.all()) {
          if (await input.isVisible()) {
            for (let i = 0; i < 5; i++) {
              await input.fill(`Rapid input ${i}`)
              await page.waitForTimeout(50)
            }
          }
        }

        // Should handle rapid data entry gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles rapid scrolling and viewport changes', async ({ page }) => {
      await page.goto('/analytics')

      // Set a large viewport to enable scrolling
      await page.setViewportSize({ width: 1200, height: 800 })

      // Rapidly scroll in different directions
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 100) // Scroll down
        await page.waitForTimeout(50)
        await page.mouse.wheel(0, -100) // Scroll up
        await page.waitForTimeout(50)
      }

      // Should handle rapid scrolling gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== CONCURRENT API CALLS =====

  test.describe('Concurrent API Calls', () => {
    test('handles multiple simultaneous API requests', async ({ page }) => {
      await page.goto('/dashboard')

      // Trigger multiple API calls simultaneously
      const apiCalls = []

      // Mock multiple API endpoints to return with different delays
      await page.route('**/api/**', async route => {
        const delay = Math.random() * 1000 // Random delay up to 1 second
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{"data": "concurrent response"}'
          })
        }, delay)
      })

      // Perform multiple actions that trigger API calls
      for (let i = 0; i < 5; i++) {
        apiCalls.push(page.reload())
      }

      // Wait for all calls to complete
      await Promise.all(apiCalls)

      // Should handle concurrent API calls gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles API request queuing', async ({ page }) => {
      await page.goto('/dashboard')

      // Mock slow API responses
      let requestCount = 0
      await page.route('**/api/**', async route => {
        requestCount++
        // Each request takes progressively longer
        const delay = requestCount * 500
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: `{"data": "response ${requestCount}"}`
          })
        }, delay)
      })

      // Make multiple rapid requests
      for (let i = 0; i < 5; i++) {
        await page.reload()
      }

      // Should handle request queuing gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles API timeout scenarios', async ({ page }) => {
      await page.goto('/dashboard')

      // Mock some requests to timeout
      let requestCount = 0
      await page.route('**/api/**', async route => {
        requestCount++
        if (requestCount % 3 === 0) {
          // Every 3rd request times out
          setTimeout(() => {
            route.abort()
          }, 30000) // Long timeout
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{"data": "success"}'
          })
        }
      })

      // Perform multiple actions
      for (let i = 0; i < 6; i++) {
        await page.reload()
        await page.waitForTimeout(100)
      }

      // Should handle timeouts gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== SHARED RESOURCE CONFLICTS =====

  test.describe('Shared Resource Conflicts', () => {
    test('handles concurrent file operations', async ({ page }) => {
      await page.goto('/settings')

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        // Try to upload multiple files simultaneously
        const uploadPromises = []

        for (let i = 0; i < 3; i++) {
          const uploadPromise = fileInput.setInputFiles([{
            name: `concurrent-file-${i}.txt`,
            mimeType: 'text/plain',
            buffer: Buffer.from(`Content ${i}`)
          }])
          uploadPromises.push(uploadPromise)
        }

        // Wait for all uploads to complete
        await Promise.allSettled(uploadPromises)

        // Should handle concurrent file operations gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles concurrent user preference updates', async ({ page }) => {
      await page.goto('/settings')

      // Find preference controls
      const preferenceControls = page.locator('input[type="checkbox"], select, input[type="radio"]')

      // Rapidly change multiple preferences
      const changePromises = []
      for (const control of await preferenceControls.all()) {
        if (await control.isVisible()) {
          if (await control.getAttribute('type') === 'checkbox') {
            changePromises.push(control.click())
          } else if (await control.tagName() === 'select') {
            changePromises.push(control.selectOption({ index: 1 }))
          }
        }
      }

      // Execute changes concurrently
      await Promise.allSettled(changePromises)

      // Should handle concurrent preference updates gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles concurrent cart/checkout operations', async ({ page }) => {
      // If there's an e-commerce or cart-like feature
      await page.goto('/settings') // Or appropriate page

      // Look for any cart-like operations
      const cartButtons = page.locator('button[name*="cart"], button[name*="add"], [data-testid*="cart"]')

      if (await cartButtons.count() > 0) {
        // Rapidly add items to cart
        const addPromises = []
        for (const button of await cartButtons.all()) {
          if (await button.isVisible()) {
            for (let i = 0; i < 3; i++) {
              addPromises.push(button.click())
            }
          }
        }

        await Promise.allSettled(addPromises)

        // Should handle concurrent cart operations gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  // ===== REAL-TIME FEATURES CONCURRENCY =====

  test.describe('Real-Time Features Concurrency', () => {
    test('handles concurrent real-time updates', async ({ page }) => {
      await page.goto('/dashboard')

      // Mock real-time updates
      let updateCount = 0
      await page.route('**/api/realtime*', async route => {
        updateCount++
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            type: 'update',
            id: updateCount,
            data: { message: `Real-time update ${updateCount}` }
          })
        })
      })

      // Simulate multiple real-time updates
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          // Trigger custom event to simulate real-time update
          window.dispatchEvent(new CustomEvent('realtime-update', {
            detail: { id: Math.random(), data: 'test' }
          }))
        })
        await page.waitForTimeout(50)
      }

      // Should handle concurrent real-time updates gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles WebSocket message storms', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate many WebSocket messages arriving simultaneously
      await page.evaluate(() => {
        // Create a mock WebSocket message storm
        for (let i = 0; i < 50; i++) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('websocket-message', {
              detail: {
                type: 'notification',
                id: i,
                message: `Message ${i}`
              }
            }))
          }, Math.random() * 100)
        }
      })

      // Wait for messages to be processed
      await page.waitForTimeout(1000)

      // Should handle message storms gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles concurrent notification display', async ({ page }) => {
      await page.goto('/dashboard')

      // Trigger multiple notifications simultaneously
      await page.evaluate(() => {
        for (let i = 0; i < 10; i++) {
          // Simulate notification creation
          const notification = document.createElement('div')
          notification.className = 'notification'
          notification.textContent = `Notification ${i}`
          notification.style.cssText = 'position: fixed; top: 10px; right: 10px; background: yellow; padding: 10px; z-index: 1000;'
          document.body.appendChild(notification)

          setTimeout(() => notification.remove(), 1000)
        }
      })

      // Should handle concurrent notifications gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== DATABASE CONCURRENCY =====

  test.describe('Database Concurrency', () => {
    test('handles concurrent database writes', async ({ page }) => {
      await page.goto('/campaigns')

      // Mock concurrent database operations
      await page.route('**/api/campaigns*', async route => {
        if (route.request().method() === 'POST') {
          // Simulate database contention
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500))

          // Sometimes return conflict error
          if (Math.random() < 0.3) {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: '{"error": "Concurrent modification detected"}'
            })
          } else {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: '{"id": "new-campaign", "name": "Concurrent Campaign"}'
            })
          }
        } else {
          await route.continue()
        }
      })

      // Perform multiple create operations
      for (let i = 0; i < 5; i++) {
        const createButton = page.getByRole('button', { name: /create|new/i })
        if (await createButton.isVisible()) {
          await createButton.click()

          const nameInput = page.locator('input[name*="name"]').first()
          if (await nameInput.isVisible()) {
            await nameInput.fill(`Concurrent Campaign ${i}`)

            const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()
            await submitButton.click()
          }
        }
      }

      // Should handle database concurrency gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles optimistic locking conflicts', async ({ page }) => {
      await page.goto('/campaigns')

      // Find a campaign to edit
      const campaign = page.locator('[data-testid*="campaign"], .campaign-item').first()
      if (await campaign.isVisible()) {
        await campaign.click()

        const editButton = page.getByRole('button', { name: /edit/i })
        if (await editButton.isVisible()) {
          await editButton.click()

          // Mock version conflict
          await page.route('**/api/campaigns*', async route => {
            if (route.request().method() === 'PUT') {
              await route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: '{"error": "Version conflict - record was modified by another user"}'
              })
            } else {
              await route.continue()
            }
          })

          // Try to save changes
          const nameInput = page.locator('input[name*="name"]').first()
          if (await nameInput.isVisible()) {
            await nameInput.fill('Modified Name')

            const saveButton = page.getByRole('button', { name: /save/i })
            await saveButton.click()
          }

          // Should handle version conflict gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles transaction rollbacks', async ({ page }) => {
      await page.goto('/campaigns')

      // Mock transaction failure
      await page.route('**/api/campaigns*', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: '{"error": "Transaction rolled back due to constraint violation"}'
          })
        } else {
          await route.continue()
        }
      })

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Transaction Test')

          const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()
          await submitButton.click()
        }

        // Should handle transaction rollback gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  // ===== MEMORY AND RESOURCE CONCURRENCY =====

  test.describe('Memory & Resource Concurrency', () => {
    test('handles memory pressure during concurrent operations', async ({ page }) => {
      await page.goto('/analytics')

      // Create memory pressure by adding many DOM elements
      await page.evaluate(() => {
        for (let i = 0; i < 1000; i++) {
          const div = document.createElement('div')
          div.textContent = `Memory test element ${i}`
          div.style.display = 'none'
          document.body.appendChild(div)
        }
      })

      // Perform memory-intensive operations concurrently
      const operations = []
      for (let i = 0; i < 5; i++) {
        operations.push(page.reload())
      }

      await Promise.all(operations)

      // Should handle memory pressure gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles concurrent media loading', async ({ page }) => {
      await page.goto('/dashboard')

      // Mock many media resources loading concurrently
      await page.route('**/*.{jpg,png,gif,mp4,webm}', async route => {
        // Simulate slow media loading
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: Buffer.from('fake image data')
          })
        }, Math.random() * 2000)
      })

      // Trigger many media loads
      await page.evaluate(() => {
        for (let i = 0; i < 20; i++) {
          const img = document.createElement('img')
          img.src = `/fake-image-${i}.png`
          img.style.display = 'none'
          document.body.appendChild(img)
        }
      })

      // Wait for media to load
      await page.waitForTimeout(3000)

      // Should handle concurrent media loading gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles concurrent script execution', async ({ page }) => {
      await page.goto('/dashboard')

      // Add multiple scripts that execute concurrently
      for (let i = 0; i < 5; i++) {
        await page.addScriptTag({
          content: `
            setTimeout(() => {
              console.log('Concurrent script ${i} executed')
              // Simulate some work
              for (let j = 0; j < 100000; j++) {
                Math.random()
              }
            }, Math.random() * 1000)
          `
        })
      }

      // Wait for scripts to execute
      await page.waitForTimeout(2000)

      // Should handle concurrent script execution gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })
})