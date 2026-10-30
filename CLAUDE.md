# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Careme: a web app for tracking personal skincare/makeup products (name, brand, category, status). Currently at the foundation milestone: tooling, DB schema, CI and tests exist; the UI (`src/App.tsx`) is a placeholder and `api/` holds only smoke endpoints. Code comments and some older docs are in Italian; UI strings are in English.

Requires Node 22.13+ (`.nvmrc`); ESLint 10 fails on older Node.

Approved stack (from the tech stack decision doc): React 19 + Vite + TypeScript, Zustand (global state), React Query (data fetching), Supabase (Postgres + Auth), Node.js on Vercel serverless functions, Vitest, Playwright, Sentry, UptimeRobot. Routing is React Router (`react-router`, Data mode with `createBrowserRouter`). Styling: CSS Modules (`*.module.css`), decided in issue #56; global styles in `src/styles/` (`normalize.css` from npm, `tokens.css` with design tokens from Figma). Form libraries are not chosen yet: ask, do not pick one.

## Commands

```bash
npm run dev              # Vite frontend only (:5173) — /api/* is NOT served
vercel dev               # frontend + api/ functions (:3000); loads Vercel "Development" env vars, not .env.local
npm run build            # tsc type-check + vite build → dist/
npm run lint             # ESLint (flat config)
npm run format:check     # Prettier check (npm run format to write)

npm test                             # Vitest, once
npx vitest run src/App.test.tsx      # single test file
npx vitest run -t "test name"        # single test by name
npm run test:coverage

npm run test:e2e                     # Playwright, builds + serves on 127.0.0.1:4173
npx playwright test e2e/smoke.spec.ts --project=chromium   # single E2E file/browser
```

- `@visual` E2E tests are skipped locally (`grepInvert` unless `CI` is set). Baselines in `e2e/__screenshots__/` are Linux-generated; update only on Linux with `CI=1 npm run test:e2e:update`.
- `E2E_BASE_URL` runs E2E against an existing URL (e.g. a Vercel preview) instead of building locally.
- Pre-commit hook (Husky + lint-staged) runs ESLint `--fix` and Prettier on staged files.
- CI (`.github/workflows/`): lint + coverage, `npm audit --audit-level=critical`, and Playwright on Chromium/Firefox/WebKit.

## Architecture

