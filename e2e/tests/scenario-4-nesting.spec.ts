/**
 * Scenario 4: Nesting Sheets (Sub-graphs)
 * Goal: Reuse a specific calculation component within a larger system.
 * 
 * This test verifies:
 * 1. Creation and saving of a sub-sheet.
 * 2. Importing the sub-sheet into a parent sheet.
 * 3. Wiring parent nodes to nested sheet inputs.
 * 4. Propagation of results from child to parent outputs.
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Scenario 4: Nesting Sheets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('nesting_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Parent-Child Calculation Flow', async ({ page }) => {
    // 1. Create Cylinder Volume sub-sheet
    await page.click('button:has-text("Create New Sheet")');
    const subSheetName = `SubSheet_${Date.now()}`;
    const nameInput = page.locator('input[placeholder="Sheet Name"]');
    await nameInput.click();
    await nameInput.fill(subSheetName);
    await nameInput.press('Enter');
    await zoomOut(page, 4);

    // Add Input 'radius'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('radius');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'radius', -250, -150);

    // Add Output 'volume'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('volume');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'volume', 250, 150);

    // Connect radius -> volume
    await connectNodes(page, 'radius', 'value', 'volume', 'value');

    // Save and wait
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();

    // 2. Create Parent sheet
    await page.goto('/');
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    const parentName = `ParentSheet_${Date.now()}`;
    const pNameInput = page.locator('input[placeholder="Sheet Name"]');
    await pNameInput.click();
    await pNameInput.fill(parentName);
    await pNameInput.press('Enter');
    
    // Import SubSheet
    await page.click('button:has-text("Import Sheet")');
    await page.waitForTimeout(1000);
    await page.click(`.explorer-item:has-text("${subSheetName}")`);
    await page.waitForTimeout(1000);
    await moveNode(page, subSheetName, 0, 0);

    // Add Constant 'r_in'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('r_in');
    await page.locator('#node-value').fill('42');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'r_in', -300, -150);

    // Add Output 'result'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('result');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'result', 300, 150);

    // Connect r_in -> SubSheet(radius) -> result
    await connectNodes(page, 'r_in', 'value', subSheetName, 'radius');
    await connectNodes(page, subSheetName, 'volume', 'result', 'value');

    // Run
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(3000);

    // Verify result in table
    const table = page.locator('.sheet-table');
    await expect(table.locator('text=42')).toBeVisible(); 
  });
});
