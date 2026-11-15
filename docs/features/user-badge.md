# User badge

A round badge in the header, next to Logout, that shows the logged-in user's initials, so the user can see at a glance whose session the app is using.

|               |                                                                                   |
| ------------- | --------------------------------------------------------------------------------- |
| **Status**    | In progress                                                                       |
| **Issue**     | [#164](https://github.com/Alessia-C/Careme/issues/164)                            |
| **Users**     | Logged-in user                                                                    |
| **Pages**     | Every protected page (rendered by [`AppLayout`](app-layout.md))                   |
| **Endpoints** | [`/api/auth/login`](../api/auth-login.md) and [`/api/auth/me`](../api/auth-me.md) |

## Behavior

- The header shows a circle with two letters: the first letter of the first name and the first letter of the last name, in uppercase (for example "JD" for Jane Doe).
- The names come from the session: they are returned by the login and `/me` responses and stored in the auth store, so the badge is there after a login and after a page reload.
- If the user has no first name or no last name, only one letter is shown. If both are empty, the badge shows the first letter of the email.
- The badge is not interactive: it is not a button and not a link, and it cannot be focused.
- The badge is shown only when there is a session. Without one (for example while the session is being restored) nothing is rendered in its place.
- Accessible name: the full name ("Jane Doe"), or the email when no name is set. The initials are hidden from screen readers, so the name is read once and not spelled letter by letter.
- The visual style is provisional (a 32px circle with the primary dark color and white text) until the Figma frame is available.
- Empty, loading and error states: None (the badge is either shown with the stored session or not shown at all).

## Business rules

- Initials are taken by code point, not by UTF-16 unit, so accented letters and characters outside the Latin alphabet are kept whole ("Émilie" gives "É", "李" gives "李").
- Names are trimmed before taking the initials; blank names count as empty.
- A `null` name in the database is returned as an empty string by the API.

## Data

Reads `profiles.first_name` and `profiles.last_name` for the caller, in the same query that reads `profiles.role` (see [`api/_lib/auth.ts`](../../api/_lib/auth.ts)). The feature writes nothing and needs no migration.

## Security and access

- Each user reads their own names, which RLS already allows for the owner of the profile.
- The names are personal data: the `/api/auth/me` response is sent with `Cache-Control: no-store`, and the names are kept only in memory (the auth store), never in browser storage.
- A `blocked` user gets no names: the API answers `403` and never returns the names, so the badge is never shown for a blocked account.
- Names are never used for authorization: the role is still the only value that matters for access, and it is checked by the API and by RLS.

## Tests

- Unit tests:
  - [`src/lib/userInitials.test.ts`](../../src/lib/userInitials.test.ts): initials and full name, empty names, accents, characters outside the Latin alphabet.
  - [`src/routes/AppLayout/components/UserBadge/UserBadge.test.tsx`](../../src/routes/AppLayout/components/UserBadge/UserBadge.test.tsx): initials, accessible name, initials hidden from assistive technology, email fallback, not interactive.
  - [`src/routes/AppLayout/components/AppHeader/AppHeader.test.tsx`](../../src/routes/AppLayout/components/AppHeader/AppHeader.test.tsx): badge shown with the session, placed before Logout, not shown without a session.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): the names are parsed from login and `/me` responses; a response without names is a failure.
  - [`api/_lib/auth.test.ts`](../../api/_lib/auth.test.ts), [`api/auth/_routes/login.test.ts`](../../api/auth/_routes/login.test.ts), [`api/auth/_routes/me.test.ts`](../../api/auth/_routes/me.test.ts): names read from the profile, `null` returned as `""`, unexpected types return `500`.
- E2E tests: None yet.

## Open decisions

- Final visual design (size, colors, font, spacing next to Logout) from the Figma frame, which is not available yet. The current style is provisional.
- Contrast of the provisional colors (primary-900 background, white text) is to be verified with the accessibility audit.
- A link from the badge to a profile page: out of scope here, it will come with the profile page.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-11-14 | Initial implementation | TBD |
