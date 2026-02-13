/**
 * URL Overrides & Drill-down Editing
 * Goal: Share specific calculation cases and debug nested logic in context.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  login,
  addNode,
  saveSheet,
  createSheet,
  importSheet,
  runCalculation,
} from './utils/graph-utils';

test.describe('Drill-down & Overrides', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'override_user');
  });

  test('URL Parameter Overrides', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await addNode(page, 'Input', 'shared_input');
    await moveNode(page, 'shared_input', -150, 0);

    await addNode(page, 'Output', 'shared_output');
    await moveNode(page, 'shared_output', 150, 0);

    await connectNodes(page, 'shared_input', 'value', 'shared_output', 'value');
    await saveSheet(page);

    const sheetUrl = page.url();
    await page.goto(`${sheetUrl}?shared_input=123`);

    const resultCell = page.locator('.sheet-table-cell-value:has-text("123")');
    await expect(resultCell).toBeVisible({ timeout: 10000 });
  });

  test('Context Menu Drill-down', async ({ page }) => {
    const subName = `Sub_${Date.now()}`;
    await createSheet(page, subName);
    await zoomOut(page, 4);

    await addNode(page, 'Input', 'sub_input');
    await saveSheet(page);

    await page.goto('/');
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await importSheet(page, subName);

    // Close auto-opened inspector
    await page.click('button:has-text("Cancel")');

    await moveNode(page, subName, 0, 0);

    await addNode(page, 'Constant', 'driver', '999');
    await moveNode(page, 'driver', -250, 0);

    await connectNodes(page, 'driver', 'value', subName, 'sub_input');
    await runCalculation(page);
    await page.waitForTimeout(2000);

    const subNode = page.locator(`.node-sheet:has-text("${subName}")`);
    await subNode.click({ button: 'right' });

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('text=Open in New Tab'),
    ]);
    await popup.waitForLoadState();

    await expect(popup).toHaveURL(/.*sub_input=999/);
    const tableInput = popup.locator(
      'tr:has-text("sub_input") input.sheet-table-input',
    );
    await expect(tableInput).toHaveValue('( 999 )', { timeout: 10000 });
  });
});