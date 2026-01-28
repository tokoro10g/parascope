import { test, expect } from '@playwright/test';
import { humanDelay } from './utils/graph-utils';

test.describe('Sheet Versioning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('version_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Create and Restore Version', async ({ page }) => {
    // 1. Create Sheet
    await page.click('button:has-text("Create New Sheet")');
    await page.waitForURL('**/sheet/**');

    // 2. Add "V1 Node" and Save
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('V1 Node');
    await page.click('button:has-text("Save")');
    
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();

    // 3. Create Version "v1.0"
    await page.click('button[title="Sheet Actions"]');
    await page.click('button:has-text("Version Control")');
    await expect(page.locator('.modal-content h2')).toHaveText('Version Control');
    
    await page.locator('input[placeholder="Tag (e.g. v1.0)"]').fill('v1.0');
    await page.locator('textarea[placeholder="Description (optional)"]').fill('Initial version');
    await page.click('button:has-text("Create")'); // "Create" button next to input
    
    // Verify it appears in the list
    await expect(page.locator('.version-list')).toContainText('v1.0');
    await page.click('button.modal-close-btn'); // Close modal
    await humanDelay(page);

    // 4. Modify Sheet (Add "V2 Node") and Save
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('V2 Node');
    await page.click('button:has-text("Save")');
    
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();
    
    // Verify both nodes exist
    await expect(page.locator('[data-testid="node"] .title:has-text("V1 Node")')).toBeVisible();
    await expect(page.locator('[data-testid="node"] .title:has-text("V2 Node")')).toBeVisible();

    // 5. Restore v1.0
    await page.click('button[title="Sheet Actions"]');
    await page.click('button:has-text("Version Control")');
    
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('restore version "v1.0"');
      await dialog.accept();
    });
    
    
    // Find the restore button for v1.0
    // The list is ordered new to old? Or old to new?
    // We only have one version + Live.
    await page.locator('.version-list').getByText('v1.0').first().click(); // Just to focus? No.
    // The Restore button is inside the version item.
    // Use locator chaining.
    const v1Item = page.locator('.version-list > div').filter({ hasText: 'v1.0' });
    await v1Item.getByRole('button', { name: 'Restore' }).click();

    // 6. Verify State (V2 Node gone)
    // Restore triggers a reload or re-fetch.
    await expect(page.locator('[data-testid="node"] .title:has-text("V2 Node")')).toBeHidden();
    await expect(page.locator('[data-testid="node"] .title:has-text("V1 Node")')).toBeVisible();
  });
});
