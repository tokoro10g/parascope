/**
 * Table View & Data Export
 * Goal: Efficiently manage parameters and share results with spreadsheets.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  login,
  addNode,
  runCalculation,
  verifyResult,
  changeTableInput,
} from './utils/graph-utils';

test.describe('Table Productivity', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'table_user');
  });

  test('Table Editing and TSV Export', async ({ page }) => {
    // Mock clipboard API
    await page.evaluate(() => {
      (window as any).clipboardData = '';
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).clipboardData = text;
          },
        },
        configurable: true,
      });
    });

    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    await addNode(page, 'Input', 'factor');
    await moveNode(page, 'factor', -200, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('doubler');
    await page.locator('#node-code').fill('result = x * 2');
    await page.click('button:has-text("Apply")');
    await moveNode(page, 'doubler', 0, 0);

    await addNode(page, 'Output', 'total');
    await moveNode(page, 'total', 200, 0);

    await connectNodes(page, 'factor', 'value', 'doubler', 'x');
    await connectNodes(page, 'doubler', 'result', 'total', 'value');

    // Edit in table
    await changeTableInput(page, 'factor', '50');

    await runCalculation(page);
    await verifyResult(page, '100');

    // Export
    await page.click('button:has-text("Copy Table")');
    const clipboardText = await page.evaluate(
      () => (window as any).clipboardData,
    );
    expect(clipboardText).toContain('factor');
    expect(clipboardText).toContain('total');
    expect(clipboardText).toContain('( 50 )');
    expect(clipboardText).toContain('100');
  });
});
