# App layout

A shared shell (skip link, header with logo and Logout button, main content area) that wraps every protected page, so all logged-in pages look and behave the same and are easy to navigate with a keyboard.

|               |                                                                           |
| ------------- | ------------------------------------------------------------------------- |
| **Status**    | In progress                                                               |
| **Issue**     | [#56](https://github.com/Alessia-C/Careme/issues/56)                      |
| **Users**     | Logged-in user                                                            |
| **Pages**     | `/` (see [`src/router.tsx`](../../src/router.tsx))                        |
| **Endpoints** | None (the Logout button uses [`/api/auth/logout`](../api/auth-logout.md)) |

## Behavior

- Every protected route is rendered inside `AppLayout`, which sits under `ProtectedRoute` in the route tree. Public routes (`/login`, `/signup`) do not use it.
- `AppLayout` renders, in order:
  1. A skip link "Skip to content" (`href="#main"`). It is the first focusable element and is moved off-screen until it receives focus, then it becomes visible. Activating it moves to `<main id="main">`.
  2. `AppHeader` (a `<header>`, so the `banner` landmark).
  3. `<main id="main" tabindex="-1">` containing the current page (`<Outlet />`). The `tabindex="-1"` lets the skip link move focus into `main` in every browser.
- `AppHeader` shows:
  - The "Careme" logo on the left. It is the SVG [`src/assets/icons/logo.svg`](../../src/assets/icons/logo.svg) used as a CSS mask, colored with `--color-primary-800`. It has `role="img"` and `aria-label="Careme"`.
  - A "Logout" button on the right (`Button`, secondary variant, text appearance) with a log-out icon. It logs the user out, see [Logout](logout.md).
  - A visually hidden live region (`role="status"`, always in the DOM) that reads "Logging out…" while the logout request is in progress, see [Logout](logout.md).
- Responsive behavior (breakpoint 768px):
  - Desktop (>= 768px): header side padding is 61px; the icon and the "Logout" text are both visible.
  - Mobile (< 768px): header side padding is 16px (`--space-16`); only the icon is shown. The "Logout" label is visually hidden but still the accessible name of the button. The button area is at least 44x44px.
  - The `<main>` padding follows the same pattern (16px on mobile, 24px vertical and 61px horizontal on desktop) and its minimum height is the viewport minus the 64px header.
- Hover and keyboard focus on the Logout button show a 1px border in the text color and no text underline (no double underline).
- The header has a fixed height of 64px and a 1px bottom border.
- Empty, loading and error states: None (the shell has no data of its own).

## Business rules

- Every protected page is rendered inside the layout; a new protected page is added as a child of the `AppLayout` route in `src/router.tsx`.
- The skip link is always the first element in the tab order, and the Logout button is the next focusable element after it.
- The logo is exposed to assistive technology as an image named "Careme"; the Logout icon is decorative (`aria-hidden`).
- `Button` accepts an optional `icon` prop (a decorative `ReactNode`) rendered before the label. The label is always rendered inside a `<span>`.
- The `secondary` variant of `Button` uses `--color-grey-900` as its base color (it was `--color-grey-600`, which failed the 4.5:1 contrast minimum for 14px text). This changes every secondary button in the app, not only the Logout button.
- Each page sets its own document title: `/login` "Login – Careme", `/signup` "Sign up – Careme", `/` "Careme".
- Logout behavior is documented in [Logout](logout.md). `AppLayout` also mounts `useLogoutSync`, which ends this tab's session when another tab logs out.

## Data

None. The feature does not read or write any table.

## Security and access

- The layout is only reached through `ProtectedRoute`, which redirects unauthenticated users to `/login?next=<path>`. This is a UI-level check; data access is still enforced by the API and RLS.
- A `blocked` user: not handled by this feature (the layout shows no user data and calls no API).
- Nothing is writable from this feature.

## Tests

- Unit tests:
  - [`src/routes/AppLayout.test.tsx`](../../src/routes/AppLayout.test.tsx): header and page content inside `main`, skip link targets `#main`, `main` is focusable with `tabindex="-1"`, skip link first in tab order, Logout reached right after the skip link.
  - [`src/routes/AppHeader.test.tsx`](../../src/routes/AppHeader.test.tsx): logo exposed as image "Careme", Logout button with its label as accessible name, header in the banner landmark.
  - [`src/components/Button/Button.test.tsx`](../../src/components/Button/Button.test.tsx): `Button` with the new `icon` prop and label in a `<span>`.
  - [`src/router.test.tsx`](../../src/router.test.tsx): the app header is shown on protected pages; the document title is set on `/login` and `/signup`.
- E2E tests: [`e2e/logout.spec.ts`](../../e2e/logout.spec.ts) covers the Logout button and tab sync (see [Logout](logout.md))

## Open decisions

- None for logout: it is implemented, see [Logout](logout.md).
- Visual/responsive behavior (breakpoint, hidden label, 44x44px target) is defined only in CSS and is not covered by automated tests.

## Changelog

| Date       | Change                                       | PR  |
| ---------- | -------------------------------------------- | --- |
| 2026-10-25 | Initial implementation                       | TBD |
| 2026-10-25 | Logout button wired, `useLogoutSync` mounted | TBD |
