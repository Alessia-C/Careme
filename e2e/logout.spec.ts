import { test, expect, type Page } from '@playwright/test';

async function mockApi(page: Page) {
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
      },
    }),
  );
  await page.route('**/api/auth/logout', (route) =>
    route.fulfill({
      status: 200,
      json: { message: 'Logged out successfully' },
    }),
  );
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email*').fill('jane@example.com');
  await page.getByLabel('Password*', { exact: true }).fill('Str0ng!pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

test('logout leads to the login and back does not reopen the app', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The redirect replaces the protected page in the history, so going back
  // never reopens it. Where it lands depends on the browser (Chromium goes to
  // about:blank, Firefox stays on /login), so only the app root is excluded.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
});

test('logout in one tab logs out the other tabs of the browser', async ({
  context,
  page,
}) => {
  await mockApi(page);
  await login(page);
  // Same context = same browser profile, so the BroadcastChannel is shared.
  const otherTab = await context.newPage();
  await mockApi(otherTab);
  await login(otherTab);

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(otherTab).toHaveURL(/\/login$/);
});

test('a logout that cannot reach the server warns and can be closed', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);
  // Overrides the success mock: the request never reaches the server.
  await page.route('**/api/auth/logout', (route) => route.abort());

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText(
    "We couldn't confirm the sign out",
  );

  await page.getByRole('button', { name: 'Close message' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the signed out message can be closed before it disappears', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page.getByRole('status')).toContainText(
    'You have been signed out',
  );
  await page.getByRole('button', { name: 'Close message' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
});
