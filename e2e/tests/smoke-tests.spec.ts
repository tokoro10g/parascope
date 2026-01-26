import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Parascope Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Perform login before each test
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('smoke_tester');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Folder and Sheet Organization', async ({ page }) => {
    const folderName = `Folder_${Date.now()}`;
    page.on('dialog', async dialog => {
      await dialog.accept(folderName);
    });
    await page.click('button:has-text("New Folder")');
    const folderLocator = page.locator(`.explorer-item:has-text("${folderName}")`);
    await expect(folderLocator).toBeVisible();
    await folderLocator.click();
    await page.click('button:has-text("Create New Sheet")');
    const sheetName = `Sheet_${Date.now()}`;
    const nameInput = page.locator('input[placeholder="Sheet Name"]');
    await nameInput.click();
    await nameInput.fill(sheetName);
    await nameInput.press('Enter');
    
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('trigger');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('.unsaved-indicator-badge')).toBeVisible();
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();
    await page.goto('/');
    await folderLocator.click();
    await expect(page.locator(`.explorer-item:has-text("${sheetName}")`)).toBeVisible();
  });

  test('Basic Calculation Flow (Force Calculator)', async ({ page }) => {
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
    await page.waitForTimeout(2000);
    
    const table = page.locator('.sheet-table');
    await expect(table.locator('text=98')).toBeVisible(); 
  });

  test('Error Handling (Scenario 3)', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);
    
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('ZeroDivNode');
    
    // Cleanup defaults
    await page.locator('.io-column:has-text("Inputs") li').filter({ has: page.locator('input').filter({ hasValue: 'x' }) }).locator('button.danger').click();
    await page.locator('.io-column:has-text("Outputs") li').filter({ has: page.locator('input').filter({ hasValue: 'result' }) }).locator('button.danger').click();

    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('out_val');
    await page.locator('#node-code').fill('out_val = 1 / 0');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'ZeroDivNode', -150, 0);

    // Add Output node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('surfaced_error');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'surfaced_error', 150, 0);

    // Connect
    await connectNodes(page, 'ZeroDivNode', 'out_val', 'surfaced_error', 'value');

    // Run
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(2000);

    // Verify error tooltip
    const tooltip = page.locator('.node-error-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('division by zero');
  });

  test('Nesting Sheets (Scenario 4)', async ({ page }) => {
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

  test('Material Selection (Scenario 8)', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    // 1. Create 'material' Option Node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('material');
    
    // Change type to Option
    await page.selectOption('#node-type', 'option');
    
    // Add options
    await page.click('button:has-text("+ Add Option")');
    await page.locator('div.form-group li input').nth(0).fill('Steel');
    await page.click('button:has-text("+ Add Option")');
    await page.locator('div.form-group li input').nth(1).fill('Aluminum');
    
    // Select Steel as default
    await page.selectOption('#node-value', 'Steel');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'material', -250, 0);

    // 2. Create Density Function
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('GetDensity');
    
    // Port setup
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
    await page.waitForTimeout(1000);
    
    const table = page.locator('.sheet-table');
    await expect(table.locator('text=7850')).toBeVisible();

    // 5. Interaction: Change material to Aluminum in the table
    await table.locator('select.sheet-table-input').selectOption('Aluminum');
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(1000);
    
    // Result should update
    await expect(table.locator('text=2700')).toBeVisible();
  });
});
