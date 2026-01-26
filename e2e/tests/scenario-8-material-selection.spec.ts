/**
 * Scenario 8: Material Selection (Option Node)
 * Goal: Use categorical logic to switch between material properties.
 * 
 * This test verifies:
 * 1. Creating a Constant node and changing its type to "Option (Enum)".
 * 2. Defining custom options (e.g., Steel, Aluminum).
 * 3. Wiring an Option node to a Function node using string-based logic.
 * 4. Changing the selection in the results table and seeing the calculation update.
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Scenario 8: Material Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('material_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
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
    await page.click('button:has-text("Save")');
    await moveNode(page, 'material', -250, 0);

    // 2. Create Density Function
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('GetDensity');
    
    await page.locator('.io-column:has-text("Inputs") li').filter({ has: page.locator('input').filter({ hasValue: 'x' }) }).locator('button.danger').click();
    await page.locator('.io-column:has-text("Outputs") li').filter({ has: page.locator('input').filter({ hasValue: 'result' }) }).locator('button.danger').click();
    
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('mat');
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('rho');
    
    await page.locator('#node-code').fill('rho = 7850 if mat == "Steel" else 2700');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'GetDensity', 0, 0);

    // 3. Create Output
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('density_out');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'density_out', 250, 0);

    // 4. Connect and Run
    await connectNodes(page, 'material', 'value', 'GetDensity', 'mat');
    await connectNodes(page, 'GetDensity', 'rho', 'density_out', 'value');
    
    await page.click('button:has-text("Run")');
    await expect(page.locator('.sheet-table-cell-value:has-text("7850")')).toBeVisible({ timeout: 5000 });

    // 5. Change to Aluminum
    const table = page.locator('.sheet-table');
    await table.locator('select.sheet-table-input').selectOption('Aluminum');
    await page.click('button:has-text("Run")');
    await expect(page.locator('.sheet-table-cell-value:has-text("2700")')).toBeVisible({ timeout: 5000 });
  });
});
