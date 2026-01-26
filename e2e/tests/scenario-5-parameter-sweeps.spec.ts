/**
 * Scenario 5: Parameter Sweeps
 * Goal: Execute iterative analysis for high-density engineering work.
 * 
 * This test verifies:
 * 1. Navigation to the Sweep analysis page.
 * 2. Configuration of primary variable ranges (Start, End, Increment).
 * 3. Execution of the sweep calculation.
 * 4. Rendering of tabular results and ECharts visualization.
 */

import { test, expect } from '@playwright/test';
import { connectNodes, moveNode, zoomOut } from './utils/graph-utils';

test.describe('Scenario 5: Parameter Sweeps', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="Your Name"]').fill('sweep_user');
    await page.click('button:has-text("Continue")');
    await page.waitForURL('**/');
  });

  test('Analysis Flow - 1D Sweep', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await zoomOut(page, 4);

    // 1. Create simple graph: mass -> ForceCalc -> FinalForce
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Constant")');
    await page.locator('#node-label').fill('sweep_mass');
    await page.locator('#node-value').fill('10');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'sweep_mass', -200, 0);

    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Output")');
    await page.locator('#node-label').fill('sweep_result');
    await page.click('button:has-text("Save")');
    await moveNode(page, 'sweep_result', 200, 0);

    await connectNodes(page, 'sweep_mass', 'value', 'sweep_result', 'value');
    await page.click('button[title="Save Sheet"]');
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();

    // 2. Go to Sweep Page (opens in new tab)
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button.sweep-button')
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/.*\/sweep/);

    // 3. Configure Sweep
    await popup.locator('.sweep-input-row:has-text("Start") input').fill('10');
    await popup.locator('.sweep-input-row:has-text("End") input').fill('50');
    await popup.locator('.sweep-input-row:has-text("Increment") input').fill('10');

    // Select output to plot
    await popup.locator('tr.sweep-output-row:has-text("sweep_result") input[type="checkbox"]').check();

    // 4. Run Sweep
    await popup.click('button:has-text("Run Sweep")');
    
    // 5. Verify Results
    await expect(popup.locator('button:has-text("Copy Data")')).toBeVisible({ timeout: 15000 });
    const chart = popup.locator('.echarts-for-react canvas');
    await expect(chart).toBeVisible();
  });
});
