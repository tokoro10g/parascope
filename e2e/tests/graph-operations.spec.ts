/**
 * Graph Operations Verification
 * Goal: Verify utility functions like deleteNode and renamePort.
 */

import { test, expect } from '@playwright/test';
import {
  zoomOut,
  deleteNode,
  renamePort,
  login,
  createSheet,
  addNode,
} from './utils/graph-utils';

test.describe('Graph Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'ops_user');
  });

  test('Delete Node and Rename Port', async ({ page }) => {
    const timestamp = Date.now();
    const sheetName = `OpsSheet_${timestamp}`;

    // Create Sheet
    await createSheet(page, sheetName);
    await zoomOut(page, 2);

    // Add Function Node
    await addNode(page, 'Function', 'TestFunc');

    // Rename Input Port
    await renamePort(page, 'TestFunc', 'x', 'my_input', 'input');

    // Rename Output Port
    await renamePort(page, 'TestFunc', 'result', 'my_output', 'output');

    // Delete Node
    await deleteNode(page, 'TestFunc');
  });
});