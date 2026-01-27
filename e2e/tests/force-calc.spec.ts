/**
 * Force Calculator
 * Goal: Create a simple physics calculation and save it.
 * 
 * This test verifies the core "Happy Path":
 * 1. User logs in.
 * 2. Creates a new sheet.
 * 3. Adds Constant nodes (mass, accel).
 * 4. Adds a Function node (ForceCalc) with custom Python code.
 * 5. Connects nodes and runs calculation.
 * 6. Verifies the result (98.0) appears in the results table.
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut, humanDelay } from './utils/graph-utils';

test.describe('Force Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('scenario_1_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Basic Calculation Flow', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await page.waitForURL('**/sheet/**');
    await zoomOut(page, 4);
    await humanDelay(page);

    // 1. Create 'Mass [kg]' Constant
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('Mass [kg]');
    await page.locator('#node-value').fill('10');
    await humanDelay(page, 500);
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Mass [kg]', -250, -100);
    await humanDelay(page);

    // 2. Create 'Acceleration [m/s2]' Constant
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('Acceleration [m/s2]');
    await page.locator('#node-value').fill('9.8');
    await humanDelay(page, 500);
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Acceleration [m/s2]', -250, 100);
    await humanDelay(page);

    // 3. Create 'Force Function'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('Force Calculation');
    
    // Remove defaults (x and result)
    await page.locator('.io-column:has-text("Inputs") li').filter({ has: page.locator('input').filter({ hasValue: 'x' }) }).locator('button.danger').click();
    await page.locator('.io-column:has-text("Outputs") li').filter({ has: page.locator('input').filter({ hasValue: 'result' }) }).locator('button.danger').click();

    // Add mass_kg input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('mass_kg');
    // Add accel_ms2 input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('accel_ms2');
    // Add force_n output
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('force_n');
    
    await page.locator('#node-code').fill('force_n = mass_kg * accel_ms2');
    await humanDelay(page, 500);
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Force Calculation', 0, 0);
    await humanDelay(page);

    // 4. Create Output Node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('Final Force [N]');
    await humanDelay(page, 500);
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Final Force [N]', 250, 0);
    await humanDelay(page);

    // 5. Connect nodes
    await connectNodes(page, 'Mass [kg]', 'value', 'Force Calculation', 'mass_kg');
    await connectNodes(page, 'Acceleration [m/s2]', 'value', 'Force Calculation', 'accel_ms2');
    await connectNodes(page, 'Force Calculation', 'force_n', 'Final Force [N]', 'value');
    await humanDelay(page);

    // 6. Run and Check Table results
    await page.click('button:has-text("Run")');
    await humanDelay(page);
    const resultCell = page.locator('.sheet-table-cell-value:has-text("98")');
    await expect(resultCell).toBeVisible({ timeout: 5000 });
    await humanDelay(page, 2000); // Hold final result for a bit in video
  });
});
