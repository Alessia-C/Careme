# Feature documentation

Each user-facing feature has one document in this folder. It describes the behavior, the business rules, the data, the access rules and the tests. The technical contract of the API endpoints lives in [`docs/api/`](../api/README.md) instead.

## How to add or update a feature doc

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `docs/features/<feature-name>.md`.
2. Fill in every section. Write "None" for sections that don't apply.
3. Add a row to the **Features** table below.
4. Ship the doc in the same PR as the feature. A change to the feature's behavior must update its doc too.

## Features

| Feature                               | Status      | Description                                                                                                                                         |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [App layout](app-layout.md)           | In progress | Shell for protected pages: skip link, header with logo and Logout button, main area.                                                                |
| [Login](login.md)                     | In progress | Public `/login` form: generic errors, session in an HttpOnly cookie, safe redirect to `next`.                                                       |
| [Signup](signup.md)                   | In progress | Public `/signup` form: validation, generic errors, "check your email" screen after a 201.                                                           |
| [Session restore](session-restore.md) | In progress | On every page load the app asks `GET /api/auth/me` to restore the session; loading state, error message if the check fails.                         |
| [Session renewal](session-renewal.md) | In progress | Renews the session ~60 s before expiry while the user is active; idle users go to `/login`; refresh token in an HttpOnly cookie; tabs stay in sync. |
| [Logout](logout.md)                   | In progress | Header Logout button: revokes the session, cookie deleted by the API, redirect to `/login`, other tabs follow, warning if not confirmed.            |
