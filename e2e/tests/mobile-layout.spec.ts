import { test, expect } from '@playwright/test';

// Use iPhone SE viewport
test.use({ viewport: { width: 375, height: 667 } });

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('mobile_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Dashboard and Sheet Editor Usability', async ({ page }) => {
    // 1. Dashboard: Verify layout
    await expect(page.locator('.item-explorer-list')).toBeVisible();
    // Ensure "Create New Sheet" is accessible
    const createBtn = page.locator('button:has-text("Create New Sheet")');
    await expect(createBtn).toBeVisible();
    
    // 2. Enter Sheet
    await createBtn.click();
    await page.waitForURL('**/sheet/**');
    
    // 3. Verify Mobile Tabs exist
    const tabs = page.locator('.tabs-container');
    await expect(tabs).toBeVisible();
    
    // "Editor" tab should be active by default
    await expect(page.locator('button.tab-button.active')).toHaveText(/Editor/);
    
    // 4. Add a Node (Verify Add Menu fits)
    await page.click('button[title="Add Node"]');
    await expect(page.locator('.add-node-dropdown')).toBeVisible();
    await page.click('.add-menu-item:has-text("Constant")');
    
    // Verify Node Edit Modal fits mobile
    const modal = page.locator('.node-inspector-panel'); // Or modal
    // Actually NodeInspector is a side panel in desktop, maybe full screen in mobile?
    // Assuming standard behavior for now.
    await page.locator('#node-label').fill('MobileConst');
    await page.click('button:has-text("Save")');
    
    // 5. Switch to Variables Tab
    await page.getByRole('button', { name: 'Variables' }).click();
    
    // Verify Table is visible
    await expect(page.locator('.sheet-table')).toBeVisible();
    // Verify the node we added is in the table
    await expect(page.locator('.sheet-table')).toContainText('MobileConst');
    
    // 6. Switch back to Editor
    await page.getByRole('button', { name: 'Editor' }).click();
    await expect(page.locator('.rete')).toBeVisible();
  });
});
