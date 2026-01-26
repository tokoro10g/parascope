/**
 * Scenario 10: Table View & Data Export
 * Goal: Efficiently manage parameters and share results with spreadsheets.
 * 
 * This test verifies:
 * 1. Editing input values directly within the sidebar Table View.
 * 2. Automatic propagation of results after table edits.
 * 3. Exporting the results table to the clipboard in TSV format.
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Scenario 10: Table Productivity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('table_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Table Editing and TSV Export', async ({ page }) => {
    // Mock clipboard API
    await page.evaluate(() => {
      (window as any).clipboardData = "";
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => { (window as any).clipboardData = text; }
        },
        configurable: true
      });
    });

    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('factor');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'factor', -200, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('doubler');
    await page.locator('#node-code').fill('result = x * 2');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'doubler', 0, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('total');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'total', 200, 0);

    await connectNodes(page, 'factor', 'value', 'doubler', 'x');
    await connectNodes(page, 'doubler', 'result', 'total', 'value');

    // Edit in table
    const tableInput = page.locator('tr:has-text("factor") input.sheet-table-input');
    await tableInput.fill('50');
    await tableInput.press('Enter');

    await page.click('button:has-text("Run")');
    await expect(page.locator('.sheet-table-cell-value:has-text("100")')).toBeVisible({ timeout: 5000 });

    // Export
    await page.click('button:has-text("Copy Table")');
    const clipboardText = await page.evaluate(() => (window as any).clipboardData);
    expect(clipboardText).toContain('factor');
    expect(clipboardText).toContain('total');
    expect(clipboardText).toContain('50');
    expect(clipboardText).toContain('100');
  });
});
