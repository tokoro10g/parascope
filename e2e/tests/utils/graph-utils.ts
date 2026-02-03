import { type Page, expect, test } from '@playwright/test';

/**
 * Utility to move a node in the Rete editor to prevent overlapping.
 */
export async function moveNode(page: Page, nodeTitle: string, dx: number, dy: number) {
  await test.step(`Move node "${nodeTitle}" by (${dx}, ${dy})`, async () => {
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
  });
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
  await test.step(`Connect ${sourceNodeTitle}:${sourcePortName} to ${targetNodeTitle}:${targetPortName}`, async () => {
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
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 });
    await page.waitForTimeout(200); // Hold for a moment
    await page.mouse.up();
    
    await page.waitForTimeout(500);
  });
}

/**
 * Delete a node from the Rete editor via context menu.
 */
export async function deleteNode(page: Page, nodeTitle: string) {
  await test.step(`Delete node "${nodeTitle}"`, async () => {
    const node = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${nodeTitle}")`) });
    await node.click({ button: 'right' });
    await page.locator('div:text("Delete")').click();
    await expect(node).not.toBeVisible();
  });
}

/**
 * Open the inspector modal for a node via context menu.
 */
export async function openNodeInspector(page: Page, nodeTitle: string) {
  await test.step(`Open inspector for node "${nodeTitle}"`, async () => {
    const node = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${nodeTitle}")`) });
    await node.click({ button: 'right' });
    await page.locator('div:text("Edit")').click();
    await expect(page.locator('.modal-header h2')).toContainText('Edit Node:');
  });
}

/**
 * Get a locator for a port (input/output) on a node.
 */
export function getPortLocator(page: Page, nodeTitle: string, portName: string, type: 'input' | 'output') {
  const node = page.locator('[data-testid="node"]').filter({ has: page.locator(`[data-testid="title"]:has-text("${nodeTitle}")`) });
  return node.locator(`.${type}`).filter({ hasText: portName });
}

/**
 * Rename a port (input or output) of a node via the Inspector.
 */
export async function renamePort(
  page: Page,
  nodeTitle: string,
  oldPortName: string,
  newPortName: string,
  type: 'input' | 'output'
) {
  await test.step(`Rename ${type} port "${oldPortName}" to "${newPortName}" on node "${nodeTitle}"`, async () => {
    await openNodeInspector(page, nodeTitle);

    const columnTitle = type === 'input' ? 'Inputs' : 'Outputs';
    const portInput = page.locator('.io-column')
      .filter({ has: page.locator(`h3:has-text("${columnTitle}")`) })
      .locator('input')
      .filter({ hasValue: oldPortName });

    await expect(portInput).toBeVisible();
    await portInput.fill(newPortName);
    
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    
    // Verify renaming on the node itself
    await expect(getPortLocator(page, nodeTitle, newPortName, type)).toBeVisible();
  });
}

/**
 * Save the current sheet and wait for the success toast.
 */
export async function saveSheet(page: Page) {
  await test.step('Save sheet', async () => {
    await page.click('button[title="Save Sheet"]');
    await expect(page.getByText('Sheet saved successfully').first()).toBeVisible();
    // Also wait for unsaved badge to disappear if it exists
    await expect(page.locator('.unsaved-indicator-badge')).toBeHidden();
  });
}

/**
 * Create a new version of the current sheet.
 * Note: Sheet must be clean (saved) for the Create button to be enabled.
 */
export async function createVersion(page: Page, tag: string, description?: string) {
  return await test.step(`Create version "${tag}"`, async () => {
    await page.click('button:has-text("Versions")');
    await page.locator('input[placeholder*="v1.0"]').fill(tag);
    if (description) {
      await page.locator('textarea[placeholder*="changed"]').fill(description);
    }
    
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/versions') && resp.request().method() === 'POST'),
      page.click('button:has-text("Create Version")')
    ]);
    
    await page.click('.modal-close-btn');
    return response.json();
  });
}

/**
 * Restore a specific version of the sheet from the Version Control modal.
 */
export async function restoreVersion(page: Page, tag: string) {
  await test.step(`Restore version "${tag}"`, async () => {
    await page.click('button:has-text("Versions")');
    
    const vItem = page.locator('.version-list > div').filter({ hasText: tag });
    
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    await vItem.getByRole('button', { name: 'Restore' }).click();
    await page.waitForTimeout(1000); // Wait for restoration reload
  });
}

/**
 * Import another sheet into the current sheet.
 */
export async function importSheet(page: Page, sheetName: string) {
  await test.step(`Import sheet "${sheetName}"`, async () => {
    await page.click('button:has-text("Import Sheet")');
    // Try both .explorer-item and .sheet-item as different components might use them
    const item = page.locator(`.explorer-item:has-text("${sheetName}"), .sheet-item:has-text("${sheetName}")`);
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();
  });
}

