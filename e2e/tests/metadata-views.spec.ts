/**
 * Metadata and Views Verification
 * Goal: Ensure all metadata (descriptions, versions) and relationship views (Used In) are functional.
 */

import { test, expect } from '@playwright/test';
import { zoomOut, moveNode } from './utils/graph-utils';

test.describe('Metadata & Views', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('metadata_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Inspector, Versioning, and Usage Views', async ({ page }) => {
    const timestamp = Date.now();
    const childName = `Child_${timestamp}`;
    const parentName = `Parent_${timestamp}`;

    // 1. Create Child Sheet
    await page.click('button:has-text("Create New Sheet")');
    await page.locator('.sheet-name-input').fill(childName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await zoomOut(page, 4);

    // Add Constant with Description (Inspector opens automatically)
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: constant');
    await page.locator('#node-label').fill('MyConstant');
    await page.locator('#node-description').fill('This is a constant description');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await moveNode(page, 'MyConstant', -100, 100);

    // Add Function with Description
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: function');
    await page.locator('#node-label').fill('MyFunction');
    await page.locator('#node-description').fill('This is a function description');
    // Fix default code to avoid error: result = x
    await page.locator('#node-code').fill('result = x');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await moveNode(page, 'MyFunction', 100, 100);

    // Add Comment (Description is the content)
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Comment")');
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: comment');
    await page.locator('#node-description').fill('This is markdown comment content');
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await moveNode(page, 'Comment', 0, 200);

    // Save Child Sheet
    const saveButton = page.getByTitle('Save Sheet');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByText('Sheet saved successfully')).toBeVisible();

    // Create a Version
    await page.click('.btn-sheet-menu-trigger');
    await page.click('.add-menu-item:has-text("Version Control")');
    await expect(page.locator('.modal-header h2')).toContainText('Version Control');
    
    await page.locator('input[placeholder="Tag (e.g. v1.0)"]').fill('v1.0.0');
    await page.locator('textarea[placeholder="Description (optional)"]').fill('Initial version');
    await page.click('.modal-body button:has-text("Create")');
    await expect(page.getByText('Version v1.0.0 created successfully')).toBeVisible();
    await page.click('.modal-header .modal-close-btn');

    // 2. Create Parent Sheet
    await page.click('.nav-back-button'); // Go to dashboard
    await expect(page.locator('.item-explorer')).toBeVisible();
    await page.click('button:has-text("Create New Sheet")');
    await page.locator('.sheet-name-input').fill(parentName);
    await page.keyboard.press('Enter');
    
    // Import Child Sheet
    await page.click('button:has-text("Import Sheet")');
    await page.locator(`.sheet-item:has-text("${childName}")`).click();
    
    // Inspector now opens automatically on import
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node: sheet');
    await expect(page.locator('#sheet-version option')).toHaveCount(2, { timeout: 10000 });
    
    // Select version by finding the option with text v1.0.0
    const versionOption = page.locator('#sheet-version option').filter({ hasText: 'v1.0.0' });
    const versionValue = await versionOption.getAttribute('value');
    await page.locator('#sheet-version').selectOption(versionValue!);
    
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Verify Version Tag on Node
    // Need to move it down so it is not intercepted by the toolbar
    await moveNode(page, childName, 0, 100);
    const nodeWrapper = page.locator('div:has(> .node-sheet)').filter({ hasText: childName }).first();
    await expect(nodeWrapper).toContainText('v1.0.0');

    // Save Parent Sheet
    const parentSaveButton = page.getByTitle('Save Sheet');
    await expect(parentSaveButton).toBeEnabled();
    await parentSaveButton.click();
    await expect(page.getByText('Sheet saved successfully')).toBeVisible();

    // 3. Verify Descriptions in Inspector (re-opening)
    await page.click('.nav-back-button'); // Go to dashboard
    await expect(page.locator('.item-explorer')).toBeVisible();
    await page.locator(`.sheet-item:has-text("${childName}")`).click();
    await expect(page.locator('.loading-overlay')).not.toBeVisible();

    // Check Constant Description
    const constantNode = page.locator('.node-constant:has-text("MyConstant")').first();
    await constantNode.click({ button: 'right' });
    await page.locator('div:text("Edit")').click();
    await expect(page.locator('#node-description')).toHaveValue('This is a constant description');
    await page.click('button:has-text("Cancel")');

    // Check Comment content
    const commentNode = page.locator('.node-comment').first();
    await commentNode.click({ button: 'right' });
    await page.locator('div:text("Edit")').click();
    await expect(page.locator('#node-description')).toHaveValue('This is markdown comment content');
    await page.click('button:has-text("Cancel")');

    // 4. Verify "Used In" (Usage View)
    await page.click('.btn-sheet-menu-trigger');
    await page.click('.add-menu-item:has-text("Check Usage")');
    
    const usageModal = page.locator('.modal-content:has-text("Parent Sheets")');
    await expect(usageModal).toBeVisible();
    await expect(usageModal).toContainText(parentName);
    await page.click('button:has-text("Close")');
  });
});
