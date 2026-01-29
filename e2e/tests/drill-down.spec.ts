/**
 * URL Overrides & Drill-down Editing
 * Goal: Share specific calculation cases and debug nested logic in context.
 * 
 * This test verifies:
 * 1. Injecting input overrides via URL query parameters (?param=value).
 * 2. Automatic recalculation triggered by URL overrides.
 * 3. Navigating from a parent node to a sub-sheet with parent values injected (Drill-down).
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Drill-down & Overrides', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('override_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('URL Parameter Overrides', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('shared_input');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'shared_input', -150, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('shared_output');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'shared_output', 150, 0);

    await connectNodes(page, 'shared_input', 'value', 'shared_output', 'value');
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();
    
    const sheetUrl = page.url();
    await page.goto(`${sheetUrl}?shared_input=123`);
    
    const resultCell = page.locator('.sheet-table-cell-value:has-text("123")');
    await expect(resultCell).toBeVisible({ timeout: 10000 });
  });

  test('Context Menu Drill-down', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    const subName = `Sub_${Date.now()}`;
    const nameInput = page.locator('input[class="sheet-name-input"]');
    await nameInput.fill(subName);
    await nameInput.press('Enter');
    await expect(nameInput).toHaveValue(subName);
    await zoomOut(page, 4);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('sub_input');
    await page.click('button:has-text("Save")');
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();

    await page.goto('/');
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await page.click('button:has-text("Import Sheet")');
    // Wait for the sub-sheet to appear in the picker
    const subSheetItem = page.locator('.explorer-item', { hasText: subName });
    await expect(subSheetItem).toBeVisible({ timeout: 10000 });
    await subSheetItem.click();

    // Close auto-opened inspector
    await page.click('button:has-text("Cancel")');

    await moveNode(page, subName, 0, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('driver');
    await page.locator('#node-value').fill('999');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'driver', -250, 0);

    await connectNodes(page, 'driver', 'value', subName, 'sub_input');
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(2000);

    const subNode = page.locator(`.node-sheet:has-text("${subName}")`);
    await subNode.click({ button: 'right' });
    
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('text=Open in New Tab')
    ]);
    await popup.waitForLoadState();

    await expect(popup).toHaveURL(/.*sub_input=999/);
    const tableInput = popup.locator('tr:has-text("sub_input") input.sheet-table-input');
    await expect(tableInput).toHaveValue('999', { timeout: 10000 });
  });
});
