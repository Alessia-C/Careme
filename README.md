# Careme

A web app for tracking personal skincare and makeup products: what you own, which brand it is, and whether it's new, in use or finished.

> **Status:** foundation milestone. The tooling, database schema, CI and test setup are in place. The UI is still a placeholder (`src/App.tsx` renders only the title), and the backend exposes two smoke endpoints.

## Contents

- [About](#about)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Building](#building)
- [Code quality](#code-quality)
- [Project structure](#project-structure)
- [API documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## About

### Tech stack

| Layer    | Technology                                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript 6, Vite 6                                                    |
| Backend  | Vercel serverless functions (Node, `@vercel/node`) in [`api/`](api/)              |
| Database | Supabase: Postgres 17, Auth, Row Level Security; client `@supabase/supabase-js` 2 |
| Testing  | Vitest 4 + Testing Library (unit), Playwright 1.63 (E2E and visual regression)    |
| Tooling  | ESLint 10, Prettier 3, Husky + lint-staged, GitHub Actions, Dependabot            |
| Hosting  | Vercel (preview deployment per PR, production from `main`)                        |

## Requirements

| Tool                                                                                   | Version                             | Needed for                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| [Node.js](https://nodejs.org/)                                                         | **22.13+** (see [`.nvmrc`](.nvmrc)) | Everything. ESLint 10 does not run on Node 20.17 or older. |
| npm                                                                                    | Comes with Node                     | Installing dependencies                                    |
| [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) | 2.x                                 | Applying migrations and generating database types          |
| [Vercel CLI](https://vercel.com/docs/cli)                                              | Latest                              | Running the `api/` functions locally (`vercel dev`)        |

With [nvm](https://github.com/nvm-sh/nvm), `nvm install && nvm use` picks up the version from `.nvmrc`.

Install the CLIs globally if you don't have them:

```bash
npm install -g supabase vercel   # or: brew install supabase/tap/supabase
```

You also need access to a hosted **Supabase project**: the team's development project, or a free project of your own. The project runs against hosted Supabase, so Docker is **not** required.

You only need the Supabase CLI and the Vercel CLI to work on the backend. The frontend, unit tests and E2E tests run with Node alone.

## Installation

```bash
# 1. Clone and install
git clone https://github.com/Alessia-C/Careme.git
cd Careme
nvm use                 # optional, switches to the Node version in .nvmrc
npm install             # also installs the Husky pre-commit hook

# 2. Install Playwright browsers (once per machine, only for E2E tests)
npx playwright install chromium firefox webkit

# 3. Link the Supabase project and apply the migrations
supabase login
supabase link --project-ref <project-ref>   # asks for the database password
supabase db push        # applies supabase/migrations/ to the linked project

# 4. Create your env file
cp .env.example .env.local
```

`<project-ref>` is the ID in the project URL (`https://<project-ref>.supabase.co`). If the project already has every migration, `supabase db push` reports that it's up to date.

Then fill in `.env.local` with the values from the Supabase dashboard, under **Project Settings → API**:

| Supabase dashboard | Variable(s) in `.env.local`         |
| ------------------ | ----------------------------------- |
| Project URL        | `SUPABASE_URL`, `VITE_SUPABASE_URL` |
| `anon` public key  | `VITE_SUPABASE_ANON_KEY`            |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY`         |

If the project is already linked on Vercel, `vercel env pull .env.local` downloads the same values instead.

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
| `SUPABASE_URL`              | `api/` functions | Yes, for `/api/supabase-ping` | Supabase project URL: `https://<project-ref>.supabase.co`.                                                            |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/` functions | Yes, for `/api/supabase-ping` | Service role key. **Bypasses RLS: server-side only, never expose it to the browser** (never prefix it with `VITE_`).  |
| `VITE_SUPABASE_URL`         | Frontend (Vite)  | Not yet                       | Supabase API URL for the browser client. Already provided in CI.                                                      |
| `VITE_SUPABASE_ANON_KEY`    | Frontend (Vite)  | Not yet                       | Public anon key for the browser client. Already provided in CI.                                                       |
| `E2E_BASE_URL`              | Playwright       | No                            | Runs E2E tests against an already running URL (for example a Vercel preview) instead of building and serving locally. |
| `CI`                        | Playwright       | No                            | Set automatically on GitHub Actions. Turns on retries, the GitHub reporter and the `@visual` tests.                   |

Only variables prefixed with `VITE_` are exposed to frontend code (`import.meta.env.VITE_*`). Everything else is only available to the serverless functions (`process.env.*`).

**Where the values live in other environments:**

- **Vercel (preview/production):** Project → Settings → Environment Variables. `vercel env pull .env.local` downloads them into your local file.
- **GitHub Actions:** repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, used by the E2E workflow.

## Configuration

All configuration lives in the repository root unless noted otherwise.

| File                                               | What it configures                                                                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`vite.config.ts`](vite.config.ts)                 | Vite with the React plugin, plus the **Vitest** config: `happy-dom` environment, global test APIs, setup file `src/setupTests.ts`, v8 coverage on `src/` (excluding tests, `.d.ts` and `main.tsx`)    |
| [`tsconfig.json`](tsconfig.json)                   | Strict TypeScript, `noEmit` (Vite does the bundling), `bundler` module resolution, `react-jsx`. Covers `src/`, `api/` and `shared/` (reserved for code shared by frontend and API; not created yet)   |
| [`eslint.config.mjs`](eslint.config.mjs)           | ESLint flat config: JS recommended, `typescript-eslint` recommended, React Hooks rules, `react-refresh`; `eslint-config-prettier` turns off formatting rules                                          |
| [`.prettierrc.json`](.prettierrc.json)             | Single quotes, semicolons, trailing commas, 80-column lines, 2-space indent, LF line endings. [`.prettierignore`](.prettierignore) skips build output, reports, the lockfile and screenshot baselines |
| [`playwright.config.ts`](playwright.config.ts)     | Chromium, Firefox and WebKit; builds and serves the app on `127.0.0.1:4173` unless `E2E_BASE_URL` is set; `@visual` tests and retries only in CI                                                      |
| [`supabase/config.toml`](supabase/config.toml)     | Supabase CLI configuration (project ID, Postgres 17). Its ports and local-stack settings only apply to a Docker-based local stack, which this project doesn't use                                     |
| [`package.json`](package.json) → `lint-staged`     | What the pre-commit hook runs: ESLint `--fix` + Prettier on JS/TS files, Prettier on JSON/Markdown/YAML                                                                                               |
| [`.husky/pre-commit`](.husky/pre-commit)           | Runs `lint-staged` before every commit                                                                                                                                                                |
| [`.github/workflows/`](.github/workflows/)         | `ci.yml` (lint, unit tests with coverage, `npm audit`) and `e2e.yml` (Playwright on all browsers, uploads the report)                                                                                 |
| [`.github/dependabot.yml`](.github/dependabot.yml) | Weekly update PRs on Mondays for npm and GitHub Actions; minor and patch npm updates are grouped into one PR for dev and one for production dependencies                                              |

## Usage

### Running the app

| Command           | What it runs                                                                      | URL                   |
| ----------------- | --------------------------------------------------------------------------------- | --------------------- |
| `npm run dev`     | Vite dev server with hot reload. **Frontend only**: `/api/*` is not served.       | http://localhost:5173 |
| `vercel dev`      | Frontend **and** the `api/` serverless functions, the same way Vercel serves them | http://localhost:3000 |
| `npm run preview` | Serves the production build from `dist/`. Run `npm run build` first.              | http://localhost:4173 |

Use `npm run dev` for UI work and `vercel dev` when you need the API. At the moment the homepage (`/`) shows only the **Careme** heading.

### Calling the API

With `vercel dev` running:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"2026-10-05T09:30:00.000Z"}

curl http://localhost:3000/api/supabase-ping
# {"status":"ok","message":"Supabase connection successful"}
```

Every endpoint, including its parameters and error cases, is documented in [`docs/api/`](docs/api/README.md).

### Database (Supabase)

| Command                                                                | Purpose                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `supabase migration new <name>`                                        | Create a new, empty migration file in `supabase/migrations/`   |
| `supabase db push`                                                     | Apply pending migrations to the linked project                 |
| `supabase migration list`                                              | Compare local migrations with the ones applied on the project  |
| `supabase gen types typescript --linked > src/types/database.types.ts` | Regenerate the TypeScript database types after a schema change |

To browse data, tables and policies, use the project's dashboard on [supabase.com](https://supabase.com/dashboard).

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

**Visual regression tests** are tagged `@visual`. They are skipped locally and only run in CI, because screenshots differ between operating systems. The baselines in `e2e/__screenshots__/` were generated on Linux. To update them after an intentional UI change, run this on a Linux machine:

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
api/                      Vercel serverless functions (one file = one endpoint)
  health.ts               GET /api/health
  supabase-ping.ts        GET /api/supabase-ping
docs/api/                 API documentation: index, template, one file per endpoint
e2e/                      Playwright tests
  __screenshots__/        Visual regression baselines (generated on Linux)
public/                   Static assets served as-is (empty for now)
src/                      React app
  main.tsx                Entry point, mounts <App /> into #root
  App.tsx                 Root component
  App.test.tsx            Unit test for App
  setupTests.ts           Vitest setup (jest-dom matchers)
  types/
    database.types.ts     Generated Supabase types (empty until you run `supabase gen types`)
supabase/
  config.toml             Supabase CLI configuration
  migrations/             SQL migrations: tables, signup trigger, RLS policies
.github/
  workflows/              CI and E2E pipelines
  ISSUE_TEMPLATE/         Epic, user story and technical task templates
  dependabot.yml          Dependency update schedule
.husky/                   Git hooks (pre-commit → lint-staged)
index.html                Vite HTML entry
.env.example              Template for .env.local
.nvmrc                    Node version
```

## API documentation

Each endpoint in `api/` is documented in [`docs/api/`](docs/api/), and the [API index](docs/api/README.md) lists all of them.

**When you add or change an endpoint:** copy [`docs/api/_TEMPLATE.md`](docs/api/_TEMPLATE.md), fill in every section, and add a row to the index in the same PR.

## Troubleshooting

| Problem                                                            | Fix                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint` fails with a syntax or engine error                 | Your Node version is too old. Switch to Node 22 (`nvm use`).                                                                               |
| `/api/...` returns 404                                             | You are on `npm run dev`. Use `vercel dev` instead.                                                                                        |
| `/api/supabase-ping` → `Missing Supabase environment variables`    | `.env.local` is missing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, or `vercel dev` was started before you created the file. Restart it. |
| `/api/supabase-ping` → `relation "public.profiles" does not exist` | Migrations haven't been applied to the project. Run `supabase db push`.                                                                    |
| `supabase link` / `db push` fails with an authentication error     | Run `supabase login` again and use the database password from **Project Settings → Database**.                                             |
| E2E: `Executable doesn't exist`                                    | Run `npx playwright install chromium firefox webkit`.                                                                                      |
| E2E: port 4173 already in use                                      | Stop the running `npm run preview`, or keep it running: Playwright reuses it locally.                                                      |
