# API documentation

The backend is a set of Vercel serverless functions in [`api/`](../../api/). A standalone endpoint is a file `api/<name>.ts`, served at `/api/<name>`. A domain with several endpoints (today `auth`) is one Express app exposed as a catch-all function (`api/auth/[...path].ts`): its router, handlers and tests live in files and folders starting with `_` (`api/auth/_app.ts`, `_router.ts`, `_routes/<endpoint>.ts`), which Vercel does not deploy as functions.

- **Local base URL:** `http://localhost:3000` (run with `vercel dev`, see the [README](../../README.md#running-the-app))
- **Preview/production base URL:** the Vercel deployment URL

## Endpoints

| Method | Path                                     | Auth           | Description                                              |
| ------ | ---------------------------------------- | -------------- | -------------------------------------------------------- |
| `GET`  | [`/api/health`](health.md)               | None           | Liveness check for the serverless runtime                |
| `GET`  | [`/api/supabase-ping`](supabase-ping.md) | None           | Checks the connection to Supabase                        |
| `GET`  | [`/api/sentry-test`](sentry-test.md)     | None           | Throws a deliberate error to verify Sentry error capture |
| `POST` | [`/api/auth/signup`](auth-signup.md)     | None           | Registers a new user via Supabase Auth                   |
| `POST` | [`/api/auth/login`](auth-login.md)       | None           | Authenticates a user and sets the session cookies        |
| `POST` | [`/api/auth/refresh`](auth-refresh.md)   | Refresh cookie | Renews the session and rotates both cookies              |
| `POST` | [`/api/auth/logout`](auth-logout.md)     | JWT            | Revokes the caller's current session                     |
| `GET`  | [`/api/auth/me`](auth-me.md)             | JWT            | Returns the current user, to restore the session on load |

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`).
- Successful responses include `"status": "ok"`. Error responses use `{ "status": "error", "message": string }` with an appropriate HTTP status code.
- Never return secrets or raw stack traces in a response.
- Protected endpoints wrap their handler with `withAuth()` from [`api/_lib/auth.ts`](../../api/_lib/auth.ts), e.g. `withMethod('GET', withAuth(handler))`. The handler receives `{ id, email, role }` as third argument. `withAuth` reads the token from the `Authorization: Bearer` header (it wins) or, if absent, from the `__Host-sb-access-token` HttpOnly cookie set by [`/api/auth/login`](auth-login.md). It answers `401` for a missing, invalid, expired or revoked token (verified with Supabase `getUser`), `429` on Supabase rate limits and `403` when the profile is `blocked`. The role is read from `profiles.role`, never from the request. Document these errors in the endpoint's doc and set **Auth** to `JWT`.
- Inside an Express app errors are not caught per handler: an uncaught error reaches the `errorHandler` of [`api/_lib/sentry.ts`](../../api/_lib/sentry.ts), which reports it to Sentry and answers the generic `500`. Errors of the body parser are the client's fault and are not reported: a malformed or oversized JSON body is a `400 { "message": "Missing or invalid request body" }` and an unsupported charset or encoding a `415`.
- A path under a domain that no route matches answers `404 { "message": "Not found" }`. Routes are case sensitive, and a wrong HTTP method on a known path is a `405` (also for `OPTIONS` and `HEAD`).
- Exception: [`/api/auth/logout`](auth-logout.md) does not use `withAuth`, so a blocked user can still revoke their session.

## Adding a new endpoint

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `docs/api/<name>.md`, using the same name as the file in `api/` (for a domain endpoint, `<domain>-<endpoint>`, e.g. `auth-login.md`).
2. Fill in every section: method, path, parameters, request body, response format and error cases. Write "None" for sections that don't apply instead of deleting them.
3. Add a row to the **Endpoints** table above.
4. Ship the doc in the same PR as the endpoint. A change to the endpoint's contract must update its doc too.
