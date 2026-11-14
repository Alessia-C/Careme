# Commands

Full command reference, moved from CLAUDE.md. Read it when running or debugging tests and builds.

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
