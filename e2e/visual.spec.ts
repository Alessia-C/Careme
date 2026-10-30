import { test, expect } from '@playwright/test';
import { mockNoSession } from './helpers';

// /login is public and static: `/` is protected and just redirects to it.
test('login page visual baseline @visual', async ({ page }) => {
  await mockNoSession(page);
  await page.goto('/login');
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});
