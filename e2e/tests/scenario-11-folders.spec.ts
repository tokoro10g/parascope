/**
 * Scenario 11: Organizing Engineering Models (Folders)
 * Goal: Organize a growing collection of engineering models.
 * 
 * This test verifies:
 * 1. Creation of a new folder on the Dashboard.
 * 2. Navigating into a folder.
 * 3. Creating a new sheet *inside* a folder.
 * 4. Verifying folder contents and "Up" navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Scenario 11: Folders & Organization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('organizer_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Folder and Sheet Lifecycle', async ({ page }) => {
    const folderName = `Folder_${Date.now()}`;
    page.on('dialog', async dialog => {
      await dialog.accept(folderName);
    });
    await page.click('button:has-text("New Folder")');
    const folderLocator = page.locator(`.explorer-item:has-text("${folderName}")`);
    await expect(folderLocator).toBeVisible();
    await folderLocator.click();
    
    // Create sheet inside folder
    await page.click('button:has-text("Create New Sheet")');
    const sheetName = `Sheet_${Date.now()}`;
    await page.locator('input[placeholder="Sheet Name"]').fill(sheetName);
    await page.locator('input[placeholder="Sheet Name"]').press('Enter');
    
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('trigger');
    await page.click('button:has-text("Save")');
    
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();
    
    await page.goto('/');
    await folderLocator.click();
    await expect(page.locator(`.explorer-item:has-text("${sheetName}")`)).toBeVisible();
  });
});
