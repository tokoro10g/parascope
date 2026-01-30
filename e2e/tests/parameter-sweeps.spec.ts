/**
 * Parameter Sweeps
 * Goal: Execute iterative analysis for high-density engineering work.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  login,
  addNode,
  saveSheet,
} from './utils/graph-utils';

test.describe('Parameter Sweeps', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'sweep_user');
  });

  test('Analysis Flow - 1D Sweep', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    // 1. Create simple graph: mass -> result
    await addNode(page, 'Constant', 'sweep_mass', '10');
    await moveNode(page, 'sweep_mass', -200, 0);

    await addNode(page, 'Output', 'sweep_result');
    await moveNode(page, 'sweep_result', 200, 0);

    await connectNodes(page, 'sweep_mass', 'value', 'sweep_result', 'value');
    await saveSheet(page);

    // 2. Go to Sweep Page (opens in new tab)
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button.sweep-button'),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/.*\/sweep/);

    // 3. Configure Sweep
    await popup.locator('.sweep-input-row:has-text("Start") input').fill('10');
    await popup.locator('.sweep-input-row:has-text("End") input').fill('50');
    await popup.locator('.sweep-input-row:has-text("Increment") input').fill('10');

    // Select output to plot
    await popup
      .locator('tr.sweep-output-row:has-text("sweep_result") input[type="checkbox"]')
      .check();

    // 4. Run Sweep
    await popup.click('button:has-text("Run Sweep")');

    // 5. Verify Results
    await expect(popup.locator('button:has-text("Copy Data")')).toBeVisible({
      timeout: 15000,
    });
    const chart = popup.locator('.echarts-for-react canvas');
    await expect(chart).toBeVisible();
  });
});
