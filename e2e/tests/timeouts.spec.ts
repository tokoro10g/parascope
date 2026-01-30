/**
 * Safety and Limits (Timeouts)
 * Goal: Debug complex logic and handle infinite loops gracefully.
 */

import { test, expect } from '@playwright/test';
import {
  moveNode,
  zoomOut,
  login,
  runCalculation,
} from './utils/graph-utils';

test.describe('Safety & Limits', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'safety_user');
  });

  test('Execution Timeout Handling', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('InfiniteLoop');

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

    await page.locator('#node-code').fill('while True: pass\nout_val = 1');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'InfiniteLoop', 0, 0);

    await expect(page.locator('button:has-text("Run")')).toBeEnabled({
      timeout: 10000,
    });
    await runCalculation(page);

    const toast = page.getByRole('status').first();
    await expect(toast).toBeVisible({ timeout: 20000 });
    await expect(toast).toContainText('Execution Error');
    await expect(toast).toContainText('timed out');
  });
});
