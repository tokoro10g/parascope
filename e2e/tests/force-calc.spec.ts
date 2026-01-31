/**
 * Force Calculator
 * Goal: Create a simple physics calculation and save it.
 */

import { test, expect } from '@playwright/test';
import {
  connectNodes,
  moveNode,
  zoomOut,
  humanDelay,
  login,
  addNode,
  runCalculation,
} from './utils/graph-utils';

test.describe('Force Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'scenario_1_user');
  });

  test('Basic Calculation Flow', async ({ page }) => {
    await page.click('button:has-text("Create New Sheet")');
    await page.waitForURL('**/sheet/**');
    await zoomOut(page, 4);
    await humanDelay(page);

    // 1. Create 'Mass [kg]' Constant
    await addNode(page, 'Constant', 'Mass [kg]', '10');
    await moveNode(page, 'Mass [kg]', -250, -100);
    await humanDelay(page);

    // 2. Create 'Acceleration [m/s2]' Constant
    await addNode(page, 'Constant', 'Acceleration [m/s2]', '9.8');
    await moveNode(page, 'Acceleration [m/s2]', -250, 100);
    await humanDelay(page);

    // 3. Create 'Force Function'
    await page.click('button:has-text("Add Node")');
    await page.click('.add-menu-item:has-text("Function")');
    await page.locator('#node-label').fill('Force Calculation');

    // Remove defaults (x and result)
    await page
      .locator('.io-column:has-text("Inputs") li')
      .filter({ has: page.locator('input').filter({ hasValue: 'x' }) })
      .locator('button.danger')
      .click();
    await page
      .locator('.io-column:has-text("Outputs") li')
      .filter({ has: page.locator('input').filter({ hasValue: 'result' }) })
      .locator('button.danger')
      .click();

    // Add mass_kg input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('mass_kg');
    // Add accel_ms2 input
    await page.click('button:has-text("+ Add Input")');
    await page.locator('.io-column:has-text("Inputs") li input').last().fill('accel_ms2');
    // Add force_n output
    await page.click('button:has-text("+ Add Output")');
    await page.locator('.io-column:has-text("Outputs") li input').last().fill('force_n');

    await page.locator('#node-code').fill('force_n = mass_kg * accel_ms2');
    await humanDelay(page, 500);
    await page.click('button:has-text("Save")');
    await moveNode(page, 'Force Calculation', 0, 0);
    await humanDelay(page);

    // 4. Create Output Node
    await addNode(page, 'Output', 'Final Force [N]');
    await moveNode(page, 'Final Force [N]', 250, 0);
    await humanDelay(page);

    // 5. Connect nodes
    await connectNodes(page, 'Mass [kg]', 'value', 'Force Calculation', 'mass_kg');
    await connectNodes(
      page,
      'Acceleration [m/s2]',
      'value',
      'Force Calculation',
      'accel_ms2',
    );
    await connectNodes(
      page,
      'Force Calculation',
      'force_n',
      'Final Force [N]',
      'value',
    );
    await humanDelay(page);

    // 6. Run and Check Table results
    await runCalculation(page);
    await humanDelay(page);
    const resultCell = page.locator('.sheet-table-cell-value:has-text("98")');
    await expect(resultCell).toBeVisible({ timeout: 5000 });

    await test.step('Verify intermediate socket values', async () => {
      // Mass node output value
      const massNode = page.locator('[data-testid="node"]').filter({ has: page.locator('[data-testid="title"]:has-text("Mass [kg]")') });
      await expect(massNode.locator('.socket-value')).toContainText(/^10(\.0+)?$/);

      // Acceleration node output value
      const accelNode = page.locator('[data-testid="node"]').filter({ has: page.locator('[data-testid="title"]:has-text("Acceleration [m/s2]")') });
      await expect(accelNode.locator('.socket-value')).toContainText(/^9\.8(\.0+)?$/);

      // Force Calculation output value (force_n)
      const forceCalcNode = page.locator('[data-testid="node"]').filter({ has: page.locator('[data-testid="title"]:has-text("Force Calculation")') });
      await expect(forceCalcNode.locator('.socket-value').filter({ hasText: /^98(\.0+)?$/ })).toBeVisible();

      // Final Force input value (should also show 98 on the left)
      const finalForceNode = page.locator('[data-testid="node"]').filter({ has: page.locator('[data-testid="title"]:has-text("Final Force [N]")') });
      await expect(finalForceNode.locator('.socket-value')).toContainText(/^98(\.0+)?$/);
    });

    await humanDelay(page, 2000); // Hold final result for a bit in video
  });
});