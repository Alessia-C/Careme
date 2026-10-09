# `GET /api/sentry-test`

Diagnostic endpoint: deliberately throws `Error("Sentry backend test error")` to verify that errors in the serverless functions are captured by Sentry. Called manually by developers, never by the app.

|            |                                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| **Method** | `GET` (the handler does not check the method, so any method returns the same response) |
| **Path**   | `/api/sentry-test`                                                                     |
| **Source** | [`api/sentry-test.ts`](../../api/sentry-test.ts)                                       |
| **Auth**   | None                                                                                   |
| **Status** | Experimental (smoke/diagnostic endpoint)                                               |

## Parameters

### Path parameters

None.

### Query parameters

None.

### Headers

None.

## Request body

None.

## Response

### `500 Internal Server Error` (development and preview)

Outside production the handler always throws, so this `500` is the **expected** result, not a failure.

| Field     | Type      | Description                      |
| --------- | --------- | -------------------------------- |
| `status`  | `"error"` | Always `"error"`                 |
| `message` | `string`  | Always `"Internal server error"` |

```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## Error cases

| Status                      | When                                                                                                      | Example body                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `404 Not Found`             | `VERCEL_ENV=production`: the endpoint is disabled to protect the Sentry free-tier quota (5k errors/month) | `{ "status": "error", "message": "Not found" }`             |
| `500 Internal Server Error` | Development and preview: the deliberate test error (expected, see [Response](#response))                  | `{ "status": "error", "message": "Internal server error" }` |
| `5xx`                       | The function fails to start or the platform has a problem (raised by Vercel, not by the handler)          | Vercel error page / non-JSON body                           |

## Example

```bash
curl -i http://localhost:3000/api/sentry-test
# HTTP/1.1 500 Internal Server Error
# {"status":"error","message":"Internal server error"}
```

## Notes

- The handler is wrapped in `withSentry()` from [`api/_lib/sentry.ts`](../../api/_lib/sentry.ts). On an uncaught error it captures the exception, tags it with `runtime=serverless` and `route=<request URL>`, and awaits `Sentry.flush(2000)` before responding, because Vercel freezes the function once the response is sent. The client only gets the generic `500` body: the stack trace never leaks.
- **How to verify:** call the endpoint, then open Sentry → **Issues** and look for `Sentry backend test error` with the expected `environment` tag (`development` or `preview`).
- Sentry is a no-op when `SENTRY_DSN` is not set: the endpoint still returns `500`, but nothing is sent. With `vercel dev`, the variable must exist on Vercel for the Development environment (see the [README](../../README.md#environment-variables)).
- Frontend counterpart: opening `/?sentry-test=1` throws `Sentry frontend test error` (see [`src/lib/sentry.ts`](../../src/lib/sentry.ts)), which is captured with `runtime=frontend` when `VITE_SENTRY_DSN` is set.
