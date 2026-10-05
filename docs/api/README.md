# API documentation

The backend is a set of Vercel serverless functions in [`api/`](../../api/). Each file `api/<name>.ts` is served at `/api/<name>`.

- **Local base URL:** `http://localhost:3000` (run with `vercel dev`, see the [README](../../README.md#running-the-app))
- **Preview/production base URL:** the Vercel deployment URL

## Endpoints

| Method | Path                                     | Auth | Description                               |
| ------ | ---------------------------------------- | ---- | ----------------------------------------- |
| `GET`  | [`/api/health`](health.md)               | None | Liveness check for the serverless runtime |
| `GET`  | [`/api/supabase-ping`](supabase-ping.md) | None | Checks the connection to Supabase         |

## Conventions

- Request and response bodies are JSON (`Content-Type: application/json`).
- Successful responses include `"status": "ok"`. Error responses use `{ "status": "error", "message": string }` with an appropriate HTTP status code.
- Never return secrets or raw stack traces in a response.

## Adding a new endpoint

1. Copy [`_TEMPLATE.md`](_TEMPLATE.md) to `docs/api/<name>.md`, using the same name as the file in `api/`.
2. Fill in every section: method, path, parameters, request body, response format and error cases. Write "None" for sections that don't apply instead of deleting them.
3. Add a row to the **Endpoints** table above.
4. Ship the doc in the same PR as the endpoint. A change to the endpoint's contract must update its doc too.
