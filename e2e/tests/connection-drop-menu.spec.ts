import { test, expect } from '@playwright/test';
import {
  login,
  createSheet,
  addNode,
  zoomOut,
  runCalculation,
} from './utils/graph-utils';

test.describe('Connection Drop Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'menu_test_user');
  });

  test('Drag from function output and create connected output node', async ({ page }) => {
    const timestamp = Date.now();
    const sheetName = `ConnDropFunc_${timestamp}`;

    await createSheet(page, sheetName);
    await zoomOut(page, 2);

    // 1. Add a Function node
    await addNode(page, 'Function', 'MyFunc');

    // 2. Locate the "result" output socket
    const sourceNode = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("MyFunc")`) });
    const sourceSocket = sourceNode
      .locator('.output')
      .filter({ hasText: 'result' })
      .locator('.custom-socket');

    await expect(sourceSocket).toBeVisible();
    const box = await sourceSocket.boundingBox();
    if (!box) throw new Error('Could not get bounding box for source socket');

    // 3. Drag from "result" socket to background
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 100, { steps: 5 });
    await page.mouse.up();

    // 4. Verify context menu and select "Add Output"
    const addOutputItem = page.locator('div:text("Add Output")');
    await expect(addOutputItem).toBeVisible();
    await addOutputItem.click();

    // 5. Verify new node created with name "result"
    const newNode = page.locator('[data-testid="node"].node-output').filter({ has: page.locator(`[data-testid="title"]:has-text("result")`) });
    await expect(newNode).toBeVisible();
  });

  test('Drag from function input and create connected constant', async ({ page }) => {
    const timestamp = Date.now();
    const sheetName = `ConnDropFuncInput_${timestamp}`;

    await createSheet(page, sheetName);
    await zoomOut(page, 2);

    // 1. Add a Function node
    await addNode(page, 'Function', 'MyFunc');

    // 2. Drag from "x" socket to create Constant
    const node = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("MyFunc")`) });
    const xSocket = node.locator('.input').filter({ hasText: 'x' }).locator('.custom-socket');
    await expect(xSocket).toBeVisible();
    const xBox = await xSocket.boundingBox();
    if (!xBox) throw new Error('Could not get bounding box for x socket');

    await page.mouse.move(xBox.x + xBox.width / 2, xBox.y + xBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(xBox.x - 200, xBox.y - 50, { steps: 5 });
    await page.mouse.up();
    await page.locator('div:text("Add Constant")').click();
    
    const xNode = page.locator('[data-testid="node"].node-constant').filter({ has: page.locator(`[data-testid="title"]:has-text("x")`) });
    await expect(xNode).toBeVisible();

    // 3. Drag from "y" socket to create Constant
    const ySocket = node.locator('.input').filter({ hasText: 'y' }).locator('.custom-socket');
    await expect(ySocket).toBeVisible();
    const yBox = await ySocket.boundingBox();
    if (!yBox) throw new Error('Could not get bounding box for y socket');

    await page.mouse.move(yBox.x + yBox.width / 2, yBox.y + yBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(yBox.x - 200, yBox.y + 50, { steps: 5 });
    await page.mouse.up();
    await page.locator('div:text("Add Constant")').click();
    
    const yNode = page.locator('[data-testid="node"].node-constant').filter({ has: page.locator(`[data-testid="title"]:has-text("y")`) });
    await expect(yNode).toBeVisible();

    // 4. Change "x" and "y" values in the table
    const xRow = page.locator('tr').filter({ has: page.locator('td').filter({ hasText: 'x' }) });
    const xInput = xRow.locator('input.sheet-table-input');
    await expect(xInput).toBeVisible();
    await xInput.fill('50');
    await xInput.press('Enter');

    const yRow = page.locator('tr').filter({ has: page.locator('td').filter({ hasText: 'y' }) });
    const yInput = yRow.locator('input.sheet-table-input');
    await expect(yInput).toBeVisible();
    await yInput.fill('10');
    await yInput.press('Enter');

    // 5. Create Output node for "result"
    const resultSocket = node.locator('.output').filter({ hasText: 'result' }).locator('.custom-socket');
    const rBox = await resultSocket.boundingBox();
    if (!rBox) throw new Error('Could not get bounding box for result socket');

    await page.mouse.move(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rBox.x + 200, rBox.y, { steps: 5 });
    await page.mouse.up();
    await page.locator('div:text("Add Output")').click();
    
    const resultNode = page.locator('[data-testid="node"].node-output').filter({ has: page.locator(`[data-testid="title"]:has-text("result")`) });
    await expect(resultNode).toBeVisible();

    // 6. Click Run to ensure calculation
    await runCalculation(page);

    // Verify result in table
    const resultRow = page.locator('tr').filter({ has: page.locator('td').filter({ hasText: 'result' }) });
    await expect(resultRow.locator('span')).toHaveText('60');
  });
});