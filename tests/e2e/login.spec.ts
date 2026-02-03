import { test, expect } from '@playwright/test';

test('email login flow', async ({ page }) => {
  await page.goto('/signin');

  await page.fill('input[placeholder="Email"]', 'test@example.com');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('button:has-text("Sign in")');

  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('text=Dashboard')).toBeVisible();
});

test('signup flow', async ({ page }) => {
  await page.goto('/signup');

  await page.fill('input[placeholder="Email"]', 'new@example.com');
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.fill('input[placeholder="Name"]', 'New User');
  await page.click('button:has-text("Sign up")');

  await expect(page).toHaveURL(/.*dashboard/);
});