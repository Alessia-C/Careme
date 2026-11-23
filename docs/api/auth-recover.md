# `POST /api/auth/recover`

Starts a password recovery: asks Supabase Auth to email the user a link to reset the password. The answer is the same whether or not the email is registered. Called by the "Forgot password?" flow of the frontend (the page does not exist yet).

|            |                                                                    |
| ---------- | ------------------------------------------------------------------ |
| **Method** | `POST`                                                             |
| **Path**   | `/api/auth/recover`                                                |
| **Source** | [`api/auth/_routes/recover.ts`](../../api/auth/_routes/recover.ts) |
| **Auth**   | None (public endpoint, it uses the Supabase anon key)              |
| **Status** | Experimental                                                       |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

| Name           | Required | Description        |
| -------------- | -------- | ------------------ |
| `Content-Type` | Yes      | `application/json` |

## Request body

`Content-Type: application/json`

| Field   | Type     | Required | Constraints                                           | Description                     |
| ------- | -------- | -------- | ----------------------------------------------------- | ------------------------------- |
| `email` | `string` | Yes      | Valid email format. Trimmed and lowercased before use | Email of the account to recover |

```json
{
  "email": "anna.rossi@example.com"
}
```

The body must not contain the address the link points to: the link target is built by the server, see Notes.

## Response

### `200 OK`

| Field     | Type     | Description                                                                           |
| --------- | -------- | ------------------------------------------------------------------------------------- |
| `message` | `string` | Always `"If the email is registered, you will receive a link to reset your password"` |

```json
{
  "message": "If the email is registered, you will receive a link to reset your password"
}
```

The body is identical for a registered and an unknown email. No cookie is set.

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                       | When                                                                                                                               | Example body                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                                        | `{ "message": "Missing or invalid request body" }`           |
| `400 Bad Request`            | `email` is missing, is not a string or is not a valid email. This is the only check on the email                                   | `{ "message": "Invalid email" }`                             |
| `405 Method Not Allowed`     | The method is not `POST`                                                                                                           | `{ "message": "Method not allowed" }`                        |
| `415 Unsupported Media Type` | The `Content-Type` is not `application/json`                                                                                       | `{ "message": "Content-Type must be application/json" }`     |
| `429 Too Many Requests`      | Supabase's rate limit is exceeded (`over_email_send_rate_limit` or `over_request_rate_limit`)                                      | `{ "message": "Too many requests, please try again later" }` |
| `500 Internal Server Error`  | `APP_URL` is missing or invalid, an env var of Supabase is missing, or Supabase returns another error. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`  |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/recover \
  -H "Content-Type: application/json" \
  -d '{"email":"anna.rossi@example.com"}'
```

## Notes

- **No account enumeration:** the only rejection tied to the email is its format, which says nothing about which emails are registered. Supabase answers success for an unknown email too, so any other error is a real fault. The `429` limit is project-wide and does not depend on the email either.
- **Link target (`redirectTo`):** built from the `APP_URL` environment variable as `<APP_URL>/reset-password`, never from the request. A caller-controlled address would be an open redirect that sends the reset token to another site. If `APP_URL` is missing the endpoint answers `500`.
- **Supabase configuration (required, done in the dashboard, not in code):**
  - The **Reset Password** email template is **not** modified: the project has no custom SMTP, so the default template cannot be edited. The default link goes to Supabase, which verifies it and redirects the browser to `<APP_URL>/reset-password#access_token=...&refresh_token=...`.
  - `<APP_URL>/reset-password` must be listed in the project's **Redirect URLs** (Authentication → URL Configuration). Otherwise Supabase ignores `redirectTo` and falls back to the **Site URL**.
  - The **Site URL** must be set to the app URL.
- **Next step:** the page at `/reset-password` reads `access_token` and `refresh_token` from the URL fragment, removes the fragment from the URL and sends the tokens with the new password to [`/api/auth/reset`](auth-reset.md). The page does not exist yet (frontend issue): it needs the page, its route in `router.tsx`, a `/reset-password` rewrite in `vercel.json` (otherwise the link answers `404` on Vercel), reading and removing the fragment, and a `Referrer-Policy: no-referrer` for the page.
- **Requires** `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `APP_URL` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`. Set `APP_URL=http://localhost:3000`.
