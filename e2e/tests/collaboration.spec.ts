import { test, expect } from '@playwright/test';

test.describe('Collaboration & Locking', () => {
  test('Two users interacting with the same sheet', async ({ browser }) => {
    // 1. User A creates a sheet
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    
    await pageA.goto('/login');
    await pageA.locator('input[placeholder="Your Name"]').fill('User A');
    await pageA.click('button:has-text("Continue")');
    await pageA.waitForURL('**/');
    
    await pageA.click('button:has-text("Create New Sheet")');
    await pageA.waitForURL('**/sheet/**');
    const sheetUrl = pageA.url();

    // 2. User B opens the same sheet
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    await pageB.goto('/login');
    await pageB.locator('input[placeholder="Your Name"]').fill('User B');
    await pageB.click('button:has-text("Continue")');
    
    await pageB.goto(sheetUrl);
    
    // User B should see lock banner
    await expect(pageB.locator('.lock-banner')).toContainText('Currently being edited by User A');
    await expect(pageB.getByRole('button', { name: 'Take Over' })).toBeVisible();
    
    // User A adds a node (to prove they can)
    await pageA.click('button:has-text("Add Node")');
    await pageA.click('.add-menu-item:has-text("Constant")');
    await pageA.click('button:has-text("Save")');
    
    // 3. User B takes over
    await pageB.getByRole('button', { name: 'Take Over' }).click();
    await pageB.click('button:has-text("Confirm Take Over")');
    
    // User B should verify lock banner is gone (or shows success/owned)
    await expect(pageB.locator('.lock-banner')).toBeHidden();
    
    // User B makes a change
    await pageB.click('button:has-text("Add Node")');
    await pageB.click('.add-menu-item:has-text("Comment")'); // Different node
    
    // User A checks lock status (wait for polling)
    // Polling interval is 10s. We wait up to 15s.
    await expect(pageA.locator('.lock-banner')).toContainText('Currently being edited by User B', { timeout: 15000 });
    
    await contextA.close();
    await contextB.close();
  });
});
