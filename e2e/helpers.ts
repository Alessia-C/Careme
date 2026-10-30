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
