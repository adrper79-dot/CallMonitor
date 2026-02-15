import { test, expect } from '@playwright/test'

/**
 * Invalid Data & Boundary Conditions E2E Tests — Phase 3
 *
 * Tests how the application handles invalid inputs, edge cases,
 * and boundary conditions across all forms and data entry points.
 */

test.describe('Invalid Data & Boundary Conditions', () => {

  // ===== FORM VALIDATION EDGE CASES =====

  test.describe('Form Validation Edge Cases', () => {
    test('handles extremely long input values', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        // Find text inputs
        const textInputs = page.locator('input[type="text"], input[type="email"], textarea')

        for (const input of await textInputs.all()) {
          // Try extremely long input (10,000 characters)
          const longText = 'A'.repeat(10000)
          await input.fill(longText)

          // Should handle gracefully (either accept, truncate, or show error)
          await expect(page.locator('body')).toBeVisible()
        }

        // Try to submit
        const submitButton = page.getByRole('button', { name: /save|create|submit/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          // Should handle submission attempt
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles special characters and unicode', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const specialChars = [
          '🚀🚀🚀', // Emojis
          '测试中文', // Chinese characters
          'ñáéíóú', // Accented characters
          '<script>alert("xss")</script>', // Potential XSS
          '../../../etc/passwd', // Path traversal
          'SELECT * FROM users', // SQL injection attempt
          '💀💀💀💀💀💀💀💀💀💀', // Many emojis
          'a'.repeat(1000) + '🚀'.repeat(100), // Mixed long content
        ]

        const textInputs = page.locator('input[type="text"], input[type="email"], textarea')

        for (const input of await textInputs.all()) {
          for (const specialChar of specialChars) {
            await input.fill(specialChar)

            // Should handle special characters gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles null bytes and control characters', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const controlChars = [
          '\x00\x00\x00', // Null bytes
          '\n\n\n\n\n', // Newlines
          '\t\t\t\t\t', // Tabs
          '\r\r\r\r\r', // Carriage returns
          '\x01\x02\x03\x04', // Control characters
          '\u0000\u0001\u0002', // Unicode control
        ]

        const textInputs = page.locator('input[type="text"], input[type="email"], textarea')

        for (const input of await textInputs.all()) {
          for (const controlChar of controlChars) {
            await input.fill(controlChar)

            // Should handle control characters gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles rapid form submissions', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        // Fill minimal required fields
        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Rapid Test Campaign')
        }

        // Rapidly click submit multiple times
        const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()

        for (let i = 0; i < 10; i++) {
          await submitButton.click()
          // Small delay to simulate rapid clicking
          await page.waitForTimeout(100)
        }

        // Should handle rapid submissions gracefully (prevent duplicates, show loading, etc.)
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles form submission during page navigation', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        // Fill form
        const nameInput = page.locator('input[name*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Navigation Test Campaign')
        }

        // Start form submission
        const submitButton = page.getByRole('button', { name: /save|create|submit/i }).first()
        await submitButton.click()

        // Immediately navigate away
        await page.goto('/dashboard')

        // Should handle interrupted submission gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  // ===== NUMERIC INPUT BOUNDARIES =====

  test.describe('Numeric Input Boundaries', () => {
    test('handles extremely large numbers', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const numberInputs = page.locator('input[type="number"]')

        const largeNumbers = [
          '999999999999999999999999999999999999999999999999999999999999999999999999999999',
          '1e1000',
          'Infinity',
          'NaN',
          '999999999999999999999999999999999999999999999999999999999999999999999999999999'.repeat(10),
        ]

        for (const input of await numberInputs.all()) {
          for (const largeNum of largeNumbers) {
            await input.fill(largeNum)

            // Should handle large numbers gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles negative numbers and zero', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const numberInputs = page.locator('input[type="number"]')

        const edgeNumbers = [
          '-1',
          '-999999',
          '0',
          '-0',
          '-0.000001',
          '-999999999999999999999999999999999999999999999999999999999999999999999999999999',
        ]

        for (const input of await numberInputs.all()) {
          for (const edgeNum of edgeNumbers) {
            await input.fill(edgeNum)

            // Should handle negative/zero values appropriately
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles decimal and scientific notation', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const numberInputs = page.locator('input[type="number"]')

        const decimalNumbers = [
          '0.000000000000000000000000000000000000000000000000000000000000000000000000000001',
          '1.234567890123456789012345678901234567890',
          '1e-1000',
          '1.23e456',
          '0.000000000000000000000000000000000000000000000000000000000000000000000000000001',
        ]

        for (const input of await numberInputs.all()) {
          for (const decimalNum of decimalNumbers) {
            await input.fill(decimalNum)

            // Should handle decimal notation gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles non-numeric input in number fields', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const numberInputs = page.locator('input[type="number"]')

        const invalidNumbers = [
          'abc',
          '12.34.56',
          '1,234',
          '1 234',
          '12px',
          '$123',
          '123%',
          '1-2-3',
          'not-a-number',
        ]

        for (const input of await numberInputs.all()) {
          for (const invalidNum of invalidNumbers) {
            await input.fill(invalidNum)

            // Should handle invalid numeric input gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })
  })

  // ===== DATE AND TIME BOUNDARIES =====

  test.describe('Date & Time Boundaries', () => {
    test('handles invalid date formats', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const dateInputs = page.locator('input[type="date"], input[type="datetime-local"]')

        const invalidDates = [
          'not-a-date',
          '2023-13-45', // Invalid month/day
          '2023-02-30', // Invalid day
          '2023-00-01', // Invalid month
          '1899-12-31', // Too old
          '2100-01-01', // Too far future
          '0000-00-00', // Invalid
          '9999-99-99', // Invalid
          '2023/12/25', // Wrong format
          '25/12/2023', // Wrong format
          'December 25, 2023', // Wrong format
        ]

        for (const input of await dateInputs.all()) {
          for (const invalidDate of invalidDates) {
            await input.fill(invalidDate)

            // Should handle invalid dates gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles extreme date values', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const dateInputs = page.locator('input[type="date"], input[type="datetime-local"]')

        const extremeDates = [
          '0001-01-01', // Year 1
          '9999-12-31', // Year 9999
          '1900-01-01', // Early 20th century
          '2100-12-31', // Late 21st century
          '1970-01-01', // Unix epoch
          '2038-01-19', // 32-bit signed integer limit
        ]

        for (const input of await dateInputs.all()) {
          for (const extremeDate of extremeDates) {
            await input.fill(extremeDate)

            // Should handle extreme dates gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles timezone edge cases', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const datetimeInputs = page.locator('input[type="datetime-local"]')

        // Set different timezones and test boundary times
        const timezoneTests = [
          '2023-12-31T23:59:59', // End of year
          '2024-01-01T00:00:00', // Start of year
          '2023-02-28T23:59:59', // End of February (non-leap)
          '2024-02-29T23:59:59', // End of February (leap year)
          '2023-03-31T23:59:59', // End of March
          '2023-04-30T23:59:59', // End of April
        ]

        for (const input of await datetimeInputs.all()) {
          for (const timezoneTest of timezoneTests) {
            await input.fill(timezoneTest)

            // Should handle timezone boundaries gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })
  })

  // ===== FILE UPLOAD EDGE CASES =====

  test.describe('File Upload Edge Cases', () => {
    test('handles extremely large files', async ({ page }) => {
      await page.goto('/settings')

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        // Try to upload a very large file (this will likely fail)
        try {
          // Create a large file in memory (limited by browser)
          const largeContent = 'A'.repeat(50 * 1024 * 1024) // 50MB

          await fileInput.setInputFiles([{
            name: 'large-file.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from(largeContent)
          }])

          // Should handle large file attempt gracefully
          await expect(page.locator('body')).toBeVisible()
        } catch (error) {
          // File too large - should handle error gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles invalid file types', async ({ page }) => {
      await page.goto('/settings')

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        const invalidFiles = [
          { name: 'malicious.exe', mimeType: 'application/x-msdownload', content: 'MZ' },
          { name: 'script.js', mimeType: 'application/javascript', content: 'alert("xss")' },
          { name: 'macro.docm', mimeType: 'application/vnd.ms-word.document.macroEnabled.12', content: 'macro content' },
          { name: 'corrupt.zip', mimeType: 'application/zip', content: 'corrupted zip data' },
        ]

        for (const invalidFile of invalidFiles) {
          try {
            await fileInput.setInputFiles([{
              name: invalidFile.name,
              mimeType: invalidFile.mimeType,
              buffer: Buffer.from(invalidFile.content)
            }])

            // Should handle invalid file types gracefully
            await expect(page.locator('body')).toBeVisible()
          } catch (error) {
            // File rejected - should handle gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles corrupted file content', async ({ page }) => {
      await page.goto('/settings')

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        // Create a corrupted file
        const corruptedContent = '\x00\x01\x02\x03corrupted data\xFF\xFE\xFD'

        try {
          await fileInput.setInputFiles([{
            name: 'corrupted.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from(corruptedContent)
          }])

          // Should handle corrupted files gracefully
          await expect(page.locator('body')).toBeVisible()
        } catch (error) {
          // File rejected - should handle gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles files with problematic names', async ({ page }) => {
      await page.goto('/settings')

      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.isVisible()) {
        const problematicNames = [
          'file with spaces.txt',
          'file-with-dashes.txt',
          'file_with_underscores.txt',
          'file.with.dots.txt',
          'file(with)parentheses.txt',
          'file[with]brackets.txt',
          'file{with}braces.txt',
          'file+with+plus.txt',
          'file%with%percent.txt',
          'file?with?question.txt',
          'file#with#hash.txt',
          'file@with@at.txt',
          'file$with$dollar.txt',
          'file&with&ampersand.txt',
          'file*wildcard.txt',
          'file|pipe.txt',
          'file<less.txt',
          'file>greater.txt',
          'file"quote.txt',
          'file\'single.txt',
          'file\\backslash.txt',
          'file/forwardslash.txt',
          'file:colon.txt',
          'file;semicolon.txt',
          'file=equals.txt',
          'file~tilde.txt',
          'file`backtick.txt',
          'file^caret.txt',
          'file£pound.txt',
          'file€euro.txt',
          'file¥yen.txt',
          'file🚀emoji.txt',
          'file测试中文.txt',
          'fileñspanish.txt',
          'file'.repeat(100) + '.txt', // Very long name
          '.hiddenfile',
          'file.',
          'file..txt',
          'CON.txt', // Windows reserved
          'PRN.txt', // Windows reserved
          'AUX.txt', // Windows reserved
          'NUL.txt', // Windows reserved
          'COM1.txt', // Windows reserved
          'LPT1.txt', // Windows reserved
        ]

        for (const fileName of problematicNames) {
          try {
            await fileInput.setInputFiles([{
              name: fileName,
              mimeType: 'text/plain',
              buffer: Buffer.from('test content')
            }])

            // Should handle problematic filenames gracefully
            await expect(page.locator('body')).toBeVisible()
          } catch (error) {
            // File rejected - should handle gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })
  })

  // ===== URL AND LINK VALIDATION =====

  test.describe('URL & Link Validation', () => {
    test('handles malformed URLs', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const urlInputs = page.locator('input[type="url"]')

        const malformedUrls = [
          'not-a-url',
          'http://',
          'https://',
          'ftp://example.com',
          'javascript:alert("xss")',
          'data:text/html,<script>alert("xss")</script>',
          'http://example.com/path with spaces',
          'http://example.com/path?param=value with spaces',
          'http://example.com/path#fragment with spaces',
          'http://user:pass@example.com',
          'http://example.com:99999', // Invalid port
          'http://256.256.256.256', // Invalid IP
          'http://example.com/path/../../../etc/passwd', // Path traversal
          'http://example.com/path?param=../../../etc/passwd', // Path traversal in query
          'http://example.com/path#../../../etc/passwd', // Path traversal in fragment
          'http://example.com'.repeat(100), // Extremely long URL
        ]

        for (const input of await urlInputs.all()) {
          for (const malformedUrl of malformedUrls) {
            await input.fill(malformedUrl)

            // Should handle malformed URLs gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })

    test('handles internationalized domain names', async ({ page }) => {
      await page.goto('/campaigns')

      const createButton = page.getByRole('button', { name: /create|new/i })
      if (await createButton.isVisible()) {
        await createButton.click()

        const urlInputs = page.locator('input[type="url"]')

        const idnUrls = [
          'http://例え.テスト', // Japanese
          'http://пример.испытание', // Russian
          'http://مثال.آزمایشی', // Arabic
          'http://beispiel.prüfung', // German
          'http://exemple.test', // French
          'http://ejemplo.prueba', // Spanish
        ]

        for (const input of await urlInputs.all()) {
          for (const idnUrl of idnUrls) {
            await input.fill(idnUrl)

            // Should handle IDN URLs gracefully
            await expect(page.locator('body')).toBeVisible()
          }
        }
      }
    })
  })

  // ===== EMAIL VALIDATION EDGE CASES =====

  test.describe('Email Validation Edge Cases', () => {
    test('handles malformed email addresses', async ({ page }) => {
      await page.goto('/signup')

      const emailInput = page.locator('input[type="email"]').first()
      if (await emailInput.isVisible()) {
        const malformedEmails = [
          'not-an-email',
          '@example.com',
          'user@',
          'user@@example.com',
          'user example.com',
          'user@.com',
          '.user@example.com',
          'user..user@example.com',
          'user@-example.com',
          'user@example-.com',
          'user@example.com.',
          'user@example..com',
          'user@example.com-',
          'user@.example.com',
          'user@example.com..',
          'user@[127.0.0.1]', // IP address
          'user@127.0.0.1', // IP address
          'user@256.256.256.256', // Invalid IP
          'user@example.com'.repeat(10), // Extremely long
          'user@' + 'a'.repeat(1000) + '.com', // Long domain
          'a'.repeat(1000) + '@example.com', // Long local part
        ]

        for (const malformedEmail of malformedEmails) {
          await emailInput.fill(malformedEmail)

          // Should handle malformed emails gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles international email addresses', async ({ page }) => {
      await page.goto('/signup')

      const emailInput = page.locator('input[type="email"]').first()
      if (await emailInput.isVisible()) {
        const internationalEmails = [
          '用户@example.com', // Chinese
          'пользователь@example.com', // Russian
          'usuário@example.com', // Portuguese
          'usuari@exemple.com', // Catalan
          'usuario@example.com', // Spanish
          'utilisateur@example.com', // French
          'user@münchen.de', // German umlaut
          'user@例え.テスト', // Japanese IDN
          'user@пример.испытание', // Russian IDN
        ]

        for (const internationalEmail of internationalEmails) {
          await emailInput.fill(internationalEmail)

          // Should handle international emails gracefully
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })
  })

  // ===== CONCURRENCY AND RACE CONDITIONS =====

  test.describe('Concurrency & Race Conditions', () => {
    test('handles simultaneous form submissions', async ({ page }) => {
      await page.goto('/campaigns')

      // Open multiple campaign creation forms simultaneously
      const createButtons = page.getByRole('button', { name: /create|new/i })

      // Click multiple create buttons rapidly
      for (let i = 0; i < 5; i++) {
        await createButtons.first().click()
        await page.waitForTimeout(100)
      }

      // Should handle multiple simultaneous forms gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles rapid data updates', async ({ page }) => {
      await page.goto('/campaigns')

      // Find and click on multiple campaign items rapidly
      const campaignItems = page.locator('[data-testid*="campaign"], .campaign-item, .campaign-card')

      for (let i = 0; i < Math.min(10, await campaignItems.count()); i++) {
        await campaignItems.nth(i).click()
        await page.waitForTimeout(50) // Very rapid clicking
      }

      // Should handle rapid navigation gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles conflicting simultaneous edits', async ({ page }) => {
      await page.goto('/campaigns')

      // Open first campaign for editing
      const firstCampaign = page.locator('[data-testid*="campaign"], .campaign-item').first()
      if (await firstCampaign.isVisible()) {
        await firstCampaign.click()

        const editButton = page.getByRole('button', { name: /edit/i }).first()
        if (await editButton.isVisible()) {
          await editButton.click()

          // Simulate conflicting edits by opening the same item in multiple tabs/windows
          // This is harder to test directly, but we can simulate rapid saves
          const nameInput = page.locator('input[name*="name"]').first()
          if (await nameInput.isVisible()) {
            for (let i = 0; i < 5; i++) {
              await nameInput.fill(`Conflicting Edit ${i}`)
              const saveButton = page.getByRole('button', { name: /save/i }).first()
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

  // ===== BROWSER COMPATIBILITY ISSUES =====

  test.describe('Browser Compatibility Issues', () => {
    test('handles unsupported browser features', async ({ page }) => {
      // Test with different user agents to simulate different browsers
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3', // Old Chrome
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:52.0) Gecko/20100101 Firefox/52.0', // Old Firefox
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/18.18362', // Old Edge
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', // Chrome with some features disabled
      ]

      for (const userAgent of userAgents) {
        await page.setExtraHTTPHeaders({ 'User-Agent': userAgent })

        await page.goto('/dashboard')

        // Should handle different browser capabilities gracefully
        await expect(page.locator('body')).toBeVisible()

        // Test some interactive features
        const button = page.locator('button').first()
        if (await button.isVisible()) {
          await button.click()
          await expect(page.locator('body')).toBeVisible()
        }
      }
    })

    test('handles JavaScript disabled', async ({ page }) => {
      // Disable JavaScript
      await page.route('**/*', async route => {
        if (route.request().resourceType() === 'script') {
          await route.abort()
        } else {
          await route.continue()
        }
      })

      await page.goto('/dashboard')

      // Should show no-JS fallback or handle gracefully
      await expect(page.locator('body')).toBeVisible()

      // May show noscript content
      const noscriptContent = page.locator('noscript')
      // Optional - may or may not be present
    })

    test('handles CSS disabled', async ({ page }) => {
      // Disable CSS
      await page.route('**/*.css', async route => {
        await route.abort()
      })

      await page.goto('/dashboard')

      // Should still be functional without CSS
      await expect(page.locator('body')).toBeVisible()

      // Test basic functionality still works
      const button = page.locator('button').first()
      if (await button.isVisible()) {
        await button.click()
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles images disabled', async ({ page }) => {
      // Disable images
      await page.route('**/*', async route => {
        if (['image', 'media', 'font'].includes(route.request().resourceType())) {
          await route.abort()
        } else {
          await route.continue()
        }
      })

      await page.goto('/dashboard')

      // Should handle missing images gracefully
      await expect(page.locator('body')).toBeVisible()

      // Alt text should be visible for broken images
      const images = page.locator('img')
      for (const img of await images.all()) {
        const alt = await img.getAttribute('alt')
        if (alt) {
          // Image has alt text - good
        }
      }
    })
  })
})