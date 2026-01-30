/**
 * Error Handling
 * Goal: Identify and fix a mistake in a function.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  login,
  addNode,
  runCalculation,
} from './utils/graph-utils';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'error_tester');
  });

  test('Runtime Error Visualization', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('ZeroDivNode');

    // Cleanup defaults
    await page
      .locator('.io-column:has-text("Inputs") li')
      .filter({ has: page.locator('input').filter({ hasValue: 'x' }) })
      .locator('button.danger')
      .click();
    await page
      .locator('.io-column:has-text("Outputs") li')
      .filter({ has: page.locator('input').filter({ hasValue: 'result' }) })
      .locator('button.danger')
      .click();

    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('out_val');
    await page.locator('#node-code').fill('out_val = 1 / 0');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'ZeroDivNode', -150, 0);

    // Add Output node
    await addNode(page, 'Output', 'surfaced_error');
    await moveNode(page, 'surfaced_error', 150, 0);

    // Connect
    await connectNodes(page, 'ZeroDivNode', 'out_val', 'surfaced_error', 'value');

    // Run
    await runCalculation(page);

    // Verify error tooltip
    const tooltip = page.locator('.node-error-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 10000 });
    await expect(tooltip).toContainText('division by zero');
  });
});