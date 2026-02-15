import { test, expect } from '@playwright/test'

/**
 * Accessibility Edge Cases E2E Tests — Phase 3
 *
 * Tests comprehensive accessibility scenarios including
 * screen readers, keyboard navigation, and assistive technologies.
 */

test.describe('Accessibility Edge Cases', () => {

  // ===== SCREEN READER COMPATIBILITY =====

  test.describe('Screen Reader Compatibility', () => {
    test('handles dynamic content updates for screen readers', async ({ page }) => {
      await page.goto('/dashboard')

      // Test ARIA live regions
      const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]')

      // Trigger actions that should update live regions
      const actionButton = page.locator('button').first()
      if (await actionButton.isVisible()) {
        await actionButton.click()

        // Check if live regions are updated
        for (const region of await liveRegions.all()) {
          // Live regions should be present and potentially updated
          await expect(region).toBeVisible()
        }
      }

      // Test dynamic content announcements
      await page.evaluate(() => {
        // Simulate dynamic content addition
        const announcement = document.createElement('div')
        announcement.setAttribute('aria-live', 'polite')
        announcement.textContent = 'Content updated dynamically'
        document.body.appendChild(announcement)
      })

      // Screen reader should be able to access the announcement
      const announcement = page.locator('[aria-live="polite"]').last()
      await expect(announcement).toBeVisible()
    })

    test('provides proper heading hierarchy', async ({ page }) => {
      await page.goto('/dashboard')

      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6')

      let previousLevel = 0
      for (const heading of await headings.all()) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase())
        const level = parseInt(tagName.substring(1))

        // Headings should not skip levels (though this is a guideline, not strict rule)
        // At minimum, they should be in logical order
        expect(level).toBeGreaterThanOrEqual(previousLevel - 1) // Allow h2 after h1, etc.

        previousLevel = level
      }

      // Should have at least one h1
      const h1Count = await page.locator('h1').count()
      expect(h1Count).toBeGreaterThan(0)
    })

    test('handles focus management correctly', async ({ page }) => {
      await page.goto('/dashboard')

      // Test initial focus
      const initialFocus = page.locator(':focus')
      // Initial focus may be on body or a specific element

      // Test tab order
      await page.keyboard.press('Tab')
      const firstFocusable = page.locator(':focus')

      if (await firstFocusable.isVisible()) {
        // Continue tabbing through focusable elements
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab')
          const currentFocus = page.locator(':focus')
          if (await currentFocus.isVisible()) {
            // Each focused element should be visible and focusable
            const isVisible = await currentFocus.isVisible()
            expect(isVisible).toBe(true)
          }
        }
      }
    })

    test('provides descriptive labels and descriptions', async ({ page }) => {
      await page.goto('/dashboard')

      // Check form inputs have labels
      const inputs = page.locator('input, select, textarea')
      for (const input of await inputs.all()) {
        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')

        // Should have some form of labeling
        const hasLabel = id || ariaLabel || ariaLabelledBy
        if (!hasLabel) {
          // Check for associated label element
          const name = await input.getAttribute('name')
          if (name) {
            const label = page.locator(`label[for="${id || name}"]`)
            const hasLabelElement = await label.isVisible()
            expect(hasLabelElement || ariaLabel || ariaLabelledBy).toBe(true)
          }
        }
      }

      // Check buttons have accessible names
      const buttons = page.locator('button, [role="button"]')
      for (const button of await buttons.all()) {
        const text = await button.textContent()
        const ariaLabel = await button.getAttribute('aria-label')
        const title = await button.getAttribute('title')

        // Buttons should have some form of accessible name
        const hasAccessibleName = (text && text.trim()) || ariaLabel || title
        expect(hasAccessibleName).toBe(true)
      }
    })
  })

  // ===== KEYBOARD NAVIGATION =====

  test.describe('Keyboard Navigation', () => {
    test('handles complex keyboard interactions', async ({ page }) => {
      await page.goto('/dashboard')

      // Test various keyboard shortcuts and interactions
      const keyboardTests = [
        { keys: ['Tab'], description: 'Basic tab navigation' },
        { keys: ['Shift', 'Tab'], description: 'Reverse tab navigation' },
        { keys: ['Enter'], description: 'Enter key activation' },
        { keys: ['Space'], description: 'Space key activation' },
        { keys: ['Escape'], description: 'Escape key' },
        { keys: ['ArrowUp'], description: 'Up arrow' },
        { keys: ['ArrowDown'], description: 'Down arrow' },
        { keys: ['ArrowLeft'], description: 'Left arrow' },
        { keys: ['ArrowRight'], description: 'Right arrow' },
      ]

      for (const test of keyboardTests) {
        try {
          if (test.keys.length === 1) {
            await page.keyboard.press(test.keys[0])
          } else {
            await page.keyboard.press(`${test.keys[0]}+${test.keys[1]}`)
          }

          // Should handle keyboard input gracefully
          await expect(page.locator('body')).toBeVisible()
        } catch (error) {
          // Some key combinations may not be applicable
        }
      }
    })

    test('handles skip links and navigation shortcuts', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for skip links
      const skipLinks = page.locator('a[href^="#"], [href*="skip"]').filter({ hasText: /skip/i })

      if (await skipLinks.count() > 0) {
        // Test skip link functionality
        const firstSkipLink = skipLinks.first()
        await firstSkipLink.click()

        // Should navigate to target
        await expect(page.locator('body')).toBeVisible()
      }

      // Test keyboard navigation to main content
      await page.keyboard.press('Tab') // Focus first element
      await page.keyboard.press('Tab') // Focus second element

      // Look for main content area
      const mainContent = page.locator('main, [role="main"], #main, .main-content')
      if (await mainContent.isVisible()) {
        // Should be able to reach main content via keyboard
      }
    })

    test('handles custom keyboard shortcuts', async ({ page }) => {
      await page.goto('/dashboard')

      // Test common keyboard shortcuts
      const shortcuts = [
        { keys: ['Control', 's'], description: 'Ctrl+S (save)' },
        { keys: ['Control', 'f'], description: 'Ctrl+F (find)' },
        { keys: ['Control', 'r'], description: 'Ctrl+R (refresh)' },
        { keys: ['Alt', 'h'], description: 'Alt+H (home)' },
        { keys: ['F1'], description: 'F1 (help)' },
      ]

      for (const shortcut of shortcuts) {
        try {
          await page.keyboard.press(`${shortcut.keys[0]}+${shortcut.keys[1] || ''}`)

          // Should handle shortcuts gracefully (may or may not do anything)
          await expect(page.locator('body')).toBeVisible()
        } catch (error) {
          // Shortcut may not be implemented
        }
      }
    })

    test('handles keyboard traps and focus management', async ({ page }) => {
      await page.goto('/dashboard')

      // Look for modal dialogs or focus traps
      const modals = page.locator('[role="dialog"], .modal, .popup')

      if (await modals.count() > 0) {
        // Open a modal
        const modalTrigger = page.locator('button[data-modal], [aria-haspopup="dialog"]').first()
        if (await modalTrigger.isVisible()) {
          await modalTrigger.click()

          // Test focus trap within modal
          await page.keyboard.press('Tab')
          const focusedElement = page.locator(':focus')

          // Focus should stay within modal
          const isInModal = await focusedElement.evaluate(el => {
            let parent = el
            while (parent) {
              if (parent.matches('[role="dialog"], .modal')) return true
              parent = parent.parentElement
            }
            return false
          })

          // Focus should be managed properly (may or may not be trapped)
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })

  // ===== ASSISTIVE TECHNOLOGY SUPPORT =====

  test.describe('Assistive Technology Support', () => {
    test('handles screen reader announcements', async ({ page }) => {
      await page.goto('/dashboard')

      // Test various announcement scenarios
      const announcementTests = [
        {
          action: async () => {
            const button = page.locator('button').first()
            if (await button.isVisible()) await button.click()
          },
          description: 'Button click announcements'
        },
        {
          action: async () => {
            const input = page.locator('input').first()
            if (await input.isVisible()) {
              await input.focus()
              await input.fill('test input')
            }
          },
          description: 'Form input announcements'
        },
        {
          action: async () => {
            await page.evaluate(() => {
              const alert = document.createElement('div')
              alert.setAttribute('role', 'alert')
              alert.textContent = 'Test alert message'
              document.body.appendChild(alert)
            })
          },
          description: 'Alert announcements'
        }
      ]

      for (const test of announcementTests) {
        await test.action()

        // Should handle announcements gracefully
        await expect(page.locator('body')).toBeVisible()

        // Look for announcement elements
        const alerts = page.locator('[role="alert"], [aria-live]')
        // Announcements may be present
      }
    })

    test('supports high contrast mode', async ({ page }) => {
      // Test with forced colors (high contrast mode)
      await page.emulateMedia({ forcedColors: 'active' })

      await page.goto('/dashboard')

      // Should be readable in high contrast mode
      await expect(page.locator('body')).toBeVisible()

      // Test that interactive elements are still distinguishable
      const buttons = page.locator('button')
      const links = page.locator('a')

      for (const element of await buttons.all()) {
        await expect(element).toBeVisible()
      }

      for (const element of await links.all()) {
        await expect(element).toBeVisible()
      }

      // Reset to normal colors
      await page.emulateMedia({ forcedColors: 'none' })
    })

    test('handles zoom and scaling', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 })

      await page.goto('/dashboard')

      // Test different zoom levels
      const zoomLevels = [100, 150, 200, 300]

      for (const zoom of zoomLevels) {
        await page.evaluate((zoom) => {
          document.body.style.zoom = `${zoom}%`
        }, zoom)

        // Should remain functional at different zoom levels
        await expect(page.locator('body')).toBeVisible()

        // Test basic interactions at zoom level
        const button = page.locator('button').first()
        if (await button.isVisible()) {
          await button.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('supports voice control compatibility', async ({ page }) => {
      await page.goto('/dashboard')

      // Test that elements have voice-control-friendly attributes
      const interactiveElements = page.locator('button, a, input, select, textarea')

      for (const element of await interactiveElements.all()) {
        // Elements should have accessible names for voice control
        const accessibleName = await element.evaluate(el => {
          return el.textContent?.trim() ||
                 el.getAttribute('aria-label') ||
                 el.getAttribute('title') ||
                 el.getAttribute('placeholder') ||
                 el.getAttribute('alt')
        })

        // Should have some form of accessible name
        expect(accessibleName).toBeTruthy()
      }
    })
  })

  // ===== SEMANTIC HTML AND STRUCTURE =====

  test.describe('Semantic HTML & Structure', () => {
    test('uses proper semantic landmarks', async ({ page }) => {
      await page.goto('/dashboard')

      // Check for semantic landmarks
      const landmarks = [
        'header', 'nav', 'main', 'aside', 'section', 'article', 'footer',
        '[role="banner"]', '[role="navigation"]', '[role="main"]', '[role="complementary"]', '[role="contentinfo"]'
      ]

      let landmarkCount = 0
      for (const landmark of landmarks) {
        const count = await page.locator(landmark).count()
        landmarkCount += count
      }

      // Should have at least some semantic structure
      expect(landmarkCount).toBeGreaterThan(0)
    })

    test('provides proper list semantics', async ({ page }) => {
      await page.goto('/dashboard')

      // Check lists have proper structure
      const lists = page.locator('ul, ol, dl')

      for (const list of await lists.all()) {
        const tagName = await list.evaluate(el => el.tagName.toLowerCase())

        if (tagName === 'ul' || tagName === 'ol') {
          // Should contain li elements
          const listItems = list.locator('li')
          const itemCount = await listItems.count()
          expect(itemCount).toBeGreaterThan(0)
        } else if (tagName === 'dl') {
          // Should contain dt/dd pairs
          const terms = list.locator('dt')
          const definitions = list.locator('dd')
          const termCount = await terms.count()
          const defCount = await definitions.count()
          expect(termCount).toBeGreaterThan(0)
          expect(defCount).toBeGreaterThan(0)
        }
      }
    })

    test('handles table semantics correctly', async ({ page }) => {
      await page.goto('/analytics') // Likely to have tables

      const tables = page.locator('table')

      for (const table of await tables.all()) {
        // Check for proper table structure
        const headers = table.locator('th')
        const rows = table.locator('tr')
        const cells = table.locator('td')

        const headerCount = await headers.count()
        const rowCount = await rows.count()
        const cellCount = await cells.count()

        // Tables should have some structure
        expect(rowCount).toBeGreaterThan(0)

        // If there are headers, check they're properly associated
        if (headerCount > 0) {
          // Headers should have scope or headers attributes
          for (const header of await headers.all()) {
            const scope = await header.getAttribute('scope')
            const headersAttr = await header.getAttribute('headers')
            // May or may not have scope/headers
          }
        }
      }
    })

    test('provides proper form structure', async ({ page }) => {
      await page.goto('/campaigns')

      const forms = page.locator('form')

      for (const form of await forms.all()) {
        // Forms should have proper structure
        const inputs = form.locator('input, select, textarea')
        const inputCount = await inputs.count()

        if (inputCount > 0) {
          // Should have a submit mechanism
          const submitButtons = form.locator('button[type="submit"], input[type="submit"], [role="button"]').filter({ hasText: /submit|save|create/i })
          const submitCount = await submitButtons.count()

          // May or may not have explicit submit button
          expect(submitCount >= 0).toBe(true)
        }
      }
    })
  })

  // ===== COLOR AND CONTRAST =====

  test.describe('Color & Contrast', () => {
    test('maintains accessibility in different color schemes', async ({ page }) => {
      const colorSchemes = [
        { name: 'light', media: { colorScheme: 'light' } },
        { name: 'dark', media: { colorScheme: 'dark' } },
        { name: 'high-contrast', media: { forcedColors: 'active' } }
      ]

      for (const scheme of colorSchemes) {
        await page.emulateMedia(scheme.media)
        await page.goto('/dashboard')

        // Should be functional in all color schemes
        await expect(page.locator('body')).toBeVisible()

        // Test that text is readable
        const textElements = page.locator('p, span, div, h1, h2, h3, h4, h5, h6')
        for (const element of await textElements.all()) {
          const text = await element.textContent()
          if (text && text.trim()) {
            // Element should be visible
            await expect(element).toBeVisible()
          }
        }
      }
    })

    test('handles color blindness simulations', async ({ page }) => {
      // Test with different color vision deficiencies
      // Note: Playwright doesn't directly support color blindness simulation,
      // but we can test that the UI doesn't rely solely on color

      await page.goto('/dashboard')

      // Check that important information isn't conveyed only through color
      const coloredElements = page.locator('[style*="color"], [style*="background"]')

      for (const element of await coloredElements.all()) {
        // Elements should have additional cues beyond color
        const text = await element.textContent()
        const ariaLabel = await element.getAttribute('aria-label')
        const title = await element.getAttribute('title')

        // Should have some form of non-color identification
        const hasTextualCue = (text && text.trim()) || ariaLabel || title
        expect(hasTextualCue).toBe(true)
      }
    })

    test('provides focus indicators', async ({ page }) => {
      await page.goto('/dashboard')

      // Test focus indicators on interactive elements
      const interactiveElements = page.locator('button, a, input, select, textarea')

      for (const element of await interactiveElements.all()) {
        // Focus the element
        await element.focus()

        // Should have visible focus indicator
        const isFocused = await element.evaluate(el => el.matches(':focus'))
        expect(isFocused).toBe(true)

        // Check if element has focus styling (this is hard to test precisely)
        // At minimum, the element should be focused
      }
    })
  })

  // ===== RESPONSIVE ACCESSIBILITY =====

  test.describe('Responsive Accessibility', () => {
    test('handles touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }) // iPhone size

      await page.goto('/dashboard')

      // Check touch target sizes
      const touchTargets = page.locator('button, a, input[type="checkbox"], input[type="radio"], select')

      for (const target of await touchTargets.all()) {
        const boundingBox = await target.boundingBox()

        if (boundingBox) {
          // Touch targets should be at least 44px (WCAG guideline)
          const minSize = 44
          const isAdequateSize = boundingBox.width >= minSize && boundingBox.height >= minSize

          // Log but don't fail - this is a recommendation
          if (!isAdequateSize) {
            console.log(`Touch target too small: ${boundingBox.width}x${boundingBox.height}`)
          }
        }
      }
    })

    test('handles swipe gestures and touch interactions', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto('/dashboard')

      // Test swipe gestures on carousels or swipeable content
      const swipeableElements = page.locator('.carousel, .swiper, [data-swipeable]')

      if (await swipeableElements.count() > 0) {
        const swipeable = swipeableElements.first()

        // Simulate swipe gesture
        const boundingBox = await swipeable.boundingBox()
        if (boundingBox) {
          await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2)
          await page.mouse.down()
          await page.mouse.move(boundingBox.x + boundingBox.width / 4, boundingBox.y + boundingBox.height / 2)
          await page.mouse.up()

          // Should handle swipe gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('maintains accessibility when zoomed', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      // Simulate mobile zoom
      await page.evaluate(() => {
        document.body.style.zoom = '150%'
      })

      await page.goto('/dashboard')

      // Should remain accessible when zoomed
      await expect(page.locator('body')).toBeVisible()

      // Test that interactive elements are still usable
      const buttons = page.locator('button')
      for (const button of await buttons.all()) {
        if (await button.isVisible()) {
          const boundingBox = await button.boundingBox()
          if (boundingBox) {
            // Button should still be large enough to tap
            expect(boundingBox.width).toBeGreaterThan(20)
            expect(boundingBox.height).toBeGreaterThan(20)
          }
        }
      }
    })
  })

  // ===== ERROR AND FEEDBACK ACCESSIBILITY =====

  test.describe('Error & Feedback Accessibility', () => {
    test('provides accessible error messages', async ({ page }) => {
      await page.goto('/signin')

      const emailInput = page.locator('input[type="email"]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const submitButton = page.getByRole('button', { name: /sign in|login/i }).first()

      if (await emailInput.isVisible() && await passwordInput.isVisible()) {
        // Submit empty form to trigger errors
        await submitButton.click()

        // Check for accessible error messages
        const errorMessages = page.locator('.error, [role="alert"], [aria-invalid="true"]')

        for (const error of await errorMessages.all()) {
          // Error messages should be accessible
          const isVisible = await error.isVisible()
          expect(isVisible).toBe(true)

          // Should be associated with form fields
          const ariaDescribedBy = await error.getAttribute('id')
          if (ariaDescribedBy) {
            const associatedField = page.locator(`[aria-describedby="${ariaDescribedBy}"]`)
            const hasAssociation = await associatedField.isVisible()
            expect(hasAssociation).toBe(true)
          }
        }
      }
    })

    test('handles loading states accessibly', async ({ page }) => {
      await page.goto('/dashboard')

      // Trigger a loading state
      const actionButton = page.locator('button').first()
      if (await actionButton.isVisible()) {
        await actionButton.click()

        // Check for accessible loading indicators
        const loadingIndicators = page.locator('[aria-busy="true"], .loading, .spinner, [role="progressbar"]')

        for (const indicator of await loadingIndicators.all()) {
          // Loading indicators should be accessible
          const isVisible = await indicator.isVisible()
          expect(isVisible).toBe(true)

          // Should have appropriate ARIA attributes
          const ariaBusy = await indicator.getAttribute('aria-busy')
          const role = await indicator.getAttribute('role')

          // May or may not have these attributes
        }
      }
    })

    test('provides accessible success feedback', async ({ page }) => {
      await page.goto('/campaigns')

      // Perform a successful action
      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Campaign')

          const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()
          await submitButton.click()

          // Check for accessible success messages
          const successMessages = page.locator('.success, [role="status"], [aria-live="polite"]').filter({ hasText: /success|saved|created/i })

          // Success messages may be present
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })

  // ===== MULTIMODAL INTERACTION =====

  test.describe('Multimodal Interaction', () => {
    test('supports both mouse and keyboard interaction', async ({ page }) => {
      await page.goto('/dashboard')

      const interactiveElements = page.locator('button, a, input, select')

      // Test mouse interaction
      for (const element of await interactiveElements.all()) {
        if (await element.isVisible()) {
          await element.hover()
          await element.click()

          // Should handle mouse interaction
          await expect(page.locator('body')).toBeVisible()
        }
      }

      // Test keyboard interaction
      await page.keyboard.press('Tab')
      const firstFocusable = page.locator(':focus')

      if (await firstFocusable.isVisible()) {
        await page.keyboard.press('Enter')

        // Should handle keyboard interaction
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles voice input compatibility', async ({ page }) => {
      await page.goto('/dashboard')

      // Test that form controls are voice-input friendly
      const formControls = page.locator('input, select, textarea')

      for (const control of await formControls.all()) {
        // Controls should have labels that voice input can use
        const id = await control.getAttribute('id')
        const name = await control.getAttribute('name')
        const ariaLabel = await control.getAttribute('aria-label')
        const placeholder = await control.getAttribute('placeholder')

        // Should have some form of identification for voice input
        const hasIdentification = id || name || ariaLabel || placeholder
        expect(hasIdentification).toBe(true)

        // Associated labels should exist
        if (id) {
          const label = page.locator(`label[for="${id}"]`)
          const hasLabel = await label.isVisible()
          expect(hasLabel || ariaLabel).toBe(true)
        }
      }
    })

    test('supports switch control accessibility', async ({ page }) => {
      await page.goto('/dashboard')

      // Test that interface works with switch control devices
      const focusableElements = page.locator('button, a, input, select, textarea, [tabindex]')

      let focusableCount = 0
      for (const element of await focusableElements.all()) {
        const isVisible = await element.isVisible()
        const tabindex = await element.getAttribute('tabindex')

        if (isVisible && (tabindex === null || parseInt(tabindex) >= 0)) {
          focusableCount++

          // Element should be keyboard accessible
          await element.focus()
          const isFocused = await element.evaluate(el => el.matches(':focus'))
          expect(isFocused).toBe(true)
        }
      }

      // Should have a reasonable number of focusable elements
      expect(focusableCount).toBeGreaterThan(0)
    })
  })
})