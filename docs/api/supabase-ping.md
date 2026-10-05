# `GET /api/supabase-ping`

Connectivity check: confirms the function has Supabase credentials and can run a query against the database.

|            |                                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| **Method** | `GET` (the handler does not check the method, so any method returns the same response) |
| **Path**   | `/api/supabase-ping`                                                                   |
| **Source** | [`api/supabase-ping.ts`](../../api/supabase-ping.ts)                                   |
| **Auth**   | None (the endpoint itself uses the server-side service role key)                       |
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

| Field     | Type     | Description                               |
| --------- | -------- | ----------------------------------------- |
| `status`  | `"ok"`   | Always `"ok"`                             |
| `message` | `string` | Always `"Supabase connection successful"` |

```json
{
  "status": "ok",
  "message": "Supabase connection successful"
}
```

## Error cases

All errors use status `500` and the body `{ "status": "error", "message": string }`.

| Status                      | When                                                                                                                                                                        | Example body                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `500 Internal Server Error` | `SUPABASE_URL` and/or `SUPABASE_SERVICE_ROLE_KEY` is not set. The `details` field shows which ones are present (`true`) or missing (`false`). It never contains the values. | `{ "status": "error", "message": "Missing Supabase environment variables", "details": { "SUPABASE_URL": true, "SUPABASE_SERVICE_ROLE_KEY": false } }` |
| `500 Internal Server Error` | Supabase returns an error for the query (wrong key, `profiles` table missing because migrations were not applied, etc.). `message` is the Supabase error message.           | `{ "status": "error", "message": "Invalid API key" }`                                                                                                 |
| `500 Internal Server Error` | An unexpected exception is thrown (for example, the database cannot be reached)                                                                                             | `{ "status": "error", "message": "fetch failed" }`                                                                                                    |

## Example

```bash
curl http://localhost:3000/api/supabase-ping
```

## Notes

- Runs `select * from profiles limit 1`. The returned rows are thrown away; only success or failure matters.
- Uses the **service role key**, which bypasses RLS. A `200` therefore proves connectivity and that the schema exists, but says nothing about RLS policies.
- Requires the env vars described in the [README](../../README.md#environment-variables). Locally, run it with `vercel dev` after `supabase start`.
