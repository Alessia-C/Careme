# Feature documentation

Each user-facing feature has one document in this folder. It describes the behavior, the business rules, the data, the access rules and the tests. The technical contract of the API endpoints lives in [`docs/api/`](../api/README.md) instead.

## How to add or update a feature doc

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `docs/features/<feature-name>.md`.
2. Fill in every section. Write "None" for sections that don't apply.
3. Add a row to the **Features** table below.
4. Ship the doc in the same PR as the feature. A change to the feature's behavior must update its doc too.

## Features

| Feature                               | Status      | Description                                                                                                                                                                                                             |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [App layout](app-layout.md)           | In progress | Shell for protected pages: skip link, header with logo and Logout button, main area.                                                                                                                                    |
| [Login](login.md)                     | In progress | Public `/login` form: generic errors, session in an HttpOnly cookie, safe redirect to `next`.                                                                                                                           |
| [Signup](signup.md)                   | In progress | Public `/signup` form: validation, generic errors, "check your email" screen after a 201.                                                                                                                               |
| [Session restore](session-restore.md) | In progress | On every page load the app asks `GET /api/auth/me` to restore the session; loading state, error message if the check fails.                                                                                             |
| [Session renewal](session-renewal.md) | In progress | Renews the session ~60 s before expiry while the user is active; idle users go to `/login`; refresh token in an HttpOnly cookie; tabs stay in sync.                                                                     |
| [Session expiry](session-expiry.md)   | In progress | Idle timeout or `401` from a protected endpoint: session revoked, redirect to `/login` with "Your session expired due to inactivity", other tabs follow.                                                                |
| [Logout](logout.md)                   | In progress | Header Logout button: revokes the session, cookie deleted by the API, redirect to `/login`, other tabs follow, warning if not confirmed.                                                                                |
| [Add product](add-product.md)         | In progress | Home page drawer to add a product: inline validation, generic and rate-limit errors, empty state on first access.                                                                                                       |
| [Product creation](product-create.md) | In progress | Backend `POST /api/products`: validated product owned by the caller; duplicate name+brand is flagged in the response, not blocked.                                                                                      |
| [Product list](product-list.md)       | In progress | Home page list of the caller's products (cards, "Load more", search on name or brand, states) on top of `GET /api/products`.                                                                                            |
| [Product detail](product-detail.md)   | In progress | Drawer opened from "Detail" on the home page, on top of `GET /api/products/:id`: all fields with the note; `404` and `403` shown as not found; "Update" switches it to edit mode.                                       |
| [Product update](product-update.md)   | In progress | Edit mode of the detail drawer on top of `PUT /api/products/:id`: inline validation, unsaved-changes modal, cache update; the API validates the whole product and answers `404` for a missing, foreign or malformed id. |
| [Product delete](product-delete.md)   | In progress | Delete from the list or the detail drawer after a confirmation (error with "Try again", success message), on top of `DELETE /api/products/:id`.                                                                         |
