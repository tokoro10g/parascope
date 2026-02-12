/**
 * Mobile Responsiveness
 * Goal: Ensure the application is functional and usable on small viewports.
 */

import { test, expect } from '@playwright/test';
import { login } from './utils/graph-utils';

// Use iPhone SE viewport
test.use({ viewport: { width: 375, height: 667 } });

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'mobile_user');
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
    await page.locator('#node-label').fill('MobileConst');
    await page.click('button:has-text("Apply")');

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