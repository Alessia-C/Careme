import type { Page } from '@playwright/test';

// The app asks GET /api/auth/me on every page load to restore the session.
// Without a mock the request would hit the static preview server, not the API.
export async function mockNoSession(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      json: { message: 'Missing or invalid authorization header' },
    }),
  );
}

// The home page asks GET /api/products as soon as it opens. For a spec that is
// not about the list, an empty one keeps the page out of its loading state
// (its role="status" would clash with the status messages the spec checks).
export async function mockEmptyProducts(page: Page) {
  await page.route(
    (url) => url.pathname === '/api/products',
    (route) => route.fulfill({ status: 200, json: { products: [], total: 0 } }),
  );
}
