import { test, expect, type Page } from '@playwright/test';

// Fake API with a session that lives as long as the "cookie" (a flag here):
// login sets it, logout and a server failure leave it as the test decides.
async function mockApi(page: Page, options: { meStatus?: number } = {}) {
  let hasSession = false;

  await page.route('**/api/auth/login', (route) => {
    hasSession = true;
    return route.fulfill({
      status: 200,
      json: {
        user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
        // Far in the future, so the renewal timer never fires during the test.
        expires_at: 4102444800,
      },
    });
  });
  await page.route('**/api/auth/logout', (route) => {
    hasSession = false;
    return route.fulfill({
      status: 200,
      json: { message: 'Logged out successfully' },
    });
  });
  await page.route('**/api/auth/me', (route) => {
    if (options.meStatus) {
      return route.fulfill({ status: options.meStatus, json: {} });
    }
    return hasSession
      ? route.fulfill({
          status: 200,
          json: {
            user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
            // Far in the future, so the renewal timer never fires during the test.
            expires_at: 4102444800,
          },
        })
      : route.fulfill({ status: 401, json: { message: 'No session' } });
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email*').fill('jane@example.com');
  await page.getByLabel('Password*', { exact: true }).fill('Str0ng!pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

test('a reload keeps the user logged in', async ({ page }) => {
  await mockApi(page);
  await login(page);

  await page.reload();

  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('a reload on /login sends a logged-in user to the app', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);

  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('after a logout a reload shows the login without any message', async ({
  page,
}) => {
  await mockApi(page);
  await login(page);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Sign in to your account' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('without a session the app root leads to the login', async ({ page }) => {
  await mockApi(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a server failure leads to the login with an error message', async ({
  page,
}) => {
  await mockApi(page, { meStatus: 500 });

  await page.goto('/');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('alert')).toContainText(
    "We couldn't restore your session",
  );
});
