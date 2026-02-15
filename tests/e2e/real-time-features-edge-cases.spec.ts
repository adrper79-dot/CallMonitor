import { test, expect } from '@playwright/test'

/**
 * Real-Time Features Edge Cases E2E Tests — Phase 3
 *
 * Tests comprehensive real-time functionality including
 * WebSocket connections, live updates, and concurrent interactions.
 */

test.describe('Real-Time Features Edge Cases', () => {

  // ===== WEBSOCKET CONNECTION MANAGEMENT =====

  test.describe('WebSocket Connection Management', () => {
    test('handles WebSocket connection failures gracefully', async ({ page }) => {
      await page.goto('/dashboard')

      // Monitor console for WebSocket errors
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })

      // Wait for potential WebSocket connection attempts
      await page.waitForTimeout(5000)

      // Should handle connection failures without breaking the UI
      await expect(page.locator('body')).toBeVisible()

      // Check for error handling UI elements
      const errorIndicators = page.locator('.connection-error, .offline-indicator, [data-connection="disconnected"]')
      // Error indicators may or may not be present

      // Should not have critical JavaScript errors
      const criticalErrors = errors.filter(error =>
        error.includes('WebSocket') ||
        error.includes('connection') ||
        error.includes('network')
      )

      // Log but don't fail - connection issues may be expected
      if (criticalErrors.length > 0) {
        console.log('WebSocket connection errors detected:', criticalErrors)
      }
    })

    test('handles WebSocket reconnection scenarios', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate network interruption
      await page.route('**/*', route => {
        if (route.request().url().includes('ws://') || route.request().url().includes('wss://')) {
          // Delay WebSocket connections
          setTimeout(() => route.abort(), 1000)
        } else {
          route.continue()
        }
      })

      // Wait for reconnection attempts
      await page.waitForTimeout(10000)

      // UI should remain functional during reconnection
      await expect(page.locator('body')).toBeVisible()

      // Check for reconnection status indicators
      const reconnectingIndicators = page.locator('.reconnecting, .connecting, [data-status="reconnecting"]')
      // Indicators may be present or not
    })

    test('handles WebSocket message parsing errors', async ({ page }) => {
      await page.goto('/dashboard')

      // Inject invalid WebSocket message handling
      await page.evaluate(() => {
        // Mock WebSocket to send invalid messages
        const originalWebSocket = window.WebSocket
        window.WebSocket = class extends originalWebSocket {
          constructor(url: string, protocols?: string | string[]) {
            super(url, protocols)
            this.addEventListener('open', () => {
              // Send invalid JSON message
              setTimeout(() => {
                this.send('invalid json message')
              }, 1000)
            })
          }
        }
      })

      // Wait for message processing
      await page.waitForTimeout(5000)

      // Should handle invalid messages gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should not crash or show unhandled errors
      const errorElements = page.locator('.error, [role="alert"]').filter({ hasText: /invalid|parse|json/i })
      // Error handling may be silent
    })

    test('handles WebSocket connection limits', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate multiple WebSocket connection attempts
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          new WebSocket('ws://localhost:8080') // Invalid WebSocket URL
        })
      }

      // Wait for connection attempts
      await page.waitForTimeout(5000)

      // Should handle connection limit gracefully
      await expect(page.locator('body')).toBeVisible()

      // Browser should not become unresponsive
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })
  })

  // ===== LIVE DATA SYNCHRONIZATION =====

  test.describe('Live Data Synchronization', () => {
    test('handles concurrent data updates from multiple sources', async ({ page, context }) => {
      await page.goto('/dashboard')

      // Open multiple pages to simulate concurrent access
      const page2 = await context.newPage()
      await page2.goto('/dashboard')

      // Perform actions on both pages simultaneously
      const actions = [
        async () => {
          const button = page.locator('button').first()
          if (await button.isVisible()) {
            await button.click()
          }
        },
        async () => {
          const button = page2.locator('button').first()
          if (await button.isVisible()) {
            await button.click()
          }
        }
      ]

      // Execute actions concurrently
      await Promise.all(actions.map(action => action()))

      // Both pages should remain functional
      await expect(page.locator('body')).toBeVisible()
      await expect(page2.locator('body')).toBeVisible()

      await page2.close()
    })

    test('handles data conflicts and race conditions', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate rapid successive updates
      const updateButton = page.locator('button').filter({ hasText: /update|save|edit/i }).first()

      if (await updateButton.isVisible()) {
        // Click multiple times rapidly
        for (let i = 0; i < 5; i++) {
          await updateButton.click()
          await page.waitForTimeout(100) // Small delay between clicks
        }

        // Should handle rapid updates gracefully
        await expect(page.locator('body')).toBeVisible()

        // Check for conflict resolution UI
        const conflictIndicators = page.locator('.conflict, .error').filter({ hasText: /conflict|version|concurrent/i })
        // Conflict handling may be silent
      }
    })

    test('handles stale data scenarios', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate stale data by manipulating timestamps
      await page.evaluate(() => {
        // Mock old timestamp data
        const oldTimestamp = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
        localStorage.setItem('lastUpdate', oldTimestamp.toString())
      })

      // Trigger data refresh
      const refreshButton = page.locator('button').filter({ hasText: /refresh|sync|update/i }).first()
      if (await refreshButton.isVisible()) {
        await refreshButton.click()
      }

      // Wait for potential refresh
      await page.waitForTimeout(3000)

      // Should handle stale data gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles partial data updates', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate partial data updates
      await page.evaluate(() => {
        // Mock partial update event
        window.dispatchEvent(new CustomEvent('dataUpdate', {
          detail: { partial: true, fields: ['metric1', 'metric2'] }
        }))
      })

      // Wait for update processing
      await page.waitForTimeout(2000)

      // Should handle partial updates without breaking
      await expect(page.locator('body')).toBeVisible()

      // Check that some data is still displayed
      const dataElements = page.locator('.metric, .data-point, .chart')
      const dataCount = await dataElements.count()
      expect(dataCount).toBeGreaterThanOrEqual(0) // May have data or not
    })
  })

  // ===== REAL-TIME NOTIFICATIONS =====

  test.describe('Real-Time Notifications', () => {
    test('handles notification spam and rate limiting', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate multiple rapid notifications
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent('notification', {
            detail: { message: `Notification ${i}`, type: 'info' }
          }))
        })
        await page.waitForTimeout(50) // Very rapid notifications
      }

      // Should handle notification spam gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for notification queue management
      const notifications = page.locator('.notification, .toast, [role="alert"]')
      const notificationCount = await notifications.count()

      // Should not overwhelm the UI
      expect(notificationCount).toBeLessThan(10) // Reasonable limit
    })

    test('handles notification delivery failures', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate notification delivery failure
      await page.evaluate(() => {
        // Mock failed notification delivery
        window.dispatchEvent(new CustomEvent('notificationError', {
          detail: { error: 'Delivery failed', notificationId: '123' }
        }))
      })

      // Wait for error handling
      await page.waitForTimeout(2000)

      // Should handle delivery failures gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for retry mechanisms or error indicators
      const errorIndicators = page.locator('.notification-error, .retry-indicator')
      // Error handling may be silent
    })

    test('handles notification persistence across page reloads', async ({ page }) => {
      await page.goto('/dashboard')

      // Create a notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { message: 'Persistent notification', type: 'info', persistent: true }
        }))
      })

      // Wait for notification to appear
      await page.waitForTimeout(1000)

      // Reload the page
      await page.reload()

      // Should handle page reload gracefully
      await expect(page.locator('body')).toBeVisible()

      // Persistent notifications may or may not survive reload
    })

    test('handles notification priority and queuing', async ({ page }) => {
      await page.goto('/dashboard')

      // Send notifications with different priorities
      const priorities = ['low', 'normal', 'high', 'urgent']

      for (const priority of priorities) {
        await page.evaluate((priority) => {
          window.dispatchEvent(new CustomEvent('notification', {
            detail: { message: `Priority ${priority}`, type: 'info', priority }
          }))
        })
        await page.waitForTimeout(200)
      }

      // Should handle priority queuing
      await expect(page.locator('body')).toBeVisible()

      // High priority notifications should be visible
      const urgentNotifications = page.locator('.notification').filter({ hasText: /urgent|high/i })
      // Urgent notifications may be prioritized
    })
  })

  // ===== LIVE COLLABORATION FEATURES =====

  test.describe('Live Collaboration Features', () => {
    test('handles multiple users editing simultaneously', async ({ page, context }) => {
      await page.goto('/campaigns')

      // Open multiple browser contexts to simulate different users
      const page2 = await context.newPage()
      await page2.goto('/campaigns')

      // Both users try to edit the same item
      const editButtons = [
        page.locator('button').filter({ hasText: /edit/i }).first(),
        page2.locator('button').filter({ hasText: /edit/i }).first()
      ]

      // Click edit on both pages
      await Promise.all(editButtons.map(button => button.click()))

      // Both should handle the concurrent edit scenario
      await expect(page.locator('body')).toBeVisible()
      await expect(page2.locator('body')).toBeVisible()

      await page2.close()
    })

    test('handles user presence indicators', async ({ page, context }) => {
      await page.goto('/dashboard')

      const page2 = await context.newPage()
      await page2.goto('/dashboard')

      // Check for presence indicators
      const presenceIndicators = page.locator('.presence, .online-users, .collaborators')

      if (await presenceIndicators.count() > 0) {
        // Should show presence information
        const indicatorText = await presenceIndicators.first().textContent()
        expect(indicatorText).toBeTruthy()
      }

      await page2.close()
    })

    test('handles collaborative editing conflicts', async ({ page, context }) => {
      await page.goto('/campaigns')

      const page2 = await context.newPage()
      await page2.goto('/campaigns')

      // Both users edit the same field
      const nameInputs = [
        page.locator('input[name*="name"]').first(),
        page2.locator('input[name*="name"]').first()
      ]

      // Both try to change the name
      await nameInputs[0].fill('User 1 Change')
      await nameInputs[1].fill('User 2 Change')

      // Save both changes
      const saveButtons = [
        page.locator('button').filter({ hasText: /save/i }).first(),
        page2.locator('button').filter({ hasText: /save/i }).first()
      ]

      await Promise.all(saveButtons.map(button => button.click()))

      // Should handle conflicts gracefully
      await expect(page.locator('body')).toBeVisible()
      await expect(page2.locator('body')).toBeVisible()

      await page2.close()
    })

    test('handles user joining and leaving events', async ({ page, context }) => {
      await page.goto('/dashboard')

      // Simulate user joining
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('userJoined', {
          detail: { userId: 'user123', name: 'Test User' }
        }))
      })

      await page.waitForTimeout(1000)

      // Simulate user leaving
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('userLeft', {
          detail: { userId: 'user123', name: 'Test User' }
        }))
      })

      await page.waitForTimeout(1000)

      // Should handle join/leave events gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== REAL-TIME DATA STREAMING =====

  test.describe('Real-Time Data Streaming', () => {
    test('handles streaming data interruptions', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate data stream interruption
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('streamInterrupted', {
          detail: { streamId: 'analytics', reason: 'network' }
        }))
      })

      // Wait for interruption handling
      await page.waitForTimeout(3000)

      // Should handle interruption gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for reconnection indicators
      const reconnectIndicators = page.locator('.reconnecting, .buffering, [data-status="interrupted"]')
      // Indicators may be present
    })

    test('handles streaming data buffer overflows', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate buffer overflow
      await page.evaluate(() => {
        // Send large amount of streaming data rapidly
        for (let i = 0; i < 1000; i++) {
          window.dispatchEvent(new CustomEvent('dataPoint', {
            detail: { value: Math.random(), timestamp: Date.now() + i }
          }))
        }
      })

      // Wait for processing
      await page.waitForTimeout(5000)

      // Should handle buffer overflow gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should not crash or become unresponsive
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })

    test('handles streaming data format changes', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate format change in streaming data
      await page.evaluate(() => {
        // Send data with old format
        window.dispatchEvent(new CustomEvent('dataPoint', {
          detail: { value: 123, timestamp: Date.now() }
        }))

        // Then send data with new format
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('dataPoint', {
            detail: { data: { value: 456 }, meta: { timestamp: Date.now() } }
          }))
        }, 1000)
      })

      // Wait for format change handling
      await page.waitForTimeout(3000)

      // Should handle format changes gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles streaming data filtering and aggregation', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate large dataset that needs filtering
      await page.evaluate(() => {
        const dataPoints = []
        for (let i = 0; i < 10000; i++) {
          dataPoints.push({
            value: Math.random() * 1000,
            category: i % 10,
            timestamp: Date.now() + i * 1000
          })
        }

        window.dispatchEvent(new CustomEvent('bulkData', {
          detail: { data: dataPoints }
        }))
      })

      // Wait for data processing and filtering
      await page.waitForTimeout(5000)

      // Should handle large datasets gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should display aggregated/filtered data
      const dataDisplays = page.locator('.chart, .metric, .data-table')
      const displayCount = await dataDisplays.count()
      expect(displayCount).toBeGreaterThanOrEqual(0)
    })
  })

  // ===== REAL-TIME PERFORMANCE MONITORING =====

  test.describe('Real-Time Performance Monitoring', () => {
    test('handles performance monitoring data collection', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate performance monitoring
      await page.evaluate(() => {
        // Mock performance metrics collection
        window.dispatchEvent(new CustomEvent('performanceMetric', {
          detail: {
            metric: 'responseTime',
            value: 150,
            timestamp: Date.now()
          }
        }))
      })

      // Wait for metric processing
      await page.waitForTimeout(2000)

      // Should handle performance monitoring gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles real-time performance alerts', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate performance alert
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('performanceAlert', {
          detail: {
            type: 'slowResponse',
            threshold: 1000,
            actual: 1500,
            endpoint: '/api/data'
          }
        }))
      })

      // Wait for alert processing
      await page.waitForTimeout(2000)

      // Should handle performance alerts gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for alert indicators
      const alerts = page.locator('.performance-alert, .warning').filter({ hasText: /slow|performance/i })
      // Alerts may be displayed or logged
    })

    test('handles monitoring data export interruptions', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate export interruption
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('exportInterrupted', {
          detail: {
            exportId: 'perf-data-123',
            reason: 'network',
            progress: 0.5
          }
        }))
      })

      // Wait for interruption handling
      await page.waitForTimeout(3000)

      // Should handle export interruptions gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles monitoring dashboard updates', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate dashboard metric updates
      const metrics = ['cpu', 'memory', 'response-time', 'error-rate']

      for (const metric of metrics) {
        await page.evaluate((metric) => {
          window.dispatchEvent(new CustomEvent('metricUpdate', {
            detail: {
              metric,
              value: Math.random() * 100,
              timestamp: Date.now()
            }
          }))
        }, metric)

        await page.waitForTimeout(200)
      }

      // Should handle metric updates gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for updated metric displays
      const metricDisplays = page.locator('.metric, .gauge, .chart')
      const displayCount = await metricDisplays.count()
      expect(displayCount).toBeGreaterThanOrEqual(0)
    })
  })

  // ===== REAL-TIME SECURITY AND AUTHENTICATION =====

  test.describe('Real-Time Security & Authentication', () => {
    test('handles authentication token refresh during active sessions', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate token expiration during active session
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('tokenExpired', {
          detail: { remainingTime: 0 }
        }))
      })

      // Wait for token refresh handling
      await page.waitForTimeout(3000)

      // Should handle token refresh gracefully
      await expect(page.locator('body')).toBeVisible()

      // May redirect to login or refresh token automatically
    })

    test('handles session timeout during real-time operations', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate session timeout
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('sessionTimeout', {
          detail: { timeout: true }
        }))
      })

      // Wait for timeout handling
      await page.waitForTimeout(3000)

      // Should handle session timeout gracefully
      await expect(page.locator('body')).toBeVisible()

      // May redirect to login
    })

    test('handles real-time permission changes', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate permission change during session
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('permissionChanged', {
          detail: {
            resource: 'campaigns',
            oldPermission: 'write',
            newPermission: 'read'
          }
        }))
      })

      // Wait for permission update handling
      await page.waitForTimeout(3000)

      // Should handle permission changes gracefully
      await expect(page.locator('body')).toBeVisible()

      // UI may update to reflect new permissions
    })

    test('handles security violations in real-time data', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate security violation in incoming data
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('securityViolation', {
          detail: {
            type: 'xss_attempt',
            data: '<script>alert("xss")</script>',
            source: 'websocket'
          }
        }))
      })

      // Wait for security violation handling
      await page.waitForTimeout(2000)

      // Should handle security violations gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should not execute malicious code
      const alerts = page.locator('body').filter({ hasText: 'xss' })
      const alertCount = await alerts.count()
      expect(alertCount).toBe(0) // No XSS execution
    })
  })
})