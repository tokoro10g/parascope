/**
 * Organizing Engineering Models (Folders)
 * Goal: Organize a growing collection of engineering models.
 */

import { test, expect } from '@playwright/test';
import {
  login,
  createFolder,
  createSheet,
  addNode,
  saveSheet,
} from './utils/graph-utils';

test.describe('Folders & Organization', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'organizer_user');
  });

  test('Folder and Sheet Lifecycle', async ({ page }) => {
    const folderName = `Folder_${Date.now()}`;
    await createFolder(page, folderName);

    const folderLocator = page.locator(
      `.explorer-item:has-text("${folderName}"), .sheet-item:has-text("${folderName}")`,
    );
    await folderLocator.click();

    // Create sheet inside folder
    const sheetName = `Sheet_${Date.now()}`;
    await createSheet(page, sheetName);

    // Add a node to make the sheet dirty and allow saving
    await addNode(page, 'Constant', 'trigger');
    await saveSheet(page);

    await page.goto('/');
    await folderLocator.click();
    await expect(
      page.locator(`.explorer-item:has-text("${sheetName}")`),
    ).toBeVisible();
  });
});
