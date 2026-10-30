# `POST /api/auth/signup`

Registers a new user through Supabase Auth and enforces the password policy server-side. Called by the signup form of the frontend.

|            |                                                                  |
| ---------- | ---------------------------------------------------------------- |
| **Method** | `POST`                                                           |
| **Path**   | `/api/auth/signup`                                               |
| **Source** | [`api/auth/_routes/signup.ts`](../../api/auth/_routes/signup.ts) |
| **Auth**   | None (public endpoint, it uses the Supabase anon key)            |
| **Status** | Experimental                                                     |

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

| Field       | Type     | Required | Constraints                                                                                                     | Description                                     |
| ----------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `firstName` | `string` | Yes      | Not empty after trimming                                                                                        | User's first name                               |
| `lastName`  | `string` | Yes      | Not empty after trimming                                                                                        | User's last name                                |
| `email`     | `string` | Yes      | Valid email format. Trimmed and lowercased before use                                                           | Login email                                     |
| `password`  | `string` | Yes      | 8–20 characters, with at least one uppercase letter, one lowercase letter, one number and one special character | Password, validated with `shared/validation.ts` |

Any other field is ignored. In particular `role` and `status` can never be set from the request.

```json
{
  "firstName": "Anna",
  "lastName": "Rossi",
  "email": "anna.rossi@example.com",
  "password": "Valid123!"
}
```

## Response

### `201 Created`

| Field     | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| `message` | `string` | Always `"Signup successful"` |

```json
{
  "message": "Signup successful"
}
```

## Error cases

Errors return JSON shaped `{ "message": string }`, except the `500` responses, which also include `"status": "error"`.

| Status                       | When                                                                                                                | Example body                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `400 Bad Request`            | The body is missing or is not a JSON object                                                                         | `{ "message": "Missing or invalid request body" }`                                   |
| `400 Bad Request`            | `firstName` or `lastName` is missing, not a string or blank                                                         | `{ "message": "First name is required" }`                                            |
| `400 Bad Request`            | `email` is missing, not a string or not a valid email                                                               | `{ "message": "Invalid email" }`                                                     |
| `400 Bad Request`            | `password` is missing, not a string or does not meet the policy                                                     | `{ "message": "Invalid password: use 8-20 characters with an uppercase letter, …" }` |
| `400 Bad Request`            | The email is already registered. The message is generic on purpose, see Notes                                       | `{ "message": "Unable to complete signup" }`                                         |
| `405 Method Not Allowed`     | The method is not `POST`                                                                                            | `{ "message": "Method not allowed" }`                                                |
| `415 Unsupported Media Type` | The `Content-Type` is not `application/json` (blocks cross-site form posts, see Notes)                              | `{ "message": "Content-Type must be application/json" }`                             |
| `429 Too Many Requests`      | Supabase's email or request rate limit is exceeded (limits are project-wide, not per user)                          | `{ "message": "Too many requests, please try again later" }`                         |
| `500 Internal Server Error`  | `SUPABASE_URL` or `SUPABASE_ANON_KEY` is not set, or Supabase fails for another reason. The error is sent to Sentry | `{ "status": "error", "message": "Internal server error" }`                          |

## Example

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Anna","lastName":"Rossi","email":"anna.rossi@example.com","password":"Valid123!"}'
```

## Notes

- **Creates real data.** There is a single Supabase project shared by local dev, previews and production, so every successful call creates a real user.
- **Profile creation:** the endpoint does not insert into `profiles`. The `handle_new_user` trigger creates the row from the signup metadata, taking only `first_name` and `last_name`. `role` and `status` always use the database defaults.
- **Duplicate emails:** both when Supabase returns `user_already_exists` and when it returns a user with no identities (what it does with email confirmation on), the response is the same generic `400`. This avoids revealing which emails are registered.
- **Unconfirmed existing users:** with email confirmation on, a repeated signup for an email that was never confirmed is not detected as a duplicate. It returns `201` and Supabase sends the confirmation email again, which counts toward the rate limit.
- **Rate limit:** the built-in Supabase email sender allows very few emails per hour for the whole project, so a burst of signups can block everyone. Configure a custom SMTP server before release.
- **Requires** `SUPABASE_URL` and `SUPABASE_ANON_KEY` (see the [README](../../README.md#environment-variables)). The service role key is not used.
- Locally, run it with `vercel dev`: `npm run dev` does not serve `/api/*`.
