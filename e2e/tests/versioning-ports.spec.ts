import { expect, test } from '@playwright/test';
import {
  connectNodes,
  createSheet,
  createVersion,
  getPortLocator,
  login,
  moveNode,
  openNodeInspector,
  saveSheet,
} from './utils/graph-utils';

test.describe('Versioning & Port Synchronization', () => {
  test('Syncs sheet node ports with selected version definition', async ({
    page,
  }) => {
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

    // Save Sheet before creating version
    await saveSheet(page);

    // Create Version v1
    await createVersion(page, 'v1.0');

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

    // Save Sheet before creating version
    await saveSheet(page);

    // Create Version v2
    await createVersion(page, 'v2.0');

    // 3. Create Parent Sheet
    await page.click('.nav-back-button');
    await createSheet(page, 'Parent_Sync');

    // Import Child Sheet
    await page.click('button:has-text("Import Sheet")');
    await page.locator(`.sheet-item:has-text("${childName}")`).click();

    // Inspector opens. Select v1.0.
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: sheet');
    const v1Option = page
      .locator('#sheet-version option')
      .filter({ hasText: 'v1.0' });
    const v1Value = await v1Option.getAttribute('value');
    await page.locator('#sheet-version').selectOption(v1Value!);
    await page.click('button:has-text("Save")');

    // Save Parent Sheet before reload
    await saveSheet(page);

    // Verify v1 Ports: Should have x, y but NOT z, w
    await expect(getPortLocator(page, childName, 'x', 'input')).toBeVisible();
    await expect(getPortLocator(page, childName, 'y', 'output')).toBeVisible();
    await expect(getPortLocator(page, childName, 'z', 'input')).not.toBeVisible();
    await expect(getPortLocator(page, childName, 'w', 'output')).not.toBeVisible();

    // --- CRITICAL CHECK: Reload parent page and verify it stays on v1 ports ---
    // Even though live child has z/w, our node is pinned to v1.
    await page.reload();
    await page.waitForTimeout(3000); // Wait for load and sync

    // Verify v1 Ports again after reload
    await expect(getPortLocator(page, childName, 'x', 'input')).toBeVisible();
    await expect(getPortLocator(page, childName, 'y', 'output')).toBeVisible();
    await expect(getPortLocator(page, childName, 'z', 'input')).not.toBeVisible();
    await expect(getPortLocator(page, childName, 'w', 'output')).not.toBeVisible();
    // --------------------------------------------------------------------------

    // 4. Update to v2.0
    // Open inspector
    await openNodeInspector(page, childName);

    const v2Option = page
      .locator('#sheet-version option')
      .filter({ hasText: 'v2.0' });
    const v2Value = await v2Option.getAttribute('value');
    await page.locator('#sheet-version').selectOption(v2Value!);
    await page.click('button:has-text("Save")');

    // Verify v2 Ports: Should have x, y, z, w
    await expect(getPortLocator(page, childName, 'x', 'input')).toBeVisible();
    await expect(getPortLocator(page, childName, 'y', 'output')).toBeVisible();
    await expect(getPortLocator(page, childName, 'z', 'input')).toBeVisible();
    await expect(getPortLocator(page, childName, 'w', 'output')).toBeVisible();

    // 5. Revert to v1.0
    await openNodeInspector(page, childName);
    await page.locator('#sheet-version').selectOption(v1Value!);
    await page.click('button:has-text("Save")');

    // Verify v1 Ports again
    await expect(getPortLocator(page, childName, 'x', 'input')).toBeVisible();
    await expect(getPortLocator(page, childName, 'y', 'output')).toBeVisible();
    await expect(getPortLocator(page, childName, 'z', 'input')).not.toBeVisible();
    await expect(getPortLocator(page, childName, 'w', 'output')).not.toBeVisible();
  });
});
