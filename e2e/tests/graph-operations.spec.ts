/**
 * Graph Operations Verification
 * Goal: Verify utility functions like deleteNode and renamePort.
 */

import { test, expect } from '@playwright/test';
import { zoomOut, moveNode, deleteNode, renamePort } from './utils/graph-utils';

test.describe('Graph Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('ops_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Delete Node and Rename Port', async ({ page }) => {
    const timestamp = Date.now();
    const sheetName = `OpsSheet_${timestamp}`;

    // Create Sheet
    await page.click('button:has-text("Create New Sheet")');
    await page.locator('.sheet-name-input').fill(sheetName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await zoomOut(page, 2);

    // Add Function Node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: function');
    await page.locator('#node-label').fill('TestFunc');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Rename Input Port
    await renamePort(page, 'TestFunc', 'x', 'my_input', 'input');
    
    // Rename Output Port
    await renamePort(page, 'TestFunc', 'result', 'my_output', 'output');

    // Delete Node
    await deleteNode(page, 'TestFunc');
  });
});
