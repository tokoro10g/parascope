/**
 * Material Selection (Option Node)
 * Goal: Use categorical logic to switch between material properties.
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

test.describe('Material Selection', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'material_user');
  });

  test('Option Node Interaction', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    // 1. Create 'material' Option Node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('material');
    await page.selectOption('#node-type', 'option');

    await page.click('button:has-text("+ Add Option")');
    await page.locator('div.form-group li input').nth(0).fill('Steel');
    await page.click('button:has-text("+ Add Option")');
    await page.locator('div.form-group li input').nth(1).fill('Aluminum');

    await page.selectOption('#node-value', 'Steel');
    await page.click('button:has-text("Apply")');
    await moveNode(page, 'material', -250, 0);

    // 2. Create Density Function
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('GetDensity');

    // Remove defaults (x and result)
    await page
      .locator('.io-column:has-text("Inputs") li')
      .locator('button.danger')
      .click();
    await page
      .locator('.io-column:has-text("Outputs") li')
      .locator('button.danger')
      .click();

    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('mat');
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('rho');

    await page.locator('#node-code').fill('rho = 7850 if mat == "Steel" else 2700');
    await page.click('button:has-text("Apply")');
    await moveNode(page, 'GetDensity', 0, 0);

    // 3. Create Output
    await addNode(page, 'Output', 'density_out');
    await moveNode(page, 'density_out', 250, 0);

    // 4. Connect and Run
    await connectNodes(page, 'material', 'value', 'GetDensity', 'mat');
    await connectNodes(page, 'GetDensity', 'rho', 'density_out', 'value');

    await runCalculation(page);
    await verifyResult(page, '7850');

    // 5. Change to Aluminum
    await changeTableInput(page, 'material', 'Aluminum');
    await runCalculation(page);
    await verifyResult(page, '2700');
  });
});
