import { test, expect } from '@playwright/test';

test.describe('Parascope Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Perform login before each test
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('smoke_tester');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Folder and Sheet Organization', async ({ page }) => {
    // 1. Create a folder
    const folderName = `Folder_${Date.now()}`;
    page.on('dialog', async dialog => {
      await dialog.accept(folderName);
    });
    await page.click('button:has-text("New Folder")');
    
    // 2. Verify folder exists
    const folderLocator = page.locator(`.explorer-item:has-text("${folderName}")`);
    await expect(folderLocator).toBeVisible();

    // 3. Enter folder
    await folderLocator.click();
    await expect(page.locator('.explorer-item:has-text(".. (Up)")')).toBeVisible();

    // 4. Create a sheet inside the folder
    await page.click('button:has-text("Create New Sheet")');
    await expect(page).toHaveURL(/.*sheet\/.*/);

    // 5. Rename sheet
    const sheetName = `Sheet_${Date.now()}`;
    const nameInput = page.locator('input[placeholder="Sheet Name"]');
    await nameInput.click();
    await nameInput.fill(sheetName);
    await nameInput.press('Enter');
    
    // Reliably trigger dirty state by adding a node
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('trigger');
    await page.click('button:has-text("Save")');

    // Verify it is dirty
    const unsavedBadge = page.locator('.unsaved-indicator-badge');
    await expect(unsavedBadge).toBeVisible();

    // 6. Save sheet
    const saveButton = page.locator('button[title="Save Sheet"]');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(unsavedBadge).toBeHidden();

    // 7. Go back to dashboard and verify
    await page.goto('/');
    await folderLocator.click();
    await expect(page.locator(`.explorer-item:has-text("${sheetName}")`)).toBeVisible();
  });

  test('Basic Calculation Flow (Force Calculator)', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await expect(page).toHaveURL(/.*sheet\/.*/);

    // Add 'mass'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('mass');
    await page.locator('#node-value').fill('10');
    await page.click('button:has-text("Save")');

    // Add 'accel'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('accel');
    await page.locator('#node-value').fill('9.8');
    await page.click('button:has-text("Save")');

    // Add 'Force' Function
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('ForceCalc');
    await page.locator('#node-code').fill('force = mass * accel');
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('force');
    await page.click('button:has-text("Save")');

    // Verify nodes exist
    await expect(page.locator('.rete >> text=mass')).toBeVisible();
    await expect(page.locator('.rete >> text=accel')).toBeVisible();
    await expect(page.locator('.rete >> text=ForceCalc')).toBeVisible();

    // Check Table
    const table = page.locator('.sheet-table');
    await expect(table.locator('text=mass')).toBeVisible();
    await expect(table.locator('text=accel')).toBeVisible();
    
    // Check values
    await expect(table.locator('input.sheet-table-input').filter({ hasValue: '10' }).first()).toBeVisible();
    await expect(table.locator('input.sheet-table-input').filter({ hasValue: '9.8' }).first()).toBeVisible();
  });

  test('Error Handling (Scenario 3)', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    
    // Add Function with a division by zero error
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('ZeroDivNode');
    await page.locator('#node-code').fill('result = 1 / 0');
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('result');
    await page.click('button:has-text("Save")');

    // Run calculation
    await page.click('button:has-text("Run")');
    
    // Wait for execution and verify visual indicator on canvas
    await expect(page.locator('.rete >> text=ZeroDivNode')).toBeVisible();
    
    // Verify the error message in the tooltip
    const tooltip = page.locator('.node-error-tooltip');
    await expect(tooltip).toBeVisible();
    // Python usually says "division by zero"
    await expect(tooltip).toContainText('division by zero');
  });

  test('Nesting Sheets (Scenario 4)', async ({ page }) => {
    // 1. Create Cylinder Volume sheet
    await page.click('button:has-text("Create New Sheet")');
    const sheetName = `CylVol_${Date.now()}`;
    const nameInput = page.locator('input[placeholder="Sheet Name"]');
    await nameInput.click();
    await nameInput.fill(sheetName);
    await nameInput.press('Enter');

    // Add Input radius
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('radius');
    await page.click('button:has-text("Save")');

    // Save
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();

    // 2. Create Parent sheet
    await page.goto('/');
    await page.click('button:has-text("Create New Sheet")');
    
    // Import Cylinder Volume
    await page.click('button:has-text("Import Sheet")');
    await page.waitForTimeout(1000);
    await page.click(`.explorer-item:has-text("${sheetName}")`);

    // Verify the node exists on parent canvas
    await page.waitForTimeout(1000);
    await expect(page.locator('.rete')).toContainText(sheetName);
  });
});
