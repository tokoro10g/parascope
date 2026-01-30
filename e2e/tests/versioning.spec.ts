/**
 * Sheet Versioning
 * Goal: Verify that users can create and restore specific versions of their sheets.
 */

import { test, expect } from '@playwright/test';
import {
  humanDelay,
  login,
  addNode,
  saveSheet,
  createVersion,
  restoreVersion,
} from './utils/graph-utils';

test.describe('Sheet Versioning', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'version_user');
  });

  test('Create and Restore Version', async ({ page }) => {
    // 1. Create Sheet
    await page.click('button:has-text("Create New Sheet")');
    await page.waitForURL('**/sheet/**');

    // 2. Add "V1 Node" and Save
    await addNode(page, 'Constant', 'V1 Node');
    await saveSheet(page);

    // 3. Create Version "v1.0"
    await createVersion(page, 'v1.0', 'Initial version');
    await humanDelay(page);

    // 4. Modify Sheet (Add "V2 Node") and Save
    await addNode(page, 'Constant', 'V2 Node');
    await saveSheet(page);

    // Verify both nodes exist
    await expect(
      page.locator('[data-testid="node"] .title:has-text("V1 Node")'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="node"] .title:has-text("V2 Node")'),
    ).toBeVisible();

    // 5. Restore v1.0
    await restoreVersion(page, 'v1.0');

    // 6. Verify State (V2 Node gone)
    await expect(
      page.locator('[data-testid="node"] .title:has-text("V2 Node")'),
    ).toBeHidden();
    await expect(
      page.locator('[data-testid="node"] .title:has-text("V1 Node")'),
    ).toBeVisible();
  });
});