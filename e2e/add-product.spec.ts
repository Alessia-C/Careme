import { test, expect, type Page } from '@playwright/test';
import { mockSession } from './helpers';

// Fake API with a logged-in user and the products endpoint the page and the
// drawer use. It records the body of every POST so a test can check what was
// sent.
async function mockApi(page: Page) {
  const created: unknown[] = [];

  await mockSession(page);
  await page.route(
    (url) => url.pathname === '/api/products',
    (route) => {
      // The page also asks for the list: a user with no products yet.
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: { products: [], total: 0 } });
      }
      created.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        json: { product: { id: 'new' }, duplicate: false, duplicateOf: null },
      });
    },
  );

  return created;
}

async function openDrawerAndFill(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByRole('dialog', { name: 'Add Product' })).toBeVisible();
  await page.getByLabel('Name*').fill('Eye Palette');
  await page.getByLabel('Brand*').fill('MAC');
}

test('the first product is added from the empty state', async ({ page }) => {
  const created = await mockApi(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Add your product' }),
  ).toBeVisible();

  await openDrawerAndFill(page);
  await page.getByLabel('Category*').selectOption('skincare');
  await page.getByLabel('Note').fill('Warm neutrals');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add Product' })
    .click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(created).toEqual([
    {
      name: 'Eye Palette',
      brand: 'MAC',
      category: 'skincare',
      status: 'new',
      note: 'Warm neutrals',
    },
  ]);
});

test('Cancel closes an untouched drawer without asking', async ({ page }) => {
  const created = await mockApi(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(created).toEqual([]);
});

test('Cancel with typed text asks first, and Continue editing keeps it', async ({
  page,
}) => {
  const created = await mockApi(page);

  await openDrawerAndFill(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(
    page.getByRole('alertdialog', { name: 'Unsaved changes' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue editing' }).click();

  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByLabel('Name*')).toHaveValue('Eye Palette');
  expect(created).toEqual([]);
});

test('Esc with typed text asks first, and Discard closes and clears', async ({
  page,
}) => {
  const created = await mockApi(page);

  await openDrawerAndFill(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(created).toEqual([]);

  // Opened again, the form starts empty.
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByLabel('Name*')).toHaveValue('');
});

test('Back with typed text asks first, and Discard leaves the page', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/login');
  await page.goto('/');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Name*').fill('Eye Palette');

  await page.goBack();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Discard' }).click();

  await expect(page).toHaveURL(/\/login/);
});

test('the focus goes back to the Add product button after Discard', async ({
  page,
}) => {
  await mockApi(page);

  await openDrawerAndFill(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add product' })).toBeFocused();
});
