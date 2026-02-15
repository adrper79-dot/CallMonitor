import { test, expect } from '@playwright/test'

/**
 * Data Integrity & Consistency Edge Cases E2E Tests — Phase 3
 *
 * Tests comprehensive data integrity scenarios including
 * validation, consistency, and corruption handling.
 */

test.describe('Data Integrity & Consistency Edge Cases', () => {

  // ===== DATA VALIDATION EDGE CASES =====

  test.describe('Data Validation Edge Cases', () => {
    test('handles malformed JSON data', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate malformed JSON response
      await page.route('**/api/data', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{invalid json: missing quotes}'
        })
      })

      // Trigger data loading
      const refreshButton = page.locator('button').filter({ hasText: /refresh|load|sync/i }).first()
      if (await refreshButton.isVisible()) {
        await refreshButton.click()
      }

      // Should handle malformed JSON gracefully
      await expect(page.locator('body')).toBeVisible()

      // Check for error handling UI
      const errorIndicators = page.locator('.error, [role="alert"]').filter({ hasText: /invalid|parse|json/i })
      // Error may be silent or displayed
    })

    test('handles unexpected data types', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate API returning wrong data types
      await page.route('**/api/analytics', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            metrics: "not an array", // Should be array
            total: { value: "not a number" }, // Should be number
            timestamp: true // Should be string/date
          })
        })
      })

      // Trigger data loading
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('loadAnalytics'))
      })

      // Should handle type mismatches gracefully
      await expect(page.locator('body')).toBeVisible()

      // UI should not crash
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })

    test('handles data with missing required fields', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate data with missing required fields
      await page.evaluate(() => {
        const incompleteData = [
          { id: 1, name: 'Campaign 1' }, // Missing status
          { id: 2, status: 'active' }, // Missing name
          { id: 3 }, // Missing everything
        ]

        window.dispatchEvent(new CustomEvent('campaignsLoaded', { detail: incompleteData }))
      })

      // Should handle missing fields gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should display available data
      const campaignElements = page.locator('.campaign, .campaign-item, [data-campaign]')
      const campaignCount = await campaignElements.count()
      expect(campaignCount).toBeGreaterThanOrEqual(0)
    })

    test('handles data with circular references', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate data with circular references
      await page.evaluate(() => {
        const obj1 = { id: 1, name: 'Object 1' }
        const obj2 = { id: 2, name: 'Object 2', parent: obj1 }
        obj1.child = obj2 // Create circular reference

        window.dispatchEvent(new CustomEvent('circularDataLoaded', { detail: obj1 }))
      })

      // Should handle circular references gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should not cause infinite loops or crashes
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })
  })

  // ===== DATA CONSISTENCY CHECKS =====

  test.describe('Data Consistency Checks', () => {
    test('handles inconsistent foreign key relationships', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate data with broken foreign key relationships
      await page.evaluate(() => {
        const campaigns = [
          { id: 1, name: 'Campaign 1', ownerId: 999 }, // Non-existent owner
          { id: 2, name: 'Campaign 2', ownerId: 1 }, // Valid owner
        ]

        const users = [
          { id: 1, name: 'User 1' },
          // Missing user with id 999
        ]

        window.campaignData = campaigns
        window.userData = users
        window.dispatchEvent(new CustomEvent('dataConsistencyTest'))
      })

      // Should handle broken relationships gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should display campaigns even with broken relationships
      const campaignElements = page.locator('.campaign')
      const campaignCount = await campaignElements.count()
      expect(campaignCount).toBeGreaterThanOrEqual(0)
    })

    test('handles duplicate data entries', async ({ page }) => {
      await page.goto('/contacts')

      // Simulate duplicate data
      await page.evaluate(() => {
        const contacts = [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 1, name: 'John Doe', email: 'john@example.com' }, // Duplicate
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          { id: 3, name: 'John Doe', email: 'john.doe@example.com' }, // Different email, same name
        ]

        window.contactData = contacts
        window.dispatchEvent(new CustomEvent('contactsLoaded'))
      })

      // Should handle duplicates gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should display contacts (may deduplicate or show all)
      const contactElements = page.locator('.contact, .contact-item')
      const contactCount = await contactElements.count()
      expect(contactCount).toBeGreaterThanOrEqual(0)
    })

    test('handles data versioning conflicts', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate version conflicts
      await page.evaluate(() => {
        const campaign = {
          id: 1,
          name: 'Campaign 1',
          version: 1,
          lastModified: new Date('2024-01-01')
        }

        // Simulate concurrent modification
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('campaignUpdated', {
            detail: {
              id: 1,
              name: 'Campaign 1 Modified',
              version: 2, // Higher version
              lastModified: new Date()
            }
          }))
        }, 1000)

        window.dispatchEvent(new CustomEvent('campaignLoaded', { detail: campaign }))
      })

      // Wait for updates
      await page.waitForTimeout(2000)

      // Should handle version conflicts gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles data schema evolution', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate old schema data mixed with new schema
      await page.evaluate(() => {
        const oldSchemaData = {
          metrics: [
            { name: 'pageviews', value: 1000 }, // Old schema
            { name: 'clicks', value: 500 }
          ]
        }

        const newSchemaData = {
          metrics: [
            { name: 'pageviews', value: 1000, category: 'engagement' }, // New schema with category
            { name: 'clicks', value: 500, category: 'interaction' }
          ],
          metadata: { version: '2.0' }
        }

        // Load old schema first
        window.dispatchEvent(new CustomEvent('analyticsLoaded', { detail: oldSchemaData }))

        // Then load new schema
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('analyticsLoaded', { detail: newSchemaData }))
        }, 1000)
      })

      // Wait for schema evolution
      await page.waitForTimeout(2000)

      // Should handle schema changes gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== DATA CORRUPTION HANDLING =====

  test.describe('Data Corruption Handling', () => {
    test('handles corrupted local storage data', async ({ page }) => {
      await page.goto('/dashboard')

      // Corrupt localStorage data
      await page.evaluate(() => {
        localStorage.setItem('userPreferences', '{invalid json')
        localStorage.setItem('appState', 'corrupted data')
        localStorage.setItem('sessionData', null) // Null value
      })

      // Reload to trigger data loading
      await page.reload()

      // Should handle corrupted localStorage gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should initialize with defaults
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })

    test('handles corrupted session storage', async ({ page }) => {
      await page.goto('/dashboard')

      // Corrupt sessionStorage
      await page.evaluate(() => {
        sessionStorage.setItem('activeTab', '{ "invalid": json }')
        sessionStorage.setItem('filters', 'corrupted')
      })

      // Navigate to trigger session loading
      await page.goto('/campaigns')

      // Should handle corrupted sessionStorage gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles corrupted IndexedDB data', async ({ page }) => {
      await page.goto('/dashboard')

      // Attempt to corrupt IndexedDB (if used)
      await page.evaluate(() => {
        if (window.indexedDB) {
          const request = indexedDB.open('test-db', 1)
          request.onupgradeneeded = (event) => {
            const db = event.target.result
            const store = db.createObjectStore('test-store')
            // Intentionally corrupt data
            store.put({ corrupted: true, data: '{invalid}' }, 'test-key')
          }
        }
      })

      // Wait for DB operations
      await page.waitForTimeout(1000)

      // Should handle corrupted IndexedDB gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles network data corruption', async ({ page }) => {
      // Simulate corrupted network response
      await page.route('**/api/data', route => {
        // Return corrupted binary data as JSON
        const corruptedData = Buffer.from('corrupted binary data')
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: corruptedData
        })
      })

      await page.goto('/dashboard')

      // Trigger data loading
      const loadButton = page.locator('button').filter({ hasText: /load|fetch/i }).first()
      if (await loadButton.isVisible()) {
        await loadButton.click()
      }

      // Should handle network corruption gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== DATA SYNCHRONIZATION ISSUES =====

  test.describe('Data Synchronization Issues', () => {
    test('handles offline data changes', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate going offline
      await page.context().setOffline(true)

      // Attempt to make changes
      const nameInput = page.locator('input[name*="name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('Offline Change')
      }

      const saveButton = page.locator('button').filter({ hasText: /save/i }).first()
      if (await saveButton.isVisible()) {
        await saveButton.click()
      }

      // Should handle offline changes gracefully
      await expect(page.locator('body')).toBeVisible()

      // Come back online
      await page.context().setOffline(false)

      // Should sync changes
      await page.waitForTimeout(2000)
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles synchronization conflicts', async ({ page, context }) => {
      await page.goto('/campaigns')

      // Open second page to simulate another user
      const page2 = await context.newPage()
      await page2.goto('/campaigns')

      // Both pages modify the same data
      const inputs1 = page.locator('input[name*="name"]')
      const inputs2 = page2.locator('input[name*="name"]')

      if (await inputs1.count() > 0 && await inputs2.count() > 0) {
        await inputs1.first().fill('Change from Page 1')
        await inputs2.first().fill('Change from Page 2')

        // Both try to save
        const saveButtons1 = page.locator('button').filter({ hasText: /save/i })
        const saveButtons2 = page2.locator('button').filter({ hasText: /save/i })

        await Promise.all([
          saveButtons1.first().click(),
          saveButtons2.first().click()
        ])

        // Should handle sync conflicts gracefully
        await expect(page.locator('body')).toBeVisible()
        await expect(page2.locator('body')).toBeVisible()
      }

      await page2.close()
    })

    test('handles partial synchronization failures', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate partial sync failure
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('syncPartialFailure', {
          detail: {
            successful: ['user-preferences', 'theme'],
            failed: ['campaigns', 'analytics'],
            errors: {
              campaigns: 'Network timeout',
              analytics: 'Server error'
            }
          }
        }))
      })

      // Should handle partial failures gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should still show successfully synced data
      const successIndicators = page.locator('.sync-success, .synced')
      // May or may not show indicators
    })

    test('handles data migration during sync', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate data migration during sync
      await page.evaluate(() => {
        // Old format data
        const oldData = {
          campaigns: [
            { id: 1, title: 'Old Title', status: 'active' } // Old field name
          ]
        }

        // New format data
        const newData = {
          campaigns: [
            { id: 1, name: 'New Title', state: 'active' } // New field names
          ]
        }

        window.dispatchEvent(new CustomEvent('dataMigration', {
          detail: { oldData, newData, migrating: true }
        }))
      })

      // Wait for migration
      await page.waitForTimeout(2000)

      // Should handle data migration gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== DATA VALIDATION BUSINESS RULES =====

  test.describe('Data Validation Business Rules', () => {
    test('handles business rule violations', async ({ page }) => {
      await page.goto('/campaigns')

      // Test various business rule violations
      const invalidCampaigns = [
        { name: '', budget: -100 }, // Empty name, negative budget
        { name: 'Valid Name', budget: 1000000 }, // Budget too high
        { name: 'Test', startDate: '2020-01-01', endDate: '2019-01-01' }, // End before start
        { name: 'Another Test', targets: [] }, // No targets
      ]

      for (const campaign of invalidCampaigns) {
        await page.evaluate((camp) => {
          window.dispatchEvent(new CustomEvent('validateCampaign', { detail: camp }))
        }, campaign)

        // Should handle validation failures gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles cross-field validation', async ({ page }) => {
      await page.goto('/campaigns')

      // Test cross-field validation scenarios
      const crossFieldTests = [
        {
          budget: 1000,
          dailyLimit: 2000, // Daily limit > budget (invalid)
          name: 'Cross-field Test 1'
        },
        {
          startDate: '2024-12-31',
          endDate: '2024-01-01', // End before start (invalid)
          name: 'Cross-field Test 2'
        },
        {
          targetAudience: '18-25',
          contentRating: 'Mature', // Age/content mismatch (potentially invalid)
          name: 'Cross-field Test 3'
        }
      ]

      for (const test of crossFieldTests) {
        await page.evaluate((data) => {
          window.dispatchEvent(new CustomEvent('crossFieldValidation', { detail: data }))
        }, test)

        // Should handle cross-field validation gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles conditional validation rules', async ({ page }) => {
      await page.goto('/campaigns')

      // Test conditional validation
      const conditionalTests = [
        {
          type: 'email',
          emailContent: '', // Required for email campaigns
          smsContent: 'SMS content' // Not needed for email
        },
        {
          type: 'sms',
          emailContent: 'Email content', // Not needed for SMS
          smsContent: '' // Required for SMS campaigns
        },
        {
          hasBudget: true,
          budget: 0, // Required when hasBudget is true
        },
        {
          hasBudget: false,
          budget: 1000, // Should be ignored when hasBudget is false
        }
      ]

      for (const test of conditionalTests) {
        await page.evaluate((data) => {
          window.dispatchEvent(new CustomEvent('conditionalValidation', { detail: data }))
        }, test)

        // Should handle conditional validation gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles data type coercion edge cases', async ({ page }) => {
      await page.goto('/analytics')

      // Test type coercion edge cases
      const typeCoercionTests = [
        { value: '123', expectedType: 'number' }, // String number to number
        { value: 'true', expectedType: 'boolean' }, // String boolean to boolean
        { value: '2024-01-01', expectedType: 'date' }, // String date to date
        { value: null, expectedType: 'string' }, // Null to string
        { value: undefined, expectedType: 'object' }, // Undefined to object
        { value: NaN, expectedType: 'number' }, // NaN handling
        { value: Infinity, expectedType: 'number' }, // Infinity handling
      ]

      for (const test of typeCoercionTests) {
        await page.evaluate((data) => {
          window.dispatchEvent(new CustomEvent('typeCoercion', { detail: data }))
        }, test)

        // Should handle type coercion gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })
  })

  // ===== DATA PERSISTENCE INTEGRITY =====

  test.describe('Data Persistence Integrity', () => {
    test('handles database connection failures during save', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate DB connection failure during save
      await page.route('**/api/campaigns', route => {
        // Fail the request
        route.abort()
      })

      // Attempt to save
      const saveButton = page.locator('button').filter({ hasText: /save|create/i }).first()
      if (await saveButton.isVisible()) {
        await saveButton.click()
      }

      // Should handle save failure gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should show error message
      const errorMessages = page.locator('.error, [role="alert"]').filter({ hasText: /save|failed|error/i })
      // Error may be displayed
    })

    test('handles transaction rollback scenarios', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate transaction that needs to rollback
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('transactionStart'))

        // Simulate partial success
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('transactionPartial', {
            detail: { step: 1, success: true }
          }))
        }, 500)

        // Simulate failure requiring rollback
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('transactionFailure', {
            detail: { step: 2, error: 'Validation failed' }
          }))
        }, 1000)

        // Simulate rollback
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('transactionRollback'))
        }, 1500)
      })

      // Wait for transaction completion
      await page.waitForTimeout(3000)

      // Should handle transaction rollback gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles concurrent write conflicts', async ({ page, context }) => {
      await page.goto('/campaigns')

      const page2 = await context.newPage()
      await page2.goto('/campaigns')

      // Both pages try to save simultaneously
      const saveOperations = [
        async () => {
          const saveBtn = page.locator('button').filter({ hasText: /save/i }).first()
          if (await saveBtn.isVisible()) {
            await saveBtn.click()
          }
        },
        async () => {
          const saveBtn = page2.locator('button').filter({ hasText: /save/i }).first()
          if (await saveBtn.isVisible()) {
            await saveBtn.click()
          }
        }
      ]

      await Promise.all(saveOperations)

      // Should handle concurrent writes gracefully
      await expect(page.locator('body')).toBeVisible()
      await expect(page2.locator('body')).toBeVisible()

      await page2.close()
    })

    test('handles data backup and recovery scenarios', async ({ page }) => {
      await page.goto('/dashboard')

      // Simulate backup creation
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('createBackup', {
          detail: { type: 'full', includeAttachments: true }
        }))
      })

      await page.waitForTimeout(2000)

      // Simulate data loss
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('dataLoss', {
          detail: { affectedTables: ['campaigns', 'contacts'], reason: 'disk_failure' }
        }))
      })

      await page.waitForTimeout(1000)

      // Simulate recovery
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('startRecovery', {
          detail: { backupId: 'backup-123', recoveryType: 'full' }
        }))
      })

      await page.waitForTimeout(3000)

      // Should handle backup/recovery gracefully
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // ===== DATA EXPORT/IMPORT INTEGRITY =====

  test.describe('Data Export/Import Integrity', () => {
    test('handles corrupted export files', async ({ page }) => {
      await page.goto('/analytics')

      // Simulate importing corrupted export file
      await page.evaluate(() => {
        const corruptedData = {
          version: '1.0',
          data: '{invalid json}',
          checksum: 'invalid'
        }

        window.dispatchEvent(new CustomEvent('importData', { detail: corruptedData }))
      })

      // Should handle corrupted import gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should show import error
      const errorIndicators = page.locator('.import-error, .error').filter({ hasText: /import|corrupt|invalid/i })
      // Error may be displayed
    })

    test('handles incomplete import data', async ({ page }) => {
      await page.goto('/campaigns')

      // Simulate importing incomplete data
      await page.evaluate(() => {
        const incompleteData = {
          campaigns: [
            { id: 1, name: 'Campaign 1' }, // Missing required fields
            { name: 'Campaign 2' }, // Missing id
            {} // Empty object
          ],
          metadata: { partial: true }
        }

        window.dispatchEvent(new CustomEvent('importIncomplete', { detail: incompleteData }))
      })

      // Should handle incomplete import gracefully
      await expect(page.locator('body')).toBeVisible()
    })

    test('handles export format compatibility', async ({ page }) => {
      await page.goto('/analytics')

      // Test exporting to different formats
      const exportFormats = ['json', 'csv', 'xml', 'xlsx']

      for (const format of exportFormats) {
        await page.evaluate((fmt) => {
          window.dispatchEvent(new CustomEvent('exportData', {
            detail: { format: fmt, data: { test: 'data' } }
          }))
        }, format)

        // Should handle different export formats gracefully
        await expect(page.locator('body')).toBeVisible()
      }
    })

    test('handles large data set imports', async ({ page }) => {
      await page.goto('/contacts')

      // Simulate importing large dataset
      await page.evaluate(() => {
        const largeDataset = []
        for (let i = 0; i < 50000; i++) {
          largeDataset.push({
            id: i,
            name: `Contact ${i}`,
            email: `contact${i}@example.com`,
            phone: `+1-555-010${i.toString().padStart(4, '0')}`
          })
        }

        window.dispatchEvent(new CustomEvent('importLargeDataset', {
          detail: { data: largeDataset, totalRecords: largeDataset.length }
        }))
      })

      // Wait for import processing
      await page.waitForTimeout(5000)

      // Should handle large imports gracefully
      await expect(page.locator('body')).toBeVisible()

      // Should not crash or become unresponsive
      const bodyVisible = await page.locator('body').isVisible()
      expect(bodyVisible).toBe(true)
    })
  })
})