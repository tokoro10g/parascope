import { test, expect } from '@playwright/test';

test('simple login test', async ({ page }) => {
  // 1. Go to the app
  await page.goto('/');

  // 2. Should see the login page if not logged in
  // Check for the existence of the username input
  const usernameInput = page.locator('input[placeholder="Your Name"]');
  await expect(usernameInput).toBeVisible();

  // 3. Perform login
  await usernameInput.fill('e2e_tester');
  await page.click('button:has-text("Continue")');

  // 4. Should redirect to dashboard (root URL)
  await page.waitForURL('**/');
  
  // 5. Verify we see some dashboard content
  await expect(page.locator('button:has-text("Create New Sheet")')).toBeVisible();
});