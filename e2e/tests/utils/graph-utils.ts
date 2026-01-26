import { type Page, expect } from '@playwright/test';

/**
 * Utility to move a node in the Rete editor to prevent overlapping.
 */
export async function moveNode(page: Page, nodeTitle: string, dx: number, dy: number) {
  const node = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${nodeTitle}")`) });
  const titleBar = node.locator('[data-testid="title"]');
  
  await expect(titleBar).toBeVisible();
  const box = await titleBar.boundingBox();
  if (!box) throw new Error(`Could not find bounding box for node title: ${nodeTitle}`);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/**
 * Utility to connect two nodes in the Rete editor.
 */
export async function connectNodes(
  page: Page,
  sourceNodeTitle: string,
  sourcePortName: string,
  targetNodeTitle: string,
  targetPortName: string
) {
  // 1. Locate source socket
  const sourceNode = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${sourceNodeTitle}")`) });
  const sourceSocket = sourceNode
    .locator('.output')
    .filter({ hasText: sourcePortName })
    .locator('.custom-socket');

  // 2. Locate target socket
  const targetNode = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${targetNodeTitle}")`) });
  const targetSocket = targetNode
    .locator('.input')
    .filter({ hasText: targetPortName })
    .locator('.custom-socket');

  // Wait for sockets to be attached to DOM and visible
  await expect(sourceSocket).toBeVisible({ timeout: 5000 });
  await expect(targetSocket).toBeVisible({ timeout: 5000 });

  const sourceBox = await sourceSocket.boundingBox();
  const targetBox = await targetSocket.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error(`Could not get bounding box for sockets: ${sourceNodeTitle}:${sourcePortName} -> ${targetNodeTitle}:${targetPortName}`);
  }

  // drag and drop
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  // Move in steps to ensure Rete registers the movement path
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
  await page.waitForTimeout(200); // Hold for a moment
  await page.mouse.up();
  
  await page.waitForTimeout(500);
}

/**
 * Zoom out to make more space on the canvas
 */
export async function zoomOut(page: Page, clicks = 3) {
  const container = page.locator('.rete');
  const box = await container.boundingBox();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < clicks; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
  }
}
