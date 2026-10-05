# Careme

A web app for tracking personal skincare and makeup products.

**Stack:** React 19 + Vite (frontend) · Vercel serverless functions in [`api/`](api/) (backend) · Supabase (Postgres + Auth) · Vitest + Playwright (tests).

## Contents

- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [Testing](#testing)
- [Building](#building)
- [Code quality](#code-quality)
- [Project structure](#project-structure)
- [API documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Tool                                                                                   | Version                             | Needed for                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| [Node.js](https://nodejs.org/)                                                         | **22.13+** (see [`.nvmrc`](.nvmrc)) | Everything. ESLint 10 does not run on Node 20.17 or older. |
| npm                                                                                    | Comes with Node                     | Installing dependencies                                    |
| [Docker](https://www.docker.com/)                                                      | Any recent version, running         | The local Supabase stack                                   |
| [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) | 2.x                                 | Running Supabase locally and applying migrations           |
| [Vercel CLI](https://vercel.com/docs/cli)                                              | Latest                              | Running the `api/` functions locally (`vercel dev`)        |

With [nvm](https://github.com/nvm-sh/nvm), `nvm install && nvm use` picks up the version from `.nvmrc`.

Install the CLIs globally if you don't have them:

```bash
npm install -g supabase vercel   # or: brew install supabase/tap/supabase
```

You only need Docker, the Supabase CLI and the Vercel CLI to work on the backend. The frontend, unit tests and E2E tests run with Node alone.

## Local setup

```bash
# 1. Clone and install
git clone https://github.com/Alessia-C/Careme.git
cd Careme
nvm use                 # optional, switches to the Node version in .nvmrc
npm install             # also installs the Husky pre-commit hook

# 2. Install Playwright browsers (once per machine, only for E2E tests)
npx playwright install chromium firefox webkit

# 3. Start the local Supabase stack (Docker must be running)
supabase start          # applies every migration in supabase/migrations/

# 4. Create your env file
cp .env.example .env.local
```

Then fill in `.env.local` with the values printed by `supabase start`. Run `supabase status` to print them again:

| `supabase status` output             | Variable(s) in `.env.local`         |
| ------------------------------------ | ----------------------------------- |
| `API URL` (`http://127.0.0.1:54321`) | `SUPABASE_URL`, `VITE_SUPABASE_URL` |
| `anon key`                           | `VITE_SUPABASE_ANON_KEY`            |
| `service_role key`                   | `SUPABASE_SERVICE_ROLE_KEY`         |

Check the setup:

```bash
npm test                # unit tests pass
vercel dev              # then open http://localhost:3000/api/supabase-ping
                        # → {"status":"ok","message":"Supabase connection successful"}
```

> The first `vercel dev` asks you to link the folder to a Vercel project. To link to the existing project you need access to the Vercel team. Otherwise, choose to create a new project under your own account. Nothing gets deployed by `vercel dev`.

## Environment variables

All variables are listed in [`.env.example`](.env.example). Put local values in `.env.local`, which is git-ignored. Never commit real keys.

| Variable                    | Used by          | Required                      | Description                                                                                                           |
| --------------------------- | ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | `api/` functions | Yes, for `/api/supabase-ping` | Supabase API URL. Locally: `http://127.0.0.1:54321`.                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/` functions | Yes, for `/api/supabase-ping` | Service role key. **Bypasses RLS: server-side only, never expose it to the browser** (never prefix it with `VITE_`).  |
| `VITE_SUPABASE_URL`         | Frontend (Vite)  | Not yet                       | Supabase API URL for the browser client. Already provided in CI.                                                      |
| `VITE_SUPABASE_ANON_KEY`    | Frontend (Vite)  | Not yet                       | Public anon key for the browser client. Already provided in CI.                                                       |
| `E2E_BASE_URL`              | Playwright       | No                            | Runs E2E tests against an already running URL (for example a Vercel preview) instead of building and serving locally. |
| `CI`                        | Playwright       | No                            | Set automatically on GitHub Actions. Turns on retries, the GitHub reporter and the `@visual` tests.                   |

Only variables prefixed with `VITE_` are exposed to frontend code (`import.meta.env.VITE_*`). Everything else is only available to the serverless functions (`process.env.*`).

**Where the values live in other environments:**

- **Vercel (preview/production):** Project → Settings → Environment Variables. `vercel env pull .env.local` downloads them into your local file.
- **GitHub Actions:** repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, used by the E2E workflow.

## Running the app

| Command           | What it runs                                                                      | URL                   |
| ----------------- | --------------------------------------------------------------------------------- | --------------------- |
| `npm run dev`     | Vite dev server with hot reload. **Frontend only**: `/api/*` is not served.       | http://localhost:5173 |
| `vercel dev`      | Frontend **and** the `api/` serverless functions, the same way Vercel serves them | http://localhost:3000 |
| `npm run preview` | Serves the production build from `dist/`. Run `npm run build` first.              | http://localhost:4173 |

Use `npm run dev` for UI work and `vercel dev` when you need the API.

### Local Supabase

| Command                                                               | Purpose                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `supabase start` / `supabase stop`                                    | Start or stop the local stack                                  |
| `supabase status`                                                     | Print URLs and keys                                            |
| `supabase db reset`                                                   | Recreate the local database from `supabase/migrations/`        |
| `supabase migration new <name>`                                       | Create a new, empty migration file                             |
| `supabase gen types typescript --local > src/types/database.types.ts` | Regenerate the TypeScript database types after a schema change |

Supabase Studio (database GUI) runs at http://127.0.0.1:54323 while the stack is up.

## Testing

### Unit and component tests (Vitest)

Tests are in `src/**/*.{test,spec}.{ts,tsx}` and run in `happy-dom` with Testing Library.

```bash
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report → coverage/index.html
```

### End-to-end tests (Playwright)

Tests are in [`e2e/`](e2e/) and run on Chromium, Firefox and WebKit. Playwright builds the app and serves it on port 4173, so no dev server is needed.

```bash
npm run test:e2e         # run headless
npm run test:e2e:ui      # interactive UI mode
npm run test:e2e:report  # open the last HTML report
```

**Visual regression tests** are tagged `@visual`. They are skipped locally and only run in CI, because screenshots differ between operating systems. The baselines in `e2e/__screenshots__/` were generated on Linux. To update them after an intentional UI change, run this on Linux, for example in the official Playwright Docker image:

```bash
CI=1 npm run test:e2e:update
```

## Building

```bash
npm run build            # type-check (tsc) + production build → dist/
npm run preview          # serve dist/ locally
```

Deployment is handled by Vercel's Git integration: every PR gets a preview deployment, and `main` deploys to production.

## Code quality

```bash
npm run lint             # ESLint
npm run format           # Prettier, write
npm run format:check     # Prettier, check only
```

A **Husky pre-commit hook** runs `lint-staged`, which lints and formats staged files on every commit.

**CI (GitHub Actions)** runs on every PR and every push to `main`:

- `CI / quality`: lint and unit tests with coverage
- `CI / audit`: `npm audit --audit-level=critical`
- `E2E / e2e`: Playwright on all three browsers, including the visual tests

Dependabot opens weekly dependency update PRs.

## Project structure

```
api/                    Vercel serverless functions (one file = one endpoint)
docs/api/               API documentation, one file per endpoint
e2e/                    Playwright tests + visual baselines (__screenshots__/)
src/                    React app
  types/                Generated Supabase types
supabase/
  config.toml           Local Supabase configuration
  migrations/           SQL migrations (schema, triggers, RLS policies)
.github/
  workflows/            CI and E2E pipelines
  ISSUE_TEMPLATE/       Epic, user story and technical task templates
```

## API documentation

Each endpoint in `api/` is documented in [`docs/api/`](docs/api/), and the [API index](docs/api/README.md) lists all of them.

**When you add or change an endpoint:** copy [`docs/api/_TEMPLATE.md`](docs/api/_TEMPLATE.md), fill in every section, and add a row to the index in the same PR.

## Troubleshooting

| Problem                                                         | Fix                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint` fails with a syntax or engine error              | Your Node version is too old. Switch to Node 22 (`nvm use`).                                                                               |
| `/api/...` returns 404                                          | You are on `npm run dev`. Use `vercel dev` instead.                                                                                        |
| `/api/supabase-ping` → `Missing Supabase environment variables` | `.env.local` is missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, or `vercel dev` was started before you created the file. Restart it. |
| `supabase start` fails                                          | Make sure Docker is running. If ports `54321`–`54324` are taken, run `supabase stop --all`.                                                |
| E2E: `Executable doesn't exist`                                 | Run `npx playwright install chromium firefox webkit`.                                                                                      |
| E2E: port 4173 already in use                                   | Stop the running `npm run preview`, or keep it running: Playwright reuses it locally.                                                      |
