# Signup

Lets a new visitor create a Careme account with first name, last name, email and password. After a successful request the user must confirm the email address before using the account.

|               |                                                          |
| ------------- | -------------------------------------------------------- |
| **Status**    | In progress                                              |
| **Issue**     | [#57](https://github.com/Alessia-C/Careme/issues/57)     |
| **Users**     | Anonymous                                                |
| **Pages**     | `/signup` (see [`src/router.tsx`](../../src/router.tsx)) |
| **Endpoints** | [`POST /api/auth/signup`](../api/auth-signup.md)         |

## Behavior

1. The user opens `/signup`. The page has a form panel with the Careme logo and a decorative image panel (empty `alt`). The document title is "Sign up – Careme" and the heading is "Create your account".
2. The form has five fields: First Name\*, Last Name\*, Email\*, Password\*, Confirm Password\*. The password fields have a show/hide toggle. Below the button there is a "Log in" link to `/login`.
3. Validation:
   - First name, last name and email show an inline error only after the field has been blurred (touched): "First name is required", "Last name is required", "Enter a valid email address".
   - The password checklist (minimum 8 characters, maximum 20 characters, 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character) is visible only while the Password field has focus. After the field is blurred the checklist disappears and the field is marked invalid (error status, no text message) while the password does not meet the policy.
   - Confirm Password shows a single "Passwords match" requirement, visible only while that field has focus; after blur the field is marked invalid while the value differs from Password. It only checks that the value is not empty and equal to Password. It does not re-check the password policy.
4. The "Create account" button is disabled until every field is valid: non-blank first name, last name and email in a valid format, a password that satisfies the policy, and a confirmation equal to the password.
5. On submit the page sends `POST /api/auth/signup` with `firstName`, `lastName`, `email` and `password`. While the request is in progress the button is disabled and its label is "Creating account…". A second submit is ignored.
6. On success (`201`) the form is replaced by a "check your email" screen: heading "Account created successfully!" and the text "Welcome to Careme! Please check your email for confirmation." The document title becomes "Account created – Careme" and focus moves to the heading so screen reader users hear the result. Supabase email confirmation is enabled, so the user is not logged in automatically and no session is created. The screen has no link or button.
7. On failure the form stays on screen with the entered values and an error `Feedback` (role alert) titled "Something went wrong" above the fields. The button is enabled again so the user can retry:
   - `429`: "Too many attempts. Please wait a moment and try again."
   - any other non-2xx status, or a network error: "We couldn’t complete your request. Please try again."

## Business rules

- Error messages are always generic and never say whether an email is already registered (anti-enumeration). The API answers a duplicate email with the same generic `400` as other failures, so the UI cannot tell them apart and shows no link to reset the password.
- The only error with its own message is the rate limit (`429`).
- The password policy is defined once in [`shared/validation.ts`](../../shared/validation.ts) and used by both the checklist and the API.
- The client check is a convenience: the API enforces the same rules server-side.
- After signup the user has no session. The account becomes usable only after the email is confirmed.
- `role` and `status` are never sent by the form.

## Data

The page reads and writes no table directly. The API creates the Supabase Auth user, and the `handle_new_user` trigger creates the matching `profiles` row from `first_name` and `last_name` (see [`docs/api/auth-signup.md`](../api/auth-signup.md)). The frontend never talks to Supabase directly: the request goes through [`src/lib/authApi.ts`](../../src/lib/authApi.ts), whose `signup()` returns `{ ok: true }` or `{ ok: false, reason: 'rate-limited' | 'failed' }`.

## Security and access

- The route is public. There is no redirect for a user who is already logged in.
- The form does not read or store the password anywhere except in component state, and it is sent only in the request body.
- A `blocked` user cannot exist yet at signup: new profiles always get the default `active` status and `user` role, set by the database and not by the request.
- Nothing privileged is writable from this feature: the API ignores any field other than the four above.

## Tests

- Unit tests:
  - [`src/pages/SignupPage/SignupPage.test.tsx`](../../src/pages/SignupPage/SignupPage.test.tsx): form and login link, button disabled/enabled, inline errors after blur, checklist shown only after focus, weak password and mismatched confirmation block the button, request payload and check-email screen with focus on the heading, progress state, generic error, rate-limit message, network failure and retry.
  - [`src/hooks/useForm.test.ts`](../../src/hooks/useForm.test.ts) and [`src/components/ValidatedInput/ValidatedInput.test.tsx`](../../src/components/ValidatedInput/ValidatedInput.test.tsx): the generic form hook (errors only after blur, validators that depend on other fields, overall validity) and the input bound to it.
  - [`src/components/AuthLayout/AuthLayout.test.tsx`](../../src/components/AuthLayout/AuthLayout.test.tsx): children, decorative photo, logo/heading/description/title from `info`, and `headingRef` receiving focus.
  - [`src/lib/authApi.test.ts`](../../src/lib/authApi.test.ts): sends only the four fields as JSON, maps `201` to ok, `429` to `rate-limited`, network error to `failed`.
  - [`src/router.test.tsx`](../../src/router.test.tsx): `/signup` is served without authentication and shows "Create your account".
- E2E tests: [`e2e/signup.spec.ts`](../../e2e/signup.spec.ts) with the API mocked via `page.route`: successful signup shows the check-email screen, a `400` shows the generic error. These tests have not been run locally because the Playwright browsers are not installed; they run in CI.

## Open decisions

- Out of scope and still to be decided: what a logged-in user should see when opening `/signup` (no redirect today), and the prompt shown on the dashboard.
- Out of scope: password reset flow. The signup screens deliberately link to nothing for it.
- Whether the check-email screen should offer a way to resend the confirmation email is not defined in the code.
- Visual behavior (layout of the two panels; at 900px wide and below the photo becomes a backdrop and the form a frosted card, as in the mobile design) is defined only in [`SignupForm.module.css`](../../src/pages/SignupPage/components/SignupForm/SignupForm.module.css) and [`AuthLayout.module.css`](../../src/components/AuthLayout/AuthLayout.module.css) and is not covered by automated tests.

## Changelog

| Date       | Change                 | PR  |
| ---------- | ---------------------- | --- |
| 2026-10-25 | Initial implementation | TBD |
