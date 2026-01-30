import { expect, test } from '@playwright/test';
import { connectNodes, createSheet, login, moveNode } from './utils/graph-utils';

test.describe('Versioning & Port Synchronization', () => {
  test('Syncs sheet node ports with selected version definition', async ({ page }) => {
    await login(page);

    // 1. Create Child Sheet (v1 state)
    // Input: "x", Output: "y"
    await createSheet(page, 'Child_v1');
    const childName = 'Child_v1';
    
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('x');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'x', -200, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('y');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'y', 200, 0);

    // Create Version v1
    await page.click('.btn-sheet-menu-trigger');
    await page.click('.add-menu-item:has-text("Version Control")');
    await page.locator('input[placeholder*="Tag"]').fill('v1.0');
    await page.click('button:has-text("Create")');
    await page.click('button[aria-label="Close"]');

    // 2. Modify Child Sheet (v2 state)
    // Add Input: "z", Add Output: "w"
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Input")');
    await page.locator('#node-label').fill('z');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'z', -200, 100);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('w');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'w', 200, 100);

    // Create Version v2
    await page.click('.btn-sheet-menu-trigger');
    await page.click('.add-menu-item:has-text("Version Control")');
    await page.locator('input[placeholder*="Tag"]').fill('v2.0');
    await page.click('button:has-text("Create")');
    await page.click('button[aria-label="Close"]');

    // 3. Create Parent Sheet
    await page.click('.nav-back-button');
    await createSheet(page, 'Parent_Sync');
    
    // Import Child Sheet
    await page.click('button:has-text("Import Sheet")');
    await page.locator(`.sheet-item:has-text("${childName}")`).click();
    
    // Inspector opens. Select v1.0.
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: sheet');
    const v1Option = page.locator('#sheet-version option').filter({ hasText: 'v1.0' });
    const v1Value = await v1Option.getAttribute('value');
    await page.locator('#sheet-version').selectOption(v1Value!);
    await page.click('button:has-text("Save")');

    // Verify v1 Ports: Should have x, y but NOT z, w
    await expect(page.locator('.socket-input-title:has-text("x")')).toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("y")')).toBeVisible();
    await expect(page.locator('.socket-input-title:has-text("z")')).not.toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("w")')).not.toBeVisible();

    // --- CRITICAL CHECK: Reload parent page and verify it stays on v1 ports ---
    // Even though live child has z/w, our node is pinned to v1.
    await page.reload();
    await page.waitForTimeout(2000); // Wait for load and sync
    
    // Verify v1 Ports again after reload
    await expect(page.locator('.socket-input-title:has-text("x")')).toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("y")')).toBeVisible();
    await expect(page.locator('.socket-input-title:has-text("z")')).not.toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("w")')).not.toBeVisible();
    // --------------------------------------------------------------------------

    // 4. Update to v2.0
    // Open inspector via context menu
    const sheetNode = page.locator('.node-sheet').filter({ hasText: childName }).first();
    await sheetNode.click({ button: 'right' });
    await page.locator('div:text("Edit")').click();

    const v2Option = page.locator('#sheet-version option').filter({ hasText: 'v2.0' });
    const v2Value = await v2Option.getAttribute('value');
    await page.locator('#sheet-version').selectOption(v2Value!);
    await page.click('button:has-text("Save")');

    // Verify v2 Ports: Should have x, y, z, w
    await expect(page.locator('.socket-input-title:has-text("x")')).toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("y")')).toBeVisible();
    await expect(page.locator('.socket-input-title:has-text("z")')).toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("w")')).toBeVisible();

    // 5. Revert to v1.0
    await sheetNode.click({ button: 'right' });
    await page.locator('div:text("Edit")').click();
    await page.locator('#sheet-version').selectOption(v1Value!);
    await page.click('button:has-text("Save")');

    // Verify v1 Ports again
    await expect(page.locator('.socket-input-title:has-text("x")')).toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("y")')).toBeVisible();
    await expect(page.locator('.socket-input-title:has-text("z")')).not.toBeVisible();
    await expect(page.locator('.socket-output-title:has-text("w")')).not.toBeVisible();
  });
});