- **Frontend** (`src/`): React 19 + Vite. `main.tsx` initializes Sentry, mounts `<App />` inside `Sentry.ErrorBoundary`, and wires React root error hooks to Sentry. Only `VITE_*` env vars reach the browser (`import.meta.env`).
- **Frontend structure** (by file type): `router.tsx` holds the whole route tree (public `/login`, `/signup`; protected `/`), `App.tsx` only mounts the router. `routes/` has routing logic, one folder per component like `pages/` (`routes/SessionRestore/SessionRestore.tsx`, the root of every route except `/signup`, waits for `GET /api/auth/me` before rendering anything and tracks `restoreStatus` in the auth store; `routes/ProtectedRoute/`; `routes/AppLayout/`, whose header lives in `routes/AppLayout/components/AppHeader/`), `pages/` one folder per route (`pages/XxxPage/XxxPage.tsx` with its `.module.css` and test), `components/` one folder per shared component (e.g. `AuthLayout`, the form + image frame of the public auth pages); a component used by one page stays in that page's folder, inside `pages/XxxPage/components/<Name>/` (one folder per component, same layout as `src/components/`), `hooks/` shared React hooks, one folder per hook like `components/` (`hooks/useForm/useForm.ts` with its test; `useForm` is the project's own form hook: form libraries are still not chosen), `lib/` non-React helpers. Tests sit next to the file they test. New feature page = new `pages/XxxPage/XxxPage.tsx` + one entry in `router.tsx` under the protected route.
- **Backend** (`api/`): Vercel serverless functions (a standalone file `api/foo.ts` → `/api/foo`). Domains: `/api/auth` (done), `/api/users`, `/api/products` (planned). Express is mandatory for the backend. Structure: one Express app per domain, exposed as a catch-all Vercel function (`api/auth/[...path].ts`, later `api/users/[...path].ts`, `api/products/[...path].ts`), each with its own router and a feature-oriented layout. In `api/auth/` only `[...path].ts` is a function; everything else starts with `_` (`_app.ts` builds the app, `_router.ts` has the routes, `_routes/<endpoint>.ts` the handlers with their tests), because Vercel deploys every other file in `api/` as a function. Shared middleware lives in `api/_lib/`; `api/health.ts` stays a separate lightweight function (UptimeRobot) and does not load the Express apps. The reason is cost: keep the function count well under the Vercel Hobby cap. Migrate one domain at a time, keeping URLs, cookies and tests working. Use `/backend` (agent `backend-architect`) to design or review endpoints. Files/dirs prefixed with `_` (e.g. `api/_lib/`) are shared helpers, not routes. Inside an Express app do not wrap handlers with `withSentry()`: Express 5 forwards what a handler throws to `errorHandler` (`api/_lib/sentry.ts`, the last middleware of the app), which captures it and returns a generic 500, while body-parser errors become a 4xx without Sentry; `withSentry()` stays only for standalone functions such as `api/sentry-test.ts`. Compose handlers as `withMethod('POST', withObjectBody(handler))` using the helpers in `api/_lib/http.ts`, and register routes with `router.all(path, handler)` so `withMethod` keeps answering 405 (Express would give 404 or an automatic OPTIONS 200). Cookies are read with `getCookie(req, name)` from `api/_lib/cookies.ts` (no `cookie-parser`, no `req.cookies`). Route tests wrap the handler with `withErrorHandler` from `api/_lib/test-helpers.ts`; wiring (404, 405, body parser, ordering) is tested over real HTTP in `api/auth/_app.test.ts` (`// @vitest-environment node`). Protected endpoints add `withAuth(handler)` from `api/_lib/auth.ts`, the single point of JWT enforcement: it verifies the token with Supabase `getUser`, rejects `blocked` users and passes `{ id, email, role }` (role read from `profiles`, never from the request) to the handler. `/api/auth/logout` is the exception: it only uses `getAccessToken` (bearer or session cookie) without `withAuth`, so a blocked user can still revoke their session, and it clears both session cookies. The session is two HttpOnly cookies set by `setSessionCookies` in `api/_lib/auth.ts`: the access token (`Path=/`) and the refresh token (`Path=/api/auth`, `__Secure-` prefix because `__Host-` needs `Path=/`). `POST /api/auth/refresh` exchanges the refresh cookie for a new session and rotates both cookies (any failure or a blocked user clears them and the frontend goes to `/login`); login, refresh and `/me` return `expires_at` in the body and the frontend's `useSessionRefresh` renews shortly before it, only while the user is active (idle users lapse to `/login`); create Supabase clients only through `api/_lib/supabase.ts` (`createAnonClient()`, or `createUserClient(accessToken)` to act as the caller). Relative imports in `api/` use the `.js` extension (ESM, `"type": "module"`).
- **Data access**: the frontend never talks to Supabase directly (no Supabase client in `src/`, no `VITE_SUPABASE_*` vars). Everything, auth included, goes through `api/`.
- **Supabase in the API**: create a per-request client with the caller's JWT (`Authorization` header) so RLS always applies. RLS is the last line of defense, API checks are the first: never rely on only one.
- **Sentry**: disabled when `SENTRY_DSN` / `VITE_SENTRY_DSN` is empty (unit tests, CI). Test hooks: `/?sentry-test=1` (frontend, throws asynchronously) and `/api/sentry-test` (404 in production).
- **Database**: hosted Supabase (Postgres 17, Auth, RLS) — no Docker/local stack. Schema lives only in `supabase/migrations/` (`supabase migration new <name>`, `supabase db push`). Tables: `profiles` (1:1 with `auth.users`, auto-created from signup metadata `first_name`/`last_name` by the `handle_new_user` trigger; `role` is `user|admin`, `status` is `active|blocked`; admins can read/update all profiles) and `products` (`user_id` → `profiles.id`; `category` is `skincare|makeup`, `status` is `new|used|finished`; owner-only RLS for all CRUD, no admin bypass). Enum-like values are `text` + `check` constraints, not Postgres enums. Schema changes always go in a new migration. After a schema change regenerate types: `supabase gen types typescript --linked > src/types/database.types.ts` (currently empty, hence `'profiles' as never` casts).
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS: use only in `api/`, never with a `VITE_` prefix.
- `tsconfig.json` also includes a reserved `shared/` dir for code shared by frontend and API (not created yet).

## Security rules

Security is a top priority: when in doubt, choose the safer option and ask.

- Users with role `user` can update only `first_name` and `last_name` on their own profile (password changes go through Supabase Auth). `role` and `status` must never be writable by a non-admin, and this must be enforced in the database, not only in the API. Every migration touching `profiles` must preserve it.
- `handle_new_user` must take only `first_name`/`last_name` from signup metadata (user-controlled); `role` and `status` always use defaults.
- A `blocked` user must not be able to do anything. Enforce it in RLS (policies check the profile is `active`), not only at login: existing sessions stay valid until token expiry.
- These rules are enforced by `20261018120000_harden_profiles_security.sql` (`is_admin()`/`is_active()` helpers, the `prevent_privilege_change` trigger and `is_active()` checks in every RLS policy). Keep them intact in any later migration touching `profiles` or `products`.

## Environment

- There is a single Supabase project shared by local dev, Vercel previews and production (a separate production project is planned before release). Never run `supabase db push`, seed scripts or any data-modifying command without explicit approval.
- Vercel functions run in `dub1` (Dublin, set in `vercel.json`) to cut latency towards Supabase. Change both together if the Supabase region changes.
- Supabase free tier pauses after ~1 week of inactivity: if the API fails to connect, check the project is not paused before debugging code.

## Conventions

