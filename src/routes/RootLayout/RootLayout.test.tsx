import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RootLayout from './RootLayout';

// Two pages under the root layout, so a navigation can be made between them.
function renderRouter() {
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [
          { path: '/login', element: <p>Login page</p> },
          { path: '/', element: <p>Home page</p> },
        ],
      },
    ],
    { initialEntries: ['/login'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

// jsdom/happy-dom do not lay out the page: the scroll offset is a plain value
// the test sets to simulate a user who scrolled down the login page.
function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true });
}

describe('RootLayout scroll handling', () => {
  beforeEach(() => {
    setScrollY(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to the top after a replace navigation, as after login', async () => {
    // Recorded, not performed: the environment does not implement scrolling.
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const router = renderRouter();
    // Mount already scrolls to the top: clear it so only the navigation counts.
    scrollTo.mockClear();
    setScrollY(800);

    await router.navigate('/', { replace: true });

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });
});
