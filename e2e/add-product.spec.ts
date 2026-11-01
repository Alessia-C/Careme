import { test, expect, type Page } from '@playwright/test';

interface ApiOptions {
  // What GET /api/products?name=&brand=&limit=1 answers.
  existingProducts?: Array<{ id: string; name: string; brand: string }>;
}

// Fake API with a logged-in user and the two products endpoints the drawer
// uses. It records the body of every POST so a test can check what was sent.
async function mockApi(page: Page, options: ApiOptions = {}) {
  const created: unknown[] = [];
  const existingProducts = options.existingProducts ?? [];

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
        // Far in the future, so the renewal timer never fires during the test.
        expires_at: 4102444800,
      },
    }),
  );
  await page.route(
    (url) => url.pathname === '/api/products',
    (route) => {
      if (route.request().method() === 'POST') {
        created.push(route.request().postDataJSON());
        return route.fulfill({
          status: 201,
          json: { product: { id: 'new' }, duplicate: false, duplicateOf: null },
        });
      }
      return route.fulfill({
        status: 200,
        json: { products: existingProducts, total: existingProducts.length },
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

test('a product that already exists is not created', async ({ page }) => {
  const created = await mockApi(page, {
    existingProducts: [{ id: '1', name: 'Eye Palette', brand: 'MAC' }],
  });

  await openDrawerAndFill(page);
  const submit = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add Product' });
  await submit.click();

  await expect(page.getByText('Duplicate product found')).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(created).toEqual([]);

  // Changing the name clears the warning and lets the user add it.
  await page.getByLabel('Name*').fill('Eye Palette Mini');
  await expect(page.getByText('Duplicate product found')).toBeHidden();
  await expect(submit).toBeEnabled();
});

test('Cancel closes the drawer without creating anything', async ({ page }) => {
  const created = await mockApi(page);

  await openDrawerAndFill(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(created).toEqual([]);
});
