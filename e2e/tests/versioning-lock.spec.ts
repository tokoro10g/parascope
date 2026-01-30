/**
 * Versioning & Locking
 * Goal: Ensure that viewing a specific version URL is read-only and does not acquire a sheet lock.
 */

import { expect, test } from '@playwright/test';
import { createSheet, createVersion, login, saveSheet } from './utils/graph-utils';

test.describe('Versioning & Locking', () => {
  test('Opening a version does not lock the sheet', async ({ browser }) => {
    // 1. User A creates a sheet
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await login(pageA, 'User A');
    await createSheet(pageA, 'LockTest_Sheet');
    const sheetUrl = pageA.url();

    // Add a node so it's not empty (optional, but good for realism)
    await pageA.click('button:has-text("Add Node")');
    await pageA.click('.add-menu-item:has-text("Input")');
    await pageA.locator('#node-label').fill('Input A');
    await pageA.click('button:has-text("Save")'); // Modal save

    // Save Sheet before creating version
    await saveSheet(pageA);

    // Create Version v1
    const { id: versionId } = await createVersion(pageA, 'v1.0');

    // User A switches to viewing v1.0 (via URL)
    await pageA.goto(`${sheetUrl}?versionId=${versionId}`);
    
    // Verify Read-Only status (optional UI check)
    // The previous implementation logic.isReadOnly should be true.
    
    // 2. User B opens the Live sheet
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await login(pageB, 'User B');
    await pageB.goto(sheetUrl); // Live URL

    // User B should NOT see lock banner
    // If User A held the lock, this would be visible.
    await expect(pageB.locator('.lock-banner')).toBeHidden();
    
    // User B should be able to edit (e.g. Add Node)
    await pageB.click('button:has-text("Add Node")');
    await expect(pageB.locator('.add-menu-item').first()).toBeVisible();
    
    await contextA.close();
    await contextB.close();
  });
});