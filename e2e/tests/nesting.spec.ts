/**
 * Nesting Sheets (Sub-graphs)
 * Goal: Reuse a specific calculation component within a larger system.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  login,
  createSheet,
  addNode,
  saveSheet,
  importSheet,
  runCalculation,
} from './utils/graph-utils';

test.describe('Nesting Sheets', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'nesting_user');
  });

  test('Parent-Child Calculation Flow', async ({ page }) => {
    // 1. Create Cylinder Volume sub-sheet
    const subSheetName = `SubSheet_${Date.now()}`;
    await createSheet(page, subSheetName);
    await zoomOut(page, 4);

    // Add Input 'radius'
    await addNode(page, 'Input', 'radius');
    await moveNode(page, 'radius', -250, -150);

    // Add Output 'volume'
    await addNode(page, 'Output', 'volume');
    await moveNode(page, 'volume', 250, 150);

    // Connect radius -> volume
    await connectNodes(page, 'radius', 'value', 'volume', 'value');

    // Save and wait
    await saveSheet(page);

    // 2. Create Parent sheet
    await page.goto('/');
    const parentName = `ParentSheet_${Date.now()}`;
    await createSheet(page, parentName);
    await zoomOut(page, 4);

    // Import SubSheet
    await importSheet(page, subSheetName);
    await page.waitForTimeout(1000);

    // Close auto-opened inspector
    await page.click('button:has-text("Cancel")');

    await moveNode(page, subSheetName, 0, 0);

    // Add Constant 'r_in'
    await addNode(page, 'Constant', 'r_in', '42');
    await moveNode(page, 'r_in', -300, -150);

    // Add Output 'result'
    await addNode(page, 'Output', 'result');
    await moveNode(page, 'result', 300, 150);

    // Connect r_in -> SubSheet(radius) -> result
    await connectNodes(page, 'r_in', 'value', subSheetName, 'radius');
    await connectNodes(page, subSheetName, 'volume', 'result', 'value');

    // Run
    await runCalculation(page);
    await page.waitForTimeout(3000);

    // Verify result in table
    const table = page.locator('.sheet-table');
    await expect(table.locator('text=42')).toBeVisible();
  });
});
