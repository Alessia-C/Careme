import { test, expect } from '@playwright/test';
import { mockNoSession } from './helpers';

test('la homepage si carica', async ({ page }) => {
  await mockNoSession(page);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();

  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('body')).toBeVisible();
  await expect(page).toHaveTitle(/Careme/i);
  expect(errors).toEqual([]);
});
