import { test, expect } from '@playwright/test';
import {
  login,
  createSheet,
  addNode,
  changeTableInput,
  verifyInputValue,
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
    await expect(node).toHaveClass(/node-constant/);
    await verifyInputValue(page, 'SwitchNode', testValue, false);

    // 2. Switch to Input via context menu
    await node.click({ button: 'right' });
    await page.locator('div:text("Switch to Input")').click();

    // 3. Verify value is inherited (wrapped in parentheses as it is an example)
    const inputNode = page.locator('[data-testid="node"]').filter({ hasText: 'SwitchNode' });
    await expect(inputNode).toHaveClass(/node-input/);
    await verifyInputValue(page, 'SwitchNode', testValue, true);
    
    // Verify it is indeed an input node now (context menu should show "Switch to Constant")
    await inputNode.click({ button: 'right' });
    await expect(page.locator('div:text("Switch to Constant")')).toBeVisible();
  });

  test('Value is inherited when switching from Input to Constant', async ({ page }) => {
    const sheetName = `Switch_Test_Rev_${Date.now()}`;
    await createSheet(page, sheetName);

    // 1. Add Input Node
    await addNode(page, 'Input', 'ReverseSwitchNode');
    
    const initialNode = page.locator('[data-testid="node"]').filter({ hasText: 'ReverseSwitchNode' });
    await expect(initialNode).toHaveClass(/node-input/);

    // 2. Set value via table
    const testValue = '99';
    await changeTableInput(page, 'ReverseSwitchNode', testValue);
    
    await verifyInputValue(page, 'ReverseSwitchNode', testValue, true);

    // 3. Switch to Constant via context menu
    // This triggers a confirmation dialog
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    
    const node = page.locator('[data-testid="node"]').filter({ hasText: 'ReverseSwitchNode' });
    await node.click({ button: 'right' });
    await page.locator('div:text("Switch to Constant")').click();

    // 4. Verify value is inherited (not wrapped as it is a constant)
    const constNode = page.locator('[data-testid="node"]').filter({ hasText: 'ReverseSwitchNode' });
    await expect(constNode).toHaveClass(/node-constant/);
    await verifyInputValue(page, 'ReverseSwitchNode', testValue, false);
  });
});
