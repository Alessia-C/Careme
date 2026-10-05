# `GET /api/health`

Liveness check: confirms the serverless runtime is up and responding. It touches no external services.

|            |                                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| **Method** | `GET` (the handler does not check the method, so any method returns the same response) |
| **Path**   | `/api/health`                                                                          |
| **Source** | [`api/health.ts`](../../api/health.ts)                                                 |
| **Auth**   | None                                                                                   |
| **Status** | Stable (smoke endpoint)                                                                |

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

### `200 OK`

| Field       | Type                | Description                                 |
| ----------- | ------------------- | ------------------------------------------- |
| `status`    | `"ok"`              | Always `"ok"`                               |
| `timestamp` | `string` (ISO 8601) | Server time when the response was generated |

```json
{
  "status": "ok",
  "timestamp": "2026-10-05T09:30:00.000Z"
}
```

## Error cases

The handler itself returns no errors.

| Status | When                                                                                             | Example body                      |
| ------ | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| `5xx`  | The function fails to start or the platform has a problem (raised by Vercel, not by the handler) | Vercel error page / non-JSON body |

## Example

```bash
curl http://localhost:3000/api/health
```

## Notes

- Use it for uptime monitoring and to check that a deployment serves the `api/` folder.
- A `200` here does **not** mean the database is reachable. Use [`/api/supabase-ping`](supabase-ping.md) for that.
