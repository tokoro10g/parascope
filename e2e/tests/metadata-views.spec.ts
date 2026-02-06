/**
 * Metadata and Views Verification
 * Goal: Ensure all metadata (descriptions, versions) and relationship views (Used In) are functional.
 */

import { test, expect } from '@playwright/test';
import {
  zoomOut,
  moveNode,
  login,
  createSheet,
  addNode,
  saveSheet,
  createVersion,
  importSheet,
  openNodeInspector,
} from './utils/graph-utils';

test.describe('Metadata & Views', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await login(page, 'metadata_user');
  });

  test('Inspector, Versioning, and Usage Views', async ({ page }) => {
    const timestamp = Date.now();
    const childName = `Child_${timestamp}`;
    const parentName = `Parent_${timestamp}`;

    // 1. Create Child Sheet
    await createSheet(page, childName);
    await zoomOut(page, 4);

    // Add Constant with Description
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('MyConstant');
    await page.locator('#node-description').fill('This is a constant description');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'MyConstant', -100, 100);

    // Add Function with Description
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('MyFunction');
    await page.locator('#node-description').fill('This is a function description');
    await page.locator('#node-code').fill('result = x');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'MyFunction', 100, 100);

    // Add Comment
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Comment")');
    await page
      .locator('#node-description')
      .fill('This is markdown comment content');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Comment', 0, 200);

    // Save Child Sheet
    await saveSheet(page);

    // Create a Version
    const version = await createVersion(page, 'v1.0.0', 'Initial version');
    const childId = page.url().split('/').pop()?.split('?')[0];

    // 2. Create Parent Sheet
    await page.click('.nav-back-button'); // Go to dashboard
    await createSheet(page, parentName);

    // Import Child Sheet
    await importSheet(page, childName);

    // Inspector now opens automatically on import
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: sheet');
    const versionOption = page
      .locator('#sheet-version option')
      .filter({ hasText: 'v1.0.0' });
    const versionValue = await versionOption.getAttribute('value');
    await page.locator('#sheet-version').selectOption(versionValue!);

    await page.click('button:has-text("Save")');

    // Verify Version Tag on Node
    await moveNode(page, childName, 0, 100);
    const nodeWrapper = page
      .locator('div:has(> .node-sheet)')
      .filter({ hasText: childName })
      .first();
    await expect(nodeWrapper).toContainText('v1.0.0');

    // Save Parent Sheet
    await saveSheet(page);

    // 3. Verify Descriptions in Inspector (re-opening)
    // We navigate directly to the version we want to check usage for
    await page.goto(`/sheet/${childId}?versionId=${version.id}`);
    await expect(page.locator('.loading-overlay')).not.toBeVisible();

    // Check Constant Description
    await openNodeInspector(page, 'MyConstant');
    await expect(page.locator('#node-description')).toHaveValue(
      'This is a constant description',
    );
    await page.click('button:has-text("Cancel")');

    // Check Comment content
    await openNodeInspector(page, 'Comment');
    await expect(page.locator('#node-description')).toHaveValue(
      'This is markdown comment content',
    );
    await page.click('button:has-text("Cancel")');

    // 4. Verify "Used In" (Usage View)
    await page.click('.btn-sheet-menu-trigger');
    await page.click('.add-menu-item:has-text("Find Usage")');

    const usageModal = page.locator('.modal-content:has-text("Find Usage")');
    await expect(usageModal).toBeVisible();
    await expect(usageModal).toContainText('Find Usage (v1.0.0)');
    await expect(usageModal).toContainText(parentName);
    await page.click('button:has-text("Close")');
  });
});