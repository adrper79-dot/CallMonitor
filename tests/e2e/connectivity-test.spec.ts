import { test, expect } from '@playwright/test'

test('basic connectivity test', async ({ page }) => {
  await page.goto('/')
  console.log('Page title:', await page.title())
  console.log('URL:', page.url())
  expect(await page.title()).toBeTruthy()
})