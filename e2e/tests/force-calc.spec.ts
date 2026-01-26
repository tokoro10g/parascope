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
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Force Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('scenario_1_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Basic Calculation Flow', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    // 1. Create 'mass' Constant
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('mass');
    await page.locator('#node-value').fill('10');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'mass', -250, -100);

    // 2. Create 'accel' Constant
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('accel');
    await page.locator('#node-value').fill('9.8');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'accel', -250, 100);

    // 3. Create 'Force Function'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('ForceCalc');
    
    // Remove defaults (x and result)
    await page.locator('.io-column:has-text("Inputs") li').filter({ has: page.locator('input').filter({ hasValue: 'x' }) }).locator('button.danger').click();
    await page.locator('.io-column:has-text("Outputs") li').filter({ has: page.locator('input').filter({ hasValue: 'result' }) }).locator('button.danger').click();

    // Add mass input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('mass');
    // Add accel input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('accel');
    // Add force output
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('force');
    
    await page.locator('#node-code').fill('force = mass * accel');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'ForceCalc', 0, 0);

    // 4. Create Output Node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('FinalForce');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'FinalForce', 250, 0);

    // 5. Connect nodes
    await connectNodes(page, 'mass', 'value', 'ForceCalc', 'mass');
    await connectNodes(page, 'accel', 'value', 'ForceCalc', 'accel');
    await connectNodes(page, 'ForceCalc', 'force', 'FinalForce', 'value');

    // 6. Run and Check Table results
    await page.click('button:has-text("Run")');
    const resultCell = page.locator('.sheet-table-cell-value:has-text("98")');
    await expect(resultCell).toBeVisible({ timeout: 5000 });
  });
});
