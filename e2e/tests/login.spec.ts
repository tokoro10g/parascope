/**
 * User Authentication
 * Goal: Verify that users can log in and access their dashboard.
 */

import { test, expect } from '@playwright/test';
import { login } from './utils/graph-utils';

test.describe('Login', () => {
  test('simple login test', async ({ page }) => {
    await login(page, 'TestUser');
    await expect(page.getByText('TestUser')).toBeVisible();
    await expect(page.locator('button:has-text("Create New Sheet")')).toBeVisible();
  });
});
