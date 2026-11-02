import { test, expect, type Page } from '@playwright/test';

const PAGE_SIZE = 12;

const makeProducts = (count: number, start = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${start + index}`,
    name: `Product ${start + index}`,
    brand: 'MAC',
    category: 'makeup',
    status: 'new',
  }));

// Fake API with a logged-in user. `answer` builds the response of every
// GET /api/products from its query string, so no real data is touched.
async function mockApi(
  page: Page,
  answer: (params: URLSearchParams) => { products: unknown[]; total: number },
) {
  const requests: string[] = [];

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
      const { searchParams } = new URL(route.request().url());
      requests.push(searchParams.toString());
      return route.fulfill({ status: 200, json: answer(searchParams) });
    },
  );

  return requests;
}

test('the list shows the products of the user', async ({ page }) => {
  await mockApi(page, () => ({
    products: [
      {
        id: 'p1',
        name: 'Eye Palette',
        brand: 'MAC',
        category: 'makeup',
        status: 'new',
      },
      {
        id: 'p2',
        name: 'Serum',
        brand: 'Cerave',
        category: 'skincare',
        status: 'used',
      },
    ],
    total: 2,
  }));
  await page.goto('/');

  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('Eye Palette');
  await expect(cards.first()).toContainText('Makeup');
  await expect(cards.first()).toContainText('New');
  await expect(cards.first()).toContainText('MAC');
  await expect(cards.nth(1)).toContainText('Skincare');
  await expect(cards.nth(1)).toContainText('Used');
});

test('the search filters the list and clearing it restores it', async ({
  page,
}) => {
  await mockApi(page, (params) =>
    params.get('search') === 'serum'
      ? { products: makeProducts(1), total: 1 }
      : { products: makeProducts(3), total: 3 },
  );
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(3);

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('serum');
  await search.press('Enter');
  await expect(page.getByRole('article')).toHaveCount(1);

  await search.fill('');
  await expect(page.getByRole('article')).toHaveCount(3);
});

test('a search without matches says so', async ({ page }) => {
  await mockApi(page, (params) =>
    params.has('search')
      ? { products: [], total: 0 }
      : { products: makeProducts(3), total: 3 },
  );
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(3);

  const search = page.getByRole('searchbox', { name: 'Search' });
  await search.fill('eyeliner');
  await search.press('Enter');

  await expect(
    page.getByRole('heading', { name: 'No product found' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('Load more adds the next page', async ({ page }) => {
  const total = PAGE_SIZE + 2;
  const requests = await mockApi(page, (params) =>
    params.get('offset') === '0'
      ? { products: makeProducts(PAGE_SIZE), total }
      : { products: makeProducts(2, PAGE_SIZE), total },
  );
  await page.goto('/');
  await expect(page.getByRole('article')).toHaveCount(PAGE_SIZE);

  await page.getByRole('button', { name: 'Load more' }).click();

  await expect(page.getByRole('article')).toHaveCount(total);
  await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden();
  expect(requests).toEqual([
    `offset=0&limit=${PAGE_SIZE}`,
    `offset=${PAGE_SIZE}&limit=${PAGE_SIZE}`,
  ]);
});

test('an error can be retried', async ({ page }) => {
  let failing = true;
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        user: { id: 'user-1', email: 'jane@example.com', role: 'user' },
        expires_at: 4102444800,
      },
    }),
  );
  await page.route(
    (url) => url.pathname === '/api/products',
    (route) =>
      failing
        ? route.fulfill({ status: 500, json: { message: 'Server error' } })
        : route.fulfill({
            status: 200,
            json: { products: makeProducts(2), total: 2 },
          }),
  );
  await page.goto('/');

  await expect(page.getByRole('alert')).toContainText(
    'We couldn’t load your products',
  );

  failing = false;
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByRole('article')).toHaveCount(2);
});
