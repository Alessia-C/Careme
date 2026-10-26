import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'Str0ng!pass';

async function fillValidForm(page: Page) {
  await page.getByLabel('First Name*').fill('Jane');
  await page.getByLabel('Last Name*').fill('Doe');
  await page.getByLabel('Email*').fill('jane@example.com');
  await page.getByLabel('Password*', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm Password*').fill(PASSWORD);
}

test('signup shows the check-email message after a successful request', async ({
  page,
}) => {
  await page.route('**/api/auth/signup', (route) =>
    route.fulfill({ status: 201, json: { message: 'Signup successful' } }),
  );

  await page.goto('/signup');
  const submit = page.getByRole('button', { name: 'Create account' });
  await expect(submit).toBeDisabled();

  await fillValidForm(page);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(
    page.getByRole('heading', { name: 'Account created successfully!' }),
  ).toBeVisible();
});

test('signup shows a generic error when the API fails', async ({ page }) => {
  await page.route('**/api/auth/signup', (route) =>
    route.fulfill({
      status: 400,
      json: { message: 'Unable to complete signup' },
    }),
  );

  await page.goto('/signup');
  await fillValidForm(page);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('alert')).toContainText('Something went wrong');
});
