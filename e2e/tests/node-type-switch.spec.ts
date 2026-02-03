import { test, expect } from '@playwright/test';
import {
  login,
  createSheet,
  addNode,
  changeTableInput,
} from './utils/graph-utils';

test.describe('Node Type Switching', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'type_switch_user');
  });

  test('Value is inherited when switching from Constant to Input', async ({ page }) => {
    const sheetName = `Switch_Test_${Date.now()}`;
    await createSheet(page, sheetName);

    // 1. Add Constant Node and set value
    const testValue = '42';
    await addNode(page, 'Constant', 'SwitchNode', testValue);
    
    const node = page.locator('[data-testid="node"]').filter({ hasText: 'SwitchNode' });
    await expect(node).toBeVisible();
    await expect(node.locator('input')).toHaveValue(testValue);

    // 2. Switch to Input via context menu
    await node.click({ button: 'right' });
    await page.locator('div:text("Switch to Input")').click();

    // 3. Verify value is inherited
    const inputNode = page.locator('[data-testid="node"]').filter({ hasText: 'SwitchNode' });
    await expect(inputNode).toBeVisible();
    await expect(inputNode.locator('input')).toHaveValue(testValue);
    
    // Verify it is indeed an input node now (context menu should show "Switch to Constant")
    await inputNode.click({ button: 'right' });
    await expect(page.locator('div:text("Switch to Constant")')).toBeVisible();
  });

  test('Value is inherited when switching from Input to Constant', async ({ page }) => {
    const sheetName = `Switch_Test_Rev_${Date.now()}`;
    await createSheet(page, sheetName);

    // 1. Add Input Node (without initial value as it is not supported in addNode for Inputs)
    await addNode(page, 'Input', 'ReverseSwitchNode');
    
    // 2. Set value via table
    const testValue = '99';
    await changeTableInput(page, 'ReverseSwitchNode', testValue);
    
    const node = page.locator('[data-testid="node"]').filter({ hasText: 'ReverseSwitchNode' });
    await expect(node).toBeVisible();
    await expect(node.locator('input')).toHaveValue(testValue);

    // 3. Switch to Constant via context menu
    await node.click({ button: 'right' });
    await page.locator('div:text("Switch to Constant")').click();

    // 4. Verify value is inherited
    const constNode = page.locator('[data-testid="node"]').filter({ hasText: 'ReverseSwitchNode' });
    await expect(constNode).toBeVisible();
    await expect(constNode.locator('input')).toHaveValue(testValue);
  });
});
