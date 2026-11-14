# Workflow and conventions

Moved from CLAUDE.md. Read it when starting an issue, opening a PR or documenting a change.

- When adding or changing an endpoint, copy `docs/api/_TEMPLATE.md` into `docs/api/<endpoint>.md` and add a row to `docs/api/README.md` in the same PR.
- When adding or changing a user-facing feature, copy `docs/features/_TEMPLATE.md` into `docs/features/<feature-name>.md` and add a row to `docs/features/README.md` in the same PR. Feature docs are in English.

- Commit style: Conventional Commits (`feat:`, `docs:`, `test(e2e):`, `chore(deps):`); feature branches named `<issue>-mk-xxx-<slug>` (e.g. `54-mk-019-tech-zustand-store-for-session-role`, issue #54) created from `staging` and merged via PR to `staging`, the integration branch (epics have no container branch; if a feature has BE and FE issues, the BE goes to `staging` first). `main` is production and only receives PRs from `staging`, merged with a merge commit (not squash). Vercel deploys `main` to production and builds a preview for every branch, so every PR gets one (`vercel.json`); CI and E2E run only on PRs and pushes to `staging` and `main`.

## Workflow issue

Every issue follows these steps, in order. Do not skip the approval step.

1. **Analyze**: run `/issue <number>`, which uses the `issue-planner` agent (`.claude/agents/issue-planner.md`, read-only) on the GitHub issue number. If the issue touches `api/`, also run `/backend` (`backend-architect`, read-only) to design the endpoint. If it touches `src/`, also run `/frontend` (`frontend-architect`, read-only) to design the page, component or hook. Their output goes into the plan.
2. **Approve**: present the plan and stop. Do not edit or create any file until the user explicitly approves the plan. Open questions in the plan must be answered first.
3. **Implement**: on a branch `<issue>-mk-xxx-<slug>` from `staging`, following the approved plan. If the plan changes during implementation, stop and ask again.
4. **Document**: run `/docs <number>` (`docs-writer`, writes only under `docs/features/` and `docs/api/`). Review the docs in the PR like any other change.
5. **Verify**: run `/quality-check` (`code-quality-reviewer`, read-only), then `npm run lint`, `npm run format:check`, `npm run build` and `npm test`. If the change touches `api/`, `supabase/`, auth, RLS, env vars or dependencies, also run `/security-audit` (`security-auditor`, read-only). If the change touches the UI (`src/pages/`, `src/components/`, `src/routes/`), also run `/a11y-audit` (`accessibility-auditor`, read-only) and `/perf-check` (`frontend-performance-auditor`, read-only). If the change touches `api/`, also run `/backend` to review the implemented endpoint. If it touches `src/`, also run `/frontend` to review the code.
6. **Ship**: commit with Conventional Commits and open the PR to `staging`. A PR to `staging` must get a Vercel preview deployment, as a PR to `main` does: check that the preview is built before asking for a review. Releases go through a PR from `staging` to `main` (merge commit). Commit and push only when the user asks.