/**
 * Run the calculation.
 */
export async function runCalculation(page: Page) {
  await test.step('Run calculation', async () => {
    await page.click('button:has-text("Run")');
  });
}

/**
 * Add a node of a specific type.
 */
export async function addNode(page: Page, type: string, label: string, value?: string) {
  await test.step(`Add ${type} node "${label}"`, async () => {
    await page.click('button:has-text("Add Node")');
    await page.click(`.add-menu-item:has-text("${type}")`);
    
    if (label) {
      await page.locator('#node-label').fill(label);
    }
    if (value !== undefined) {
      await page.locator('#node-value').fill(value);
    }
    
    await page.click('button:has-text("Save")');
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });
}

/**
 * Verify a result in the Variables table.
 */
export async function verifyResult(page: Page, value: string) {
  await test.step(`Verify result is "${value}"`, async () => {
    const resultCell = page.locator(`.sheet-table-cell-value:has-text("${value}")`);
    await expect(resultCell).toBeVisible({ timeout: 10000 });
  });
}

/**
 * Change a value in the Variables table (input or constant).
 */
export async function changeTableInput(page: Page, name: string, value: string) {
  await test.step(`Change table input "${name}" to "${value}"`, async () => {
    const row = page
      .locator('tr')
      .filter({ has: page.locator('td').filter({ hasText: name }) });
    await expect(row).toBeVisible();
    const input = row.locator('input.sheet-table-input, select.sheet-table-input');
    await expect(input).toBeVisible();

    const tagName = await input.evaluate((el) => el.tagName.toLowerCase());

    if (tagName === 'select') {
      await input.selectOption(value);
    } else {
      await input.fill(value);
      await input.press('Enter');
    }
  });
}

/**
 * Create a new folder on the dashboard.
 */
export async function createFolder(page: Page, name: string) {
  await test.step(`Create folder "${name}"`, async () => {
    page.once('dialog', async dialog => {
      await dialog.accept(name);
    });
    await page.click('button:has-text("New Folder")');
    const folderLocator = page.locator(`.explorer-item:has-text("${name}"), .sheet-item:has-text("${name}")`);
    await expect(folderLocator).toBeVisible();
  });
}

/**
 * Zoom out to make more space on the canvas
 */
export async function zoomOut(page: Page, clicks = 3) {
  await test.step(`Zoom out ${clicks} times`, async () => {
    const container = page.locator('.rete');
    const box = await container.boundingBox();
    if (!box) return;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < clicks; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
    }
  });
}

/**
 * Pause for a moment to make the interaction look more human-like in videos.
 * Only active if VIDEO environment variable is set to 'on'.
 */
export async function humanDelay(page: Page, ms = 700) {
  if (process.env.VIDEO === 'on') {
    await test.step(`Human delay ${ms}ms`, async () => {
      await page.waitForTimeout(ms);
    });
  }
}

/**
 * Creates a new sheet with the given name.
 */
export async function createSheet(page: Page, name: string) {
  await test.step(`Create sheet "${name}"`, async () => {
    // Only go to root if we are not already on a dashboard/folder view
    // We check if the Create New Sheet button is visible
    const createBtn = page.locator('button:has-text("Create New Sheet")');
    if (!(await createBtn.isVisible())) {
      await page.goto('/');
    }
    
    await createBtn.click();
    
    // Wait for editor to load
    await expect(page.locator('.rete')).toBeVisible();
    
    // Rename the sheet
    const nameInput = page.getByPlaceholder('Sheet Name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);
    await nameInput.press('Enter');
    
    // Wait for the name to be saved/updated
    await page.waitForTimeout(500);
  });
}

/**
 * Logs in to the application with the given username.
 */
export async function login(page: Page, username = 'TestUser') {
  await test.step(`Login as "${username}"`, async () => {
    await page.goto('/');
    
    // Wait for either the dashboard or the login form
    const loginInput = page.locator('input[placeholder="Your Name"]');
    const dashboardButton = page.locator('button:has-text("Create New Sheet")');
    
    await Promise.race([
      loginInput.waitFor({ state: 'visible' }).catch(() => {}),
      dashboardButton.waitFor({ state: 'visible' }).catch(() => {})
    ]);

    if (await loginInput.isVisible()) {
      await loginInput.fill(username);
      await page.click('button:has-text("Continue")');
      // Ensure we reached the dashboard
      await expect(page.locator('button:has-text("Create New Sheet")')).toBeVisible({ timeout: 10000 });
    }
  });
}
