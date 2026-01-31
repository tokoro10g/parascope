/**
 * Multi-user Collaboration
 * Goal: Verify that locking prevents concurrent edits and allows seamless handover.
 */

import { test, expect } from '@playwright/test';
import { login, addNode } from './utils/graph-utils';

test.describe('Collaboration & Locking', () => {
  test('Two users interacting with the same sheet', async ({ browser }, testInfo) => {
    const recordVideo = testInfo.project.use.video === 'on' ? { dir: testInfo.outputPath('videos') } : undefined;

    // 1. User A creates a sheet
    const contextA = await browser.newContext({ recordVideo });
    const pageA = await contextA.newPage();
    await login(pageA, 'User A');
    
    await pageA.click('button:has-text("Create New Sheet")');
    await pageA.waitForURL('**/sheet/**');
    const sheetUrl = pageA.url();

    // 2. User B opens the same sheet
    const contextB = await browser.newContext({ recordVideo });
    const pageB = await contextB.newPage();
    await login(pageB, 'User B');
    
    await pageB.goto(sheetUrl);
    
    // User B should see lock banner
    await expect(pageB.locator('.lock-banner')).toContainText('Currently being edited by User A');
    await expect(pageB.getByRole('button', { name: 'Take Over' })).toBeVisible();
    
    // User A adds a node (to prove they can)
    await addNode(pageA, 'Constant', 'Shared Node');
    
    // 3. User B takes over
    await pageB.getByRole('button', { name: 'Take Over' }).click();
    await pageB.click('button:has-text("Confirm Take Over")');
    
    // User B should verify lock warning is gone, but draft banner should be visible
    await expect(pageB.locator('.lock-banner')).not.toBeVisible();
    await expect(pageB.locator('.draft-status-banner')).toBeVisible();
    await expect(pageB.locator('.draft-status-banner')).toContainText('You are editing the Draft version');
    
    // User B makes a change
    await addNode(pageB, 'Comment', 'Collaboration comment');
    
    // User A checks lock status (wait for polling)
    // Polling interval is 10s. We wait up to 15s.
    await expect(pageA.locator('.lock-banner')).toContainText('Currently being edited by User B', { timeout: 15000 });
    
    await contextA.close();
    await contextB.close();
  });
});