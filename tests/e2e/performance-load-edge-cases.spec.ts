import { test, expect } from '@playwright/test'

/**
 * Performance & Load Edge Cases E2E Tests — Phase 3
 *
 * Tests comprehensive performance scenarios including
 * high load, memory pressure, and resource constraints.
 */

test.describe('Performance & Load Edge Cases', () => {

  // ===== HIGH LOAD SCENARIOS =====

  test.describe('High Load Scenarios', () => {
    test('handles large dataset rendering', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate large dataset
      await page.evaluate(() => {
        const largeDataset = []
        for (let i = 0; i < 10000; i++) {
          largeDataset.push({
            id: i,
            name: `Item ${i}`,
            value: Math.random() * 1000,
            category: `Category ${i % 10}`,
            timestamp: new Date(Date.now() - i * 1000).toISOString()
          })
        }

        // Inject large dataset into the page
        window.largeDataset = largeDataset
        window.dispatchEvent(new CustomEvent('largeDataLoaded', { detail: largeDataset }))
      })

      // Wait for rendering
      await page.waitForTimeout(5000)

      // Should handle large dataset without crashing
      await expect(page.locator('body')).toBeVisible()

      // Check memory usage (if available)
      const memoryInfo = await page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })

      if (memoryInfo) {
        console.log('Memory usage:', memoryInfo)
        // Should not be at memory limit
        expect(memoryInfo.used).toBeLessThan(memoryInfo.limit * 0.9)
      }
    })

    test('handles rapid user interactions', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate rapid clicking
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()

      if (buttonCount > 0) {
        // Click buttons rapidly
        for (let i = 0; i < 50; i++) {
          const randomButton = buttons.nth(Math.floor(Math.random() * buttonCount))
          if (await randomButton.isVisible()) {
            await randomButton.click()
            await page.waitForTimeout(10) // Very short delay
          }
        }

        // Should handle rapid interactions without breaking
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles multiple concurrent API calls', async ({ page }) => {
      await page.goto('/dashboard')

      // Intercept and delay API calls to simulate load
      await page.route('**/api/**', async route => {
        await page.waitForTimeout(100) // Add delay to each API call
        await route.continue()
      })

      // Trigger multiple API calls simultaneously
      const apiCalls = []
      for (let i = 0; i < 10; i++) {
        apiCalls.push(page.evaluate(() => {
          return fetch('/api/test-endpoint').catch(() => null)
        }))
      }

      // Wait for all calls to complete
      await Promise.allSettled(apiCalls)

      // Should handle concurrent API calls gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles memory-intensive operations', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate memory-intensive operation
      await page.evaluate(() => {
        const largeArrays = []
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Array(100000).fill(Math.random()))
        }

        // Process the data
        const results = largeArrays.map(arr => arr.reduce((sum, val) => sum + val, 0))

        window.memoryTestResults = results
      })

      // Wait for processing
      await page.waitForTimeout(3000)

      // Should handle memory-intensive operations
      await expect(page.locator('body')).toBeVisible()

      // Check if operation completed
      const results = await page.evaluate(() => window.memoryTestResults)
      expect(results).toBeDefined()
      expect(results.length).toBe(100)
    })
  })

  // ===== RESOURCE CONSTRAINTS =====

  test.describe('Resource Constraints', () => {
    test('handles low memory conditions', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate low memory by filling memory
      await page.evaluate(() => {
        const memoryHog = []
        try {
          // Try to allocate large amounts of memory
          for (let i = 0; i < 1000; i++) {
            memoryHog.push(new Array(10000).fill('memory'))
          }
        } catch (error) {
          window.memoryError = error.message
        }
      })

      // Continue with normal operations
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
      }

      // Should handle low memory gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles slow network conditions', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*', async route => {
        // Add significant delay to all requests
        await page.waitForTimeout(1000)
        await route.continue()
      })

      await page.goto('/dashboard', { waitUntil: 'networkidle' })

      // Should load eventually despite slow network
      await expect(page.locator('body')).toBeVisible()

      // Test interaction under slow network
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        const startTime = Date.now()
        await button.click()
        const endTime = Date.now()

        // Should respond within reasonable time even on slow network
        expect(endTime - startTime).toBeLessThan(10000) // 10 seconds max
      }
    })

    test('handles CPU-intensive operations', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate CPU-intensive calculation
      const startTime = Date.now()

      await page.evaluate(() => {
        // Perform CPU-intensive calculation
        function fibonacci(n) {
          if (n <= 1) return n
          return fibonacci(n - 1) + fibonacci(n - 2)
        }

        // Calculate multiple fibonacci numbers
        const results = []
        for (let i = 0; i < 35; i++) { // fib(35) is CPU intensive
          results.push(fibonacci(i))
        }

        window.cpuResults = results
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000) // 30 seconds max

      // Should not freeze the UI
      await expect(page.locator('body')).toBeVisible()

      // Results should be calculated
      const results = await page.evaluate(() => window.cpuResults)
      expect(results).toBeDefined()
      expect(results.length).toBe(35)
    })

    test('handles limited storage space', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate limited storage by filling localStorage
      await page.evaluate(() => {
        try {
          for (let i = 0; i < 1000; i++) {
            localStorage.setItem(`test-key-${i}`, 'x'.repeat(1000)) // 1KB per item
          }
        } catch (error) {
          window.storageError = error.message
        }
      })

      // Continue with normal operations
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
      }

      // Should handle storage limitations gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== BROWSER RESOURCE LIMITS =====

  test.describe('Browser Resource Limits', () => {
    test('handles maximum tab limit scenarios', async ({ context }) => {
      // Create multiple pages to simulate many tabs
      const pages = []
      for (let i = 0; i < 10; i++) {
        const page = await context.newPage()
        pages.push(page)
        await page.goto('/dashboard')
      }

      // All pages should load
      for (const page of pages) {
        await expect(page.locator('body')).toBeVisible()
      }

      // Close all extra pages
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close()
      }
    })

    test('handles JavaScript execution limits', async ({ page }) => {
      await page.goto('/dashboard')

      // Test with long-running script
      await page.evaluate(() => {
        function longRunningTask() {
          const start = Date.now()
          while (Date.now() - start < 10000) { // 10 seconds
            // Busy wait
          }
          return true
        }

        try {
          window.longRunningResult = longRunningTask()
        } catch (error) {
          window.longRunningError = error.message
        }
      })

      // Should handle long-running scripts
      await expect(page.locator('body')).toBeVisible()

      // Check if script completed or was interrupted
      const result = await page.evaluate(() => window.longRunningResult)
      const error = await page.evaluate(() => window.longRunningError)

      // Either completed or was handled gracefully
      expect(result === true || error).toBe(true)
    })

    test('handles maximum call stack size', async ({ page }) => {
      await page.goto('/dashboard')

      // Test recursive function that may exceed call stack
      await page.evaluate(() => {
        function deepRecursion(depth = 0) {
          if (depth > 10000) return depth
          return deepRecursion(depth + 1)
        }

        try {
          window.recursionResult = deepRecursion()
        } catch (error) {
          window.recursionError = error.message
        }
      })

      // Should handle stack overflow gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for error handling
      const error = await page.evaluate(() => window.recursionError)
      if (error) {
        expect(error).toContain('stack') // Should be stack-related error
      }
    })

    test('handles DOM size limits', async ({ page }) => {
      await page.goto('/dashboard')

      // Create many DOM elements
      await page.evaluate(() => {
        const container = document.createElement('div')
        container.id = 'dom-test-container'
        document.body.appendChild(container)

        try {
          for (let i = 0; i < 10000; i++) {
            const element = document.createElement('div')
            element.textContent = `Element ${i}`
            container.appendChild(element)
          }
          window.domCreationSuccess = true
        } catch (error) {
          window.domCreationError = error.message
        }
      })

      // Should handle large DOM gracefully
      await expect(page.locator('body')).toBeVisible()

      // Clean up
      await page.evaluate(() => {
        const container = document.getElementById('dom-test-container')
        if (container) container.remove()
      })
    })
  })

  // ===== NETWORK PERFORMANCE =====

  test.describe('Network Performance', () => {
    test('handles network timeouts', async ({ page }) => {
      // Set up route to timeout
      await page.route('**/api/slow-endpoint', async route => {
        // Delay response beyond timeout
        setTimeout(() => route.fulfill({ status: 200, body: 'delayed response' }), 35000)
      })

      await page.goto('/dashboard')

      // Trigger request that will timeout
      await page.evaluate(() => {
        fetch('/api/slow-endpoint', { signal: AbortSignal.timeout(5000) })
          .then(response => window.fetchResult = 'success')
          .catch(error => window.fetchError = error.message)
      })

      // Wait for timeout
      await page.waitForTimeout(6000)

      // Should handle timeout gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for timeout handling
      const error = await page.evaluate(() => window.fetchError)
      expect(error).toBeDefined()
    })

    test('handles network interruptions during operations', async ({ page }) => {
      await page.goto('/dashboard')

      // Start an operation
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        // Click and immediately interrupt network
        await Promise.all([
          button.click(),
          page.route('**/*', route => {
            setTimeout(() => route.abort(), 500) // Interrupt after 500ms
          })
        ])

        // Should handle network interruption gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles bandwidth throttling', async ({ page }) => {
      // Simulate slow bandwidth
      await page.route('**/*', async route => {
        // Simulate slow download
        const response = await route.fetch()
        const body = await response.text()

        // Add artificial delay based on content size
        const delay = Math.min(body.length / 1000, 5000) // Max 5 second delay
        await page.waitForTimeout(delay)

        await route.fulfill({ body })
      })

      await page.goto('/dashboard')

      // Should load despite bandwidth limitations
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles DNS resolution failures', async ({ page }) => {
      // Simulate DNS failure for external resources
      await page.route('https://external-service.com/**', route => route.abort())

      await page.goto('/dashboard')

      // Should handle DNS failures gracefully
      await expect(page.locator('body')).toBeVisible()

      // Core functionality should still work
      const coreElements = page.locator('nav, main, .dashboard-content')
      const coreCount = await coreElements.count()
      expect(coreCount).toBeGreaterThan(0)
    })
  })

  // ===== BROWSER COMPATIBILITY PERFORMANCE =====

  test.describe('Browser Compatibility Performance', () => {
    test('handles different browser engines', async ({ page }) => {
      // Test with different user agents to simulate different browsers
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59'
      ]

      for (const ua of userAgents) {
        await page.setExtraHTTPHeaders({ 'User-Agent': ua })
        await page.reload()

        // Should work across different browser engines
        await expect(page.locator('body')).toBeVisible()

        // Test basic interaction
        const button = page.locator('button').first()
        if (await button.isVisible()) {
          await button.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles browser feature detection', async ({ page }) => {
      await page.goto('/dashboard')

      // Test feature detection
      const features = await page.evaluate(() => {
        return {
          webgl: !!window.WebGLRenderingContext,
          websockets: !!window.WebSocket,
          localStorage: !!window.localStorage,
          indexedDB: !!window.indexedDB,
          serviceWorker: !!navigator.serviceWorker,
          geolocation: !!navigator.geolocation,
          notifications: !!window.Notification
        }
      })

      console.log('Browser features detected:', features)

      // Should detect features appropriately
      expect(typeof features.websockets).toBe('boolean')
      expect(typeof features.localStorage).toBe('boolean')
    })

    test('handles polyfill loading performance', async ({ page }) => {
      // Simulate slow polyfill loading
      await page.route('**/polyfills/**', async route => {
        await page.waitForTimeout(2000) // Delay polyfill loading
        await route.continue()
      })

      await page.goto('/dashboard')

      // Should handle slow polyfill loading
      await expect(page.locator('body')).toBeVisible()

      // Core functionality should work even with delayed polyfills
      const coreElements = page.locator('button, input, a')
      const coreCount = await coreElements.count()
      expect(coreCount).toBeGreaterThan(0)
    })

    test('handles browser extension interference', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate extension interference by modifying DOM
      await page.evaluate(() => {
        // Add extension-like elements
        const extensionDiv = document.createElement('div')
        extensionDiv.id = 'extension-overlay'
        extensionDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 50px; background: red; z-index: 9999;'
        document.body.appendChild(extensionDiv)

        // Add extension scripts
        const script = document.createElement('script')
        script.textContent = 'window.extensionLoaded = true;'
        document.head.appendChild(script)
      })

      // Should handle extension interference gracefully
      await expect(page.locator('body')).toBeVisible()

      // Core functionality should still work
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  // ===== MEMORY LEAK DETECTION =====

  test.describe('Memory Leak Detection', () => {
    test('monitors memory usage over time', async ({ page }) => {
      await page.goto('/dashboard')

      const memoryReadings = []

      // Take memory readings over time
      for (let i = 0; i < 10; i++) {
        const memory = await page.evaluate(() => {
          if (performance.memory) {
            return performance.memory.usedJSHeapSize
          }
          return null
        })

        if (memory !== null) {
          memoryReadings.push(memory)
        }

        // Perform some operations
        const button = page.locator('button').first()
        if (await button.isVisible()) {
          await button.click()
        }

        await page.waitForTimeout(1000)
      }

      if (memoryReadings.length > 1) {
        const initialMemory = memoryReadings[0]
        const finalMemory = memoryReadings[memoryReadings.length - 1]
        const memoryIncrease = finalMemory - initialMemory

        console.log(`Memory usage: ${initialMemory} -> ${finalMemory} (${memoryIncrease} increase)`)

        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      }
    })

    test('handles garbage collection pressure', async ({ page }) => {
      await page.goto('/dashboard')

      // Create garbage collection pressure
      await page.evaluate(() => {
        const garbage = []
        for (let i = 0; i < 100; i++) {
          garbage.push(new Array(10000).fill({ data: 'garbage' }))
        }

        // Clear references to trigger GC
        setTimeout(() => {
          garbage.length = 0
        }, 1000)
      })

      // Wait for GC
      await page.waitForTimeout(2000)

      // Should handle GC pressure gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('detects potential memory leaks in event listeners', async ({ page }) => {
      await page.goto('/dashboard')

      // Add many event listeners
      await page.evaluate(() => {
        const elements = document.querySelectorAll('*')
        window.testEventListeners = 0

        elements.forEach(element => {
          if (window.testEventListeners < 1000) { // Limit to prevent browser crash
            element.addEventListener('click', () => {})
            window.testEventListeners++
          }
        })
      })

      // Perform operations
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        for (let i = 0; i < 10; i++) {
          await button.click()
          await page.waitForTimeout(100)
        }
      }

      // Should handle many event listeners gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles memory pressure from large images', async ({ page }) => {
      await page.goto('/dashboard')

      // Load many large images
      await page.evaluate(() => {
        const container = document.createElement('div')
        container.style.display = 'none' // Hidden to avoid layout issues
        document.body.appendChild(container)

        for (let i = 0; i < 50; i++) {
          const img = document.createElement('img')
          img.src = `data:image/svg+xml;base64,${btoa('<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="red"/></svg>')}`
          container.appendChild(img)
        }
      })

      // Wait for images to load
      await page.waitForTimeout(5000)

      // Should handle large images gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== LOAD TESTING SCENARIOS =====

  test.describe('Load Testing Scenarios', () => {
    test('handles sustained high load', async ({ page }) => {
      await page.goto('/dashboard')

      const startTime = Date.now()
      let operationCount = 0

      // Perform operations for 30 seconds
      while (Date.now() - startTime < 30000) {
        const buttons = page.locator('button')
        const buttonCount = await buttons.count()

        if (buttonCount > 0) {
          const randomButton = buttons.nth(Math.floor(Math.random() * buttonCount))
          if (await randomButton.isVisible()) {
            await randomButton.click()
            operationCount++
          }
        }

        // Small delay to prevent overwhelming
        await page.waitForTimeout(100)
      }

      console.log(`Performed ${operationCount} operations in 30 seconds`)

      // Should handle sustained load
      await expect(page.locator('body')).toBeVisible()
      expect(operationCount).toBeGreaterThan(0)
    })

    test('handles peak load spikes', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate load spike - many operations at once
      const operations = []

      for (let i = 0; i < 20; i++) {
        operations.push(page.evaluate(() => {
          // Simulate async operation
          return new Promise(resolve => {
            setTimeout(() => resolve(Math.random()), Math.random() * 1000)
          })
        }))
      }

      // Execute all operations simultaneously
      const startTime = Date.now()
      const results = await Promise.allSettled(operations)
      const endTime = Date.now()

      console.log(`Completed ${results.length} operations in ${endTime - startTime}ms`)

      // Should handle load spike
      await expect(page.locator('body')).toBeVisible()
      expect(results.length).toBe(20)
    })

    test('handles gradual load increase', async ({ page }) => {
      await page.goto('/dashboard')

      // Gradually increase load
      for (let loadLevel = 1; loadLevel <= 10; loadLevel++) {
        const operations = []

        // Increase number of concurrent operations
        for (let i = 0; i < loadLevel * 2; i++) {
          operations.push(page.evaluate((delay) => {
            return new Promise(resolve => setTimeout(() => resolve(true), delay))
          }, Math.random() * 1000))
        }

        const startTime = Date.now()
        await Promise.allSettled(operations)
        const endTime = Date.now()

        console.log(`Load level ${loadLevel}: ${operations.length} operations in ${endTime - startTime}ms`)

        // Should handle increasing load
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles load with resource cleanup', async ({ page }) => {
      await page.goto('/dashboard')

      // Create resources that need cleanup
      for (let i = 0; i < 100; i++) {
        await page.evaluate((index) => {
          const element = document.createElement('div')
          element.id = `test-element-${index}`
          element.textContent = `Test ${index}`
          document.body.appendChild(element)

          // Add event listener
          element.addEventListener('click', () => {})
        }, i)
      }

      // Remove resources
      await page.evaluate(() => {
        for (let i = 0; i < 100; i++) {
          const element = document.getElementById(`test-element-${i}`)
          if (element) {
            element.remove()
          }
        }
      })

      // Should handle resource cleanup under load
      await expect(page.locator('body')).toBeVisible()

      // Check memory after cleanup
      const memoryAfterCleanup = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize
        }
        return null
      })

      if (memoryAfterCleanup) {
        console.log('Memory after cleanup:', memoryAfterCleanup)
      }
    })
  })
})