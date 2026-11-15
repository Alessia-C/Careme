# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Keep it short: it is loaded in every session. Detailed guides live in `docs/` and are read on demand.

## Project

Careme: a web app for tracking personal skincare/makeup products (name, brand, category, status). Currently at the foundation milestone: tooling, DB schema, CI and tests exist; the UI (`src/App.tsx`) is a placeholder and `api/` holds only smoke endpoints. Code comments and some older docs are in Italian; UI strings are in English.

Requires Node 22.13+ (`.nvmrc`); ESLint 10 fails on older Node.

Approved stack: React 19 + Vite + TypeScript, React Router (`react-router`, Data mode with `createBrowserRouter`), Zustand (global state), React Query (data fetching), CSS Modules, Supabase (Postgres + Auth), Node.js + Express on Vercel serverless functions, Vitest, Playwright, Sentry, UptimeRobot. Form libraries are not chosen yet: ask, do not pick one.

## Commands

Full list and E2E notes: `docs/dev/commands.md`. Most used:

- `npm run dev` (frontend only, `/api/*` not served), `vercel dev` (frontend + `api/`, loads Vercel "Development" env vars)
- `npm run build`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e`

## Structure

- Frontend (pages, routes, components, hooks, styles, tokens): `docs/architecture/frontend.md`.
- Backend (Express apps, `withAuth`, cookies, session): `docs/architecture/backend.md`.
- Database (tables, migrations, types): `docs/architecture/database.md`.

Rules that always apply:

- The frontend never talks to Supabase directly: no Supabase client in `src/`, no `VITE_SUPABASE_*` vars. Everything, auth included, goes through `api/`.
- Every API call from the frontend goes through React Query.
- Routes are declared in `router.tsx`. A new page is `pages/XxxPage/XxxPage.tsx` with its test, plus one route entry under the protected route.
- Only `VITE_*` env vars reach the browser. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS: use only in `api/`, never with a `VITE_` prefix.
- Schema changes always go in a new migration in `supabase/migrations/`.
- Supabase in the API: create a per-request client with the caller's JWT so RLS applies. RLS is the last line of defense, API checks are the first: never rely on only one.

## Security rules

Security is a top priority: when in doubt, choose the safer option and ask.

- Users with role `user` can update only `first_name` and `last_name` on their own profile (password changes go through Supabase Auth). `role` and `status` must never be writable by a non-admin, and this must be enforced in the database, not only in the API. Every migration touching `profiles` must preserve it.
- `handle_new_user` must take only `first_name`/`last_name` from signup metadata (user-controlled); `role` and `status` always use defaults.
- A `blocked` user must not be able to do anything. Enforce it in RLS (policies check the profile is `active`), not only at login: existing sessions stay valid until token expiry.
- These rules are enforced by `20261018120000_harden_profiles_security.sql` (`is_admin()`/`is_active()` helpers, the `prevent_privilege_change` trigger and `is_active()` checks in every RLS policy). Keep them intact in any later migration touching `profiles` or `products`.

## Environment

- There is a single Supabase project shared by local dev, Vercel previews and production (a separate production project is planned before release). Never run `supabase db push`, seed scripts or any data-modifying command without explicit approval.
- Vercel functions run in `dub1` (Dublin, set in `vercel.json`). Change it together with the Supabase region.
- Supabase free tier pauses after ~1 week of inactivity: if the API fails to connect, check the project is not paused before debugging code.
- New env vars go in `.env.example` and the README env table.

## Conventions

Endpoint and feature documentation rules, the commit and branch rules, and the issue workflow: `docs/conventions/workflow.md`. Forms with unsaved changes: `docs/conventions/forms.md`, which must be read whenever a form with user input (except login and signup) is built or changed.

- Prettier: single quotes, semicolons, trailing commas, 80 cols, LF.
- Code comments and commit messages in English. Do not translate existing Italian comments unless asked.
- No i18n: UI strings are hardcoded in English. Do not introduce translation libraries.
- Do not add new dependencies (npm packages, libraries, frameworks) unless explicitly requested by the user. If a task seems to need one, propose it and wait for approval instead of installing it.
- UptimeRobot pings the backend: keep the health endpoint stable (TODO: specify which endpoint).
- When an open decision listed in this file is made (libraries, API structure, admin features), update CLAUDE.md in the same PR.

## Working agreement

- Always analyze first: read the code and explain findings and options before changing anything.
- Before making changes the user has not clearly asked for, say what you intend to change and wait for confirmation. A clear command ("do X", "proceed", "confirmed") authorizes exactly that change; ask again for anything beyond it.
- Answer questions with an answer, not with edits.
- Do not add dependencies without explicit approval (see Conventions).
- If, while analyzing the project or working on a task, you find that any rule in this file is violated or that something introduces a security risk, stop and ask the user how to proceed. Do not fix it silently or work around it.

## Code quality

- DRY: before writing new logic, check whether a helper already exists (`api/_lib/`, `src/`, later `shared/`) and reuse it. Extract shared logic when it repeats a third time, not before.
- Readability first: small single-purpose functions, descriptive names, no clever one-liners. Comments explain why, not what.
- Strict TypeScript: no `any`, no non-null assertions (`!`) or `as` casts unless justified with a comment.
- Performance: select only needed columns, paginate lists, avoid N+1 queries and unnecessary re-renders. Do not micro-optimize at the expense of readability without a measured reason.
- Every change ships with tests for the new behavior; lint, format and type-check must pass.
- Reuse existing components and helpers; follow the project's established patterns in every change.
