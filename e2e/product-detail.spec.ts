import { test, expect, type Page } from '@playwright/test';

const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Eye Palette',
  brand: 'MAC',
  category: 'makeup',
  status: 'new',
};

const detail = { ...product, note: 'Warm Neutrals, best seller palette' };

// Fake API with a logged-in user: the list holds one product, and `detailStatus`
// is the status of every GET /api/products/:id (200 answers with the product).
async function mockApi(page: Page, detailStatus = () => 200) {
  const detailRequests: string[] = [];

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
    (route) =>
      route.fulfill({ status: 200, json: { products: [product], total: 1 } }),
  );
  await page.route(
    (url) => url.pathname === `/api/products/${product.id}`,
    (route) => {
      detailRequests.push(route.request().url());
      const status = detailStatus();
      return route.fulfill(
        status === 200
          ? { status, json: { product: detail } }
          : { status, json: { message: 'Product not found' } },
      );
    },
  );

  return detailRequests;
}

test('the Detail button opens the product in a drawer', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();

  const drawer = page.getByRole('dialog', { name: 'Eye Palette' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('MAC');
  await expect(drawer).toContainText('Makeup');
  await expect(drawer).toContainText('New');
  await expect(drawer).toContainText('Warm Neutrals, best seller palette');
  await expect(drawer.getByRole('button', { name: 'Update' })).toBeEnabled();
  await expect(drawer.getByRole('button', { name: 'Delete' })).toBeEnabled();
});

// Run on the three browsers: Safari does not focus a button when it is
// clicked, which could break the native return of the focus.
test('Esc closes the drawer and gives the focus back to Detail', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/');
  const detailButton = page.getByRole('button', { name: 'Detail Eye Palette' });
  await detailButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Eye Palette' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Eye Palette' })).toBeHidden();
  await expect(detailButton).toBeFocused();
});

test('the close button closes the drawer', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();

  await page
    .getByRole('dialog', { name: 'Eye Palette' })
    .getByRole('button', { name: 'Close' })
    .click();

  await expect(page.getByRole('dialog', { name: 'Eye Palette' })).toBeHidden();
});

test('a server error can be tried again', async ({ page }) => {
  let status = 500;
  await mockApi(page, () => status);
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();

  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load the product',
  );

  status = 200;
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByRole('dialog', { name: 'Eye Palette' })).toBeVisible();
});

test('a product that is not found has no Try again', async ({ page }) => {
  const requests = await mockApi(page, () => 404);
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();

  await expect(page.getByRole('alert')).toContainText('Product not found');
  await expect(
    page.getByRole('button', { name: 'Try again' }),
  ).not.toBeVisible();
  // A missing product is not asked for again.
  expect(requests).toHaveLength(1);
});

test('on a phone the close button is there, as the drawer has no Cancel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Detail Eye Palette' }).click();

  const drawer = page.getByRole('dialog', { name: 'Eye Palette' });
  await drawer.getByRole('button', { name: 'Close' }).click();

  await expect(drawer).toBeHidden();
});
