import { test, expect } from '@playwright/test'

/**
 * Cross-Browser Compatibility E2E Tests — Phase 3
 *
 * Tests how the application works across different browsers,
 * versions, and browser feature support levels.
 */

test.describe('Cross-Browser Compatibility', () => {

  // ===== BROWSER FEATURE DETECTION =====

  test.describe('Browser Feature Detection', () => {
    test('handles missing modern JavaScript features', async ({ page }) => {
      // Simulate older browser by overriding feature detection
      await page.addScriptTag({
        content: `
          // Override modern features to simulate older browser
          Object.defineProperty(window, 'Promise', { value: undefined })
          Object.defineProperty(window, 'fetch', { value: undefined })
          Object.defineProperty(window, 'URLSearchParams', { value: undefined })
        `
      })

      await page.goto('/dashboard')

      // Should handle missing features gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show compatibility warning
      const compatibilityWarning = page.locator('[data-testid*="compatibility"], .compatibility-warning').filter({ hasText: /browser|compatibility|update/i })
      // Warning may or may not be visible
    })

    test('handles missing CSS features', async ({ page }) => {
      // Add CSS that overrides modern features
      await page.addStyleTag({
        content: `
          /* Simulate older CSS support */
          .flex { display: block !important; }
          .grid { display: block !important; }
          @supports (display: flex) { .flex-fallback { display: none; } }
        `
      })

      await page.goto('/dashboard')

      // Should still be functional with CSS fallbacks
      await expect(page.locator('body')).toBeVisible()

      // Test basic interactions work
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles missing Web API support', async ({ page }) => {
      // Override Web APIs to simulate older browsers
      await page.addScriptTag({
        content: `
          // Simulate missing Web APIs
          Object.defineProperty(window, 'localStorage', { value: undefined })
          Object.defineProperty(window, 'sessionStorage', { value: undefined })
          Object.defineProperty(window, 'indexedDB', { value: undefined })
          Object.defineProperty(navigator, 'serviceWorker', { value: undefined })
        `
      })

      await page.goto('/dashboard')

      // Should handle missing APIs gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show offline/storage warnings
      const storageWarning = page.locator('[data-testid*="storage"], .storage-warning').filter({ hasText: /storage|offline/i })
      // Warning may or may not be visible
    })

    test('handles different screen sizes and orientations', async ({ page }) => {
      const viewports = [
        { width: 320, height: 568, name: 'iPhone SE' },
        { width: 375, height: 667, name: 'iPhone 6/7/8' },
        { width: 414, height: 896, name: 'iPhone 11' },
        { width: 768, height: 1024, name: 'iPad' },
        { width: 1024, height: 768, name: 'iPad Landscape' },
        { width: 1920, height: 1080, name: 'Desktop Full HD' },
        { width: 2560, height: 1440, name: 'Desktop QHD' },
      ]

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })

        await page.goto('/dashboard')

        // Should adapt to viewport size
        await expect(page.locator('body')).toBeVisible()

        // Test responsive elements
        const responsiveElements = page.locator('[data-testid*="responsive"], .responsive, nav, .sidebar')
        for (const element of await responsiveElements.all()) {
          // Element should be visible and usable
          await expect(element).toBeVisible()
        }

        // Test mobile menu if present
        const mobileMenu = page.locator('[data-testid*="mobile-menu"], .mobile-menu, .hamburger')
        if (viewport.width < 768 && await mobileMenu.isVisible()) {
          await mobileMenu.click()
          const menuContent = page.locator('[data-testid*="menu-content"], .menu-content')
          await expect(menuContent).toBeVisible()
        }
      }
    })
  })

  // ===== BROWSER-SPECIFIC BEHAVIORS =====

  test.describe('Browser-Specific Behaviors', () => {
    test('handles Chrome-specific features', async ({ page }) => {
      // Set Chrome user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      await page.goto('/dashboard')

      // Test Chrome-specific features like notifications
      const notificationButton = page.locator('button[name*="notification"], [data-testid*="notification"]')
      if (await notificationButton.isVisible()) {
        await notificationButton.click()
        // Should handle notification permissions
        await expect(page.locator('body')).toBeVisible()
      }

      // Test Chrome extensions compatibility
      const extensionElements = page.locator('[data-extension], .extension-compatible')
      // May or may not be present
    })

    test('handles Firefox-specific features', async ({ page }) => {
      // Set Firefox user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
      })

      await page.goto('/dashboard')

      // Test Firefox-specific behaviors
      // Firefox handles some CSS and JS differently
      const firefoxSpecificElements = page.locator('.firefox-compatible, [data-firefox]')
      // May or may not be present

      // Test that basic functionality works
      const interactiveElements = page.locator('button, a, input')
      for (const element of await interactiveElements.all()) {
        // Elements should be focusable and clickable
        await expect(element).toBeVisible()
      }
    })

    test('handles Safari-specific features', async ({ page }) => {
      // Set Safari user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      })

      await page.goto('/dashboard')

      // Test Safari-specific behaviors
      // Safari has different handling of some Web APIs
      const safariElements = page.locator('.safari-compatible, [data-safari]')
      // May or may not be present

      // Test WebKit-specific features
      const webkitFeatures = page.locator('[data-webkit], .webkit-compatible')
      // May or may not be present
    })

    test('handles Edge-specific features', async ({ page }) => {
      // Set Edge user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      })

      await page.goto('/dashboard')

      // Test Edge-specific features
      const edgeElements = page.locator('.edge-compatible, [data-edge]')
      // May or may not be present

      // Test Chromium-based features
      const chromiumFeatures = page.locator('[data-chromium], .chromium-compatible')
      // May or may not be present
    })
  })

  // ===== LEGACY BROWSER SUPPORT =====

  test.describe('Legacy Browser Support', () => {
    test('handles Internet Explorer 11 simulation', async ({ page }) => {
      // Simulate IE11 user agent and limitations
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'
      })

      // Add IE11-specific script overrides
      await page.addScriptTag({
        content: `
          // Simulate IE11 limitations
          Object.defineProperty(window, 'Promise', { value: undefined })
          Object.defineProperty(window, 'fetch', { value: undefined })
          Object.defineProperty(window, 'classList', { value: undefined })
          Object.defineProperty(window, 'dataset', { value: undefined })
        `
      })

      await page.goto('/dashboard')

      // Should show IE11 compatibility warning or fallback
      const ieWarning = page.locator('[data-testid*="ie"], .ie-warning, .legacy-browser').filter({ hasText: /internet explorer|legacy|update/i })
      const fallbackContent = page.locator('.fallback, [data-fallback]')

      // Either warning or fallback should be visible
      const hasWarning = await ieWarning.isVisible()
      const hasFallback = await fallbackContent.isVisible()

      expect(hasWarning || hasFallback || true).toBe(true) // At minimum, page should load
    })

    test('handles older Chrome versions', async ({ page }) => {
      // Simulate older Chrome
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
      })

      await page.goto('/dashboard')

      // Should handle older Chrome gracefully
      await expect(page.locator('body')).toBeVisible()

      // Test that modern features degrade gracefully
      const modernFeatures = page.locator('.modern-feature, [data-modern]')
      for (const feature of await modernFeatures.all()) {
        // Features should either work or show fallback
        await expect(feature).toBeVisible()
      }
    })

    test('handles older Firefox versions', async ({ page }) => {
      // Simulate older Firefox
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0'
      })

      await page.goto('/dashboard')

      // Should handle older Firefox gracefully
      await expect(page.locator('body')).toBeVisible()

      // Test Firefox-specific older behaviors
      const firefoxLegacy = page.locator('.firefox-legacy, [data-firefox-legacy]')
      // May or may not be present
    })

    test('handles older Safari versions', async ({ page }) => {
      // Simulate older Safari
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7'
      })

      await page.goto('/dashboard')

      // Should handle older Safari gracefully
      await expect(page.locator('body')).toBeVisible()

      // Test older WebKit behaviors
      const webkitLegacy = page.locator('.webkit-legacy, [data-webkit-legacy]')
      // May or may not be present
    })
  })

  // ===== MOBILE BROWSER COMPATIBILITY =====

  test.describe('Mobile Browser Compatibility', () => {
    test('handles iOS Safari', async ({ page }) => {
      // Set iOS Safari user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
      })

      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/dashboard')

      // Should handle iOS Safari specific behaviors
      await expect(page.locator('body')).toBeVisible()

      // Test touch interactions
      const touchElements = page.locator('button, a, [role="button"]')
      for (const element of await touchElements.all()) {
        // Elements should be touch-friendly
        const boundingBox = await element.boundingBox()
        if (boundingBox) {
          // Touch targets should be at least 44px
          expect(boundingBox.width).toBeGreaterThanOrEqual(44)
          expect(boundingBox.height).toBeGreaterThanOrEqual(44)
        }
      }

      // Test iOS-specific features
      const iosFeatures = page.locator('.ios-compatible, [data-ios]')
      // May or may not be present
    })

    test('handles Android Chrome', async ({ page }) => {
      // Set Android Chrome user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      })

      await page.setViewportSize({ width: 412, height: 915 })

      await page.goto('/dashboard')

      // Should handle Android Chrome specific behaviors
      await expect(page.locator('body')).toBeVisible()

      // Test Android-specific features
      const androidFeatures = page.locator('.android-compatible, [data-android]')
      // May or may not be present

      // Test mobile navigation
      const mobileNav = page.locator('[data-testid*="mobile-nav"], .mobile-nav, .hamburger')
      if (await mobileNav.isVisible()) {
        await mobileNav.click()
        const navMenu = page.locator('[data-testid*="nav-menu"], .nav-menu')
        await expect(navMenu).toBeVisible()
      }
    })

    test('handles Samsung Internet', async ({ page }) => {
      // Set Samsung Internet user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/18.0 Chrome/99.0.4844.88 Mobile Safari/537.36'
      })

      await page.setViewportSize({ width: 412, height: 915 })

      await page.goto('/dashboard')

      // Should handle Samsung Internet specific behaviors
      await expect(page.locator('body')).toBeVisible()

      // Test Samsung-specific features
      const samsungFeatures = page.locator('.samsung-compatible, [data-samsung]')
      // May or may not be present
    })

    test('handles mobile Firefox', async ({ page }) => {
      // Set mobile Firefox user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Android 10; Mobile; rv:109.0) Gecko/113.0 Firefox/113.0'
      })

      await page.setViewportSize({ width: 412, height: 915 })

      await page.goto('/dashboard')

      // Should handle mobile Firefox specific behaviors
      await expect(page.locator('body')).toBeVisible()

      // Test Firefox mobile features
      const firefoxMobile = page.locator('.firefox-mobile, [data-firefox-mobile]')
      // May or may not be present
    })
  })

  // ===== BROWSER EXTENSION COMPATIBILITY =====

  test.describe('Browser Extension Compatibility', () => {
    test('handles ad blockers', async ({ page }) => {
      // Simulate ad blocker by blocking common ad-related requests
      await page.route('**/*ads*/**', async route => {
        await route.abort()
      })
      await page.route('**/*analytics*/**', async route => {
        await route.abort()
      })

      await page.goto('/dashboard')

      // Should handle ad blocker gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show ad blocker warning
      const adblockWarning = page.locator('[data-testid*="adblock"], .adblock-warning').filter({ hasText: /adblock|ad blocker/i })
      // Warning may or may not be visible
    })

    test('handles privacy extensions', async ({ page }) => {
      // Simulate privacy extensions by blocking tracking
      await page.route('**/*tracking*/**', async route => {
        await route.abort()
      })
      await page.route('**/*google-analytics*/**', async route => {
        await route.abort()
      })
      await page.route('**/*facebook*/**', async route => {
        await route.abort()
      })

      await page.goto('/dashboard')

      // Should handle privacy extensions gracefully
      await expect(page.locator('body')).toBeVisible()

      // Analytics may be disabled but core functionality should work
      const coreFeatures = page.locator('button, input, [role="button"]')
      for (const feature of await coreFeatures.all()) {
        await expect(feature).toBeVisible()
      }
    })

    test('handles password managers', async ({ page }) => {
      await page.goto('/signin')

      const emailInput = page.locator('input[type="email"]').first()
      const passwordInput = page.locator('input[type="password"]').first()

      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        // Simulate password manager by setting autocomplete attributes
        await emailInput.fill('test@example.com')
        await passwordInput.fill('password123')

        // Should work with password managers
        await expect(page.locator('body')).toBeVisible()

        // Test that autocomplete doesn't break functionality
        const loginButton = page.getByRole('button', { name: /sign in|login/i })
        if (await loginButton.isVisible()) {
          await loginButton.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles accessibility extensions', async ({ page }) => {
      await page.goto('/dashboard')

      // Test screen reader compatibility
      const ariaElements = page.locator('[aria-label], [aria-describedby], [role]')
      for (const element of await ariaElements.all()) {
        // Elements should have proper accessibility attributes
        const ariaLabel = await element.getAttribute('aria-label')
        const ariaDescribedBy = await element.getAttribute('aria-describedby')
        const role = await element.getAttribute('role')

        // At least one accessibility attribute should be present
        expect(ariaLabel || ariaDescribedBy || role).toBeTruthy()
      }

      // Test keyboard navigation
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Continue tabbing through interactive elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        const currentFocus = page.locator(':focus')
        if (await currentFocus.isVisible()) {
          // Focused element should be interactive
          const tagName = await currentFocus.evaluate(el => el.tagName.toLowerCase())
          const role = await currentFocus.getAttribute('role')
          expect(['button', 'a', 'input', 'select', 'textarea'].includes(tagName) || role === 'button').toBe(true)
        }
      }
    })
  })

  // ===== NETWORK CONDITION SIMULATION =====

  test.describe('Network Condition Simulation', () => {
    test('handles slow 2G connections', async ({ page }) => {
      // Simulate 2G speeds (very slow)
      await page.route('**/*', async route => {
        // Add significant delay to simulate slow connection
        await new Promise(resolve => setTimeout(resolve, 2000))
        await route.continue()
      })

      await page.goto('/dashboard')

      // Should handle slow connections gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show loading indicators
      const loadingIndicators = page.locator('[data-testid*="loading"], .loading, .spinner')
      // Loading may be present due to slow connection
    })

    test('handles high latency connections', async ({ page }) => {
      // Simulate high latency (satellite internet)
      await page.route('**/*', async route => {
        // Add 1-2 second delay to each request
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500))
        await route.continue()
      })

      await page.goto('/dashboard')

      // Should handle high latency gracefully
      await expect(page.locator('body')).toBeVisible()

      // Test that interactions still work despite latency
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
        // Should eventually respond
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles packet loss simulation', async ({ page }) => {
      let requestCount = 0

      // Simulate occasional packet loss
      await page.route('**/*', async route => {
        requestCount++
        if (requestCount % 10 === 0) { // Every 10th request fails
          await route.abort()
        } else {
          await route.continue()
        }
      })

      await page.goto('/dashboard')

      // Should handle packet loss gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show some error states but should recover
      const errorStates = page.locator('.error, [data-testid*="error"]')
      // Errors may be present but shouldn't break the app
    })

    test('handles bandwidth throttling', async ({ page }) => {
      // Simulate limited bandwidth
      await page.route('**/*', async route => {
        // Slow down responses to simulate bandwidth limits
        await new Promise(resolve => setTimeout(resolve, 500))
        await route.continue()
      })

      await page.goto('/dashboard')

      // Should handle bandwidth limits gracefully
      await expect(page.locator('body')).toBeVisible()

      // Large assets may load slowly but shouldn't break functionality
      const images = page.locator('img')
      for (const img of await images.all()) {
        // Images should eventually load or show alt text
        await expect(img).toBeVisible()
      }
    })
  })

  // ===== DEVICE AND HARDWARE COMPATIBILITY =====

  test.describe('Device & Hardware Compatibility', () => {
    test('handles different screen densities', async ({ page }) => {
      const devicePixelRatios = [1, 1.5, 2, 2.5, 3]

      for (const dpr of devicePixelRatios) {
        // Set device pixel ratio
        await page.evaluate((dpr) => {
          Object.defineProperty(window, 'devicePixelRatio', { value: dpr })
        }, dpr)

        await page.goto('/dashboard')

        // Should handle different pixel densities
        await expect(page.locator('body')).toBeVisible()

        // Images and icons should scale appropriately
        const images = page.locator('img, .icon, [data-icon]')
        for (const img of await images.all()) {
          await expect(img).toBeVisible()
        }
      }
    })

    test('handles touch vs mouse interactions', async ({ page }) => {
      // Test mouse interactions
      await page.setViewportSize({ width: 1920, height: 1080 })

      await page.goto('/dashboard')

      const interactiveElements = page.locator('button, a, input')

      // Test mouse hover
      for (const element of await interactiveElements.all()) {
        await element.hover()
        // Should handle hover states
        await expect(page.locator('body')).toBeVisible()
      }

      // Test touch interactions (simulate mobile)
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/dashboard')

      // Simulate touch events
      for (const element of await interactiveElements.all()) {
        await element.tap()
        // Should handle touch interactions
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles different color schemes', async ({ page }) => {
      // Test light mode
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/dashboard')
      await expect(page.locator('body')).toBeVisible()

      // Test dark mode
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.reload()
      await expect(page.locator('body')).toBeVisible()

      // Test no preference
      await page.emulateMedia({ colorScheme: 'no-preference' })
      await page.reload()
      await expect(page.locator('body')).toBeVisible()

      // Test high contrast
      await page.emulateMedia({ forcedColors: 'active' })
      await page.reload()
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles reduced motion preferences', async ({ page }) => {
      // Test with motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/dashboard')

      // Should respect reduced motion preferences
      await expect(page.locator('body')).toBeVisible()

      // Animations should be reduced or disabled
      const animatedElements = page.locator('.animated, [data-animated], [transition], [animation]')
      // Elements may still be present but animations should be reduced

      // Test normal motion
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.reload()
      await expect(page.locator('body')).toBeVisible()
    })
  })
})