- When adding or changing an endpoint, copy `docs/api/_TEMPLATE.md` into `docs/api/<endpoint>.md` and add a row to `docs/api/README.md` in the same PR.
- When adding or changing a user-facing feature, copy `docs/features/_TEMPLATE.md` into `docs/features/<feature-name>.md` and add a row to `docs/features/README.md` in the same PR. Feature docs are in English.
- New env vars go in `.env.example` and the README env table.
- Prettier: single quotes, semicolons, trailing commas, 80 cols, LF.
- Commit style: Conventional Commits (`feat:`, `docs:`, `test(e2e):`, `chore(deps):`); feature branches named `<issue>-mk-xxx-<slug>` (e.g. `54-mk-019-tech-zustand-store-for-session-role`, issue #54) created from `staging` and merged via PR to `staging`, the integration branch (epics have no container branch; if a feature has BE and FE issues, the BE goes to `staging` first). `main` is production and only receives PRs from `staging`, merged with a merge commit (not squash). Vercel deploys `main` to production and builds previews only for `staging` and `main` (`vercel.json`); CI and E2E run only on PRs and pushes to `staging` and `main`.
- Code comments and commit messages in English. Do not translate existing Italian comments unless asked.
- No i18n: UI strings are hardcoded in English. Do not introduce translation libraries.
- Do not add new dependencies (npm packages, libraries, frameworks) unless explicitly requested by the user. If a task seems to need one, propose it and wait for approval instead of installing it.
- UptimeRobot pings the backend: keep the health endpoint stable (TODO: specify which endpoint).
- When an open decision listed in this file is made (libraries, API structure, admin features), update CLAUDE.md in the same PR.

## Workflow issue

Every issue follows these steps, in order. Do not skip the approval step.

1. **Analyze**: run `/issue <number>`, which uses the `issue-planner` agent (`.claude/agents/issue-planner.md`, read-only) on the GitHub issue number.
2. **Approve**: present the plan and stop. Do not edit or create any file until the user explicitly approves the plan. Open questions in the plan must be answered first.
3. **Implement**: on a branch `<issue>-mk-xxx-<slug>` from `staging`, following the approved plan. If the plan changes during implementation, stop and ask again.
4. **Document**: run `/docs <number>` (`docs-writer`, writes only under `docs/features/` and `docs/api/`). Review the docs in the PR like any other change.
5. **Verify**: run `/quality-check` (`code-quality-reviewer`, read-only), then `npm run lint`, `npm run format:check`, `npm run build` and `npm test`. If the change touches `api/`, `supabase/`, auth, RLS, env vars or dependencies, also run `/security-audit` (`security-auditor`, read-only). If the change touches the UI (`src/pages/`, `src/components/`, `src/routes/`), also run `/a11y-audit` (`accessibility-auditor`, read-only) and `/perf-check` (`frontend-performance-auditor`, read-only). To design or review frontend code before implementing, use `/frontend` (`frontend-architect`, read-only).
6. **Ship**: commit with Conventional Commits and open the PR to `staging`. Releases go through a PR from `staging` to `main` (merge commit). Commit and push only when the user asks.

## Working agreement

- Always analyze first: read the code and explain findings and options before changing anything.
- Before making changes the user has not clearly asked for, say what you intend to change and wait for confirmation. A clear command ("do X", "proceed", "confirmed") authorizes exactly that change; ask again for anything beyond it.
- Answer questions with an answer, not with edits.

## Code quality

- DRY: before writing new logic, check whether a helper already exists (`api/_lib/`, `src/`, later `shared/`) and reuse it. Extract shared logic when it repeats a third time, not before: avoid premature abstractions that make code harder to follow.
- Readability first: small single-purpose functions, descriptive names, no clever one-liners. Comments explain why, not what.
- Strict TypeScript: no `any`, no non-null assertions (`!`) or `as` casts unless justified with a comment (the current `as never` casts are a known exception until DB types are generated).
- Performance: select only needed columns, paginate lists, avoid N+1 queries and unnecessary re-renders. Do not micro-optimize at the expense of readability without a measured reason.
- Every change ships with tests for the new behavior; lint, format and type-check must pass.
- Reuse existing components and helpers instead of creating near-duplicates; follow the project's established patterns and conventions in every change.
- If, while analyzing the project or working on a task, you find that any rule in this file is violated or that something introduces a security risk, stop and ask the user how to proceed. Do not fix it silently or work around it.

## Learning mode

The user is learning Node.js, Express and testing (Vitest, Playwright) and has never used them before.

- Always reply in Italian. Code, comments and commit messages stay in English.
- Before using a new concept (middleware, routing, req/res, async/await, test structure, assertions, mocking, E2E selectors, etc.), explain it briefly with a minimal example.
- For backend code (`api/`) and tests, the user writes the code and you review it: point out problems and explain why, suggest the fix, but do not rewrite it.
- Do not write complete functions or complete tests unless the user explicitly asks. Small snippets to illustrate a concept are fine.
- Config and docs are excluded from this mode unless the user says otherwise.
