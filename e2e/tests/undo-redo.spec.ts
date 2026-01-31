/**
 * Undo/Redo Interactions
 * Goal: Verify that value changes in nodes are tracked in history and can be undone/redone.
 */

import { test, expect } from '@playwright/test';
import {
  createSheet,
  humanDelay,
  login,
  moveNode,
  addNode,
} from './utils/graph-utils';

test.describe('Undo/Redo Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'undo_user');
  });

  test('Undo and Redo value changes', async ({ page }) => {
    await test.step('Create sheet and node', async () => {
      await createSheet(page, 'UndoRedo_Test_Sheet');
      await addNode(page, 'Constant', 'Test Constant', '10');
    });
    
    // Locate the input field within the node
    const node = page.locator('[data-testid="node"]').filter({ has: page.locator('[data-testid="title"]:has-text("Test Constant")') });
    const input = node.locator('input');
    
    await expect(input).toHaveValue('10');
    await page.waitForTimeout(500);
    
    await test.step('Change value 10 -> 20', async () => {
      await input.fill('20');
      await input.press('Enter'); // Trigger commit
      await expect(input).toHaveValue('20');
      await page.click('.rete'); // Focus canvas
      // Wait for any background calculation/save to settle
      await page.waitForTimeout(500);
    });
    
    await test.step('Undo 20 -> 10', async () => {
      await page.keyboard.press('Control+z');
      await expect(input).toHaveValue('10');
      await page.click('.rete'); // Focus canvas
      await page.waitForTimeout(500);
    });
    
    await test.step('Redo 10 -> 20', async () => {
      await page.keyboard.press('Control+Shift+z'); 
      await expect(input).toHaveValue('20');
      await page.click('.rete'); // Focus canvas
      await page.waitForTimeout(500);
    });
    
    await test.step('Change value 20 -> 30 via blur', async () => {
      await input.fill('30');
      await input.blur(); // Trigger commit via blur
      await expect(input).toHaveValue('30');
      await page.click('.rete'); // Focus canvas
      await page.waitForTimeout(500);
    });
    
    await test.step('Undo 30 -> 20', async () => {
      await page.keyboard.press('Control+z');
      await expect(input).toHaveValue('20');
      await page.click('.rete'); // Focus canvas
      await page.waitForTimeout(500);
    });

    await test.step('Redo 20 -> 30 via Ctrl+Y', async () => {
      await page.keyboard.press('Control+y');
      await expect(input).toHaveValue('30');
      await page.click('.rete'); // Focus canvas
    });
  });
});
