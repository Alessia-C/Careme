<!--
Feature documentation template.

How to use:
1. Copy this file to docs/features/<feature-name>.md (kebab-case, e.g. product-list.md).
2. Fill in every section. If a section does not apply, write "None" — do not delete it.
3. Add a row for the feature to docs/features/README.md.
4. Update the doc in the same PR whenever the feature's behavior changes.
-->

# <Feature name>

One or two sentences: what the feature lets the user do and why it exists.

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| **Status**    | Planned \| In progress \| Stable \| Deprecated                   |
| **Issue**     | [#<number>](https://github.com/Alessia-C/Careme/issues/<number>) |
| **Users**     | Logged-in user \| Admin \| Anonymous                             |
| **Pages**     | `/path` (see [`src/router.tsx`](../../src/router.tsx))           |
| **Endpoints** | [`/api/...`](../api/README.md) or None                           |

## Behavior

Step-by-step description of what the user sees and does, including empty, loading and error states.

## Business rules

- Rule 1, stated as a fact (e.g. "A product always belongs to exactly one user.")
- Rule 2

## Data

Tables and columns read or written, with the constraints that matter (e.g. `products.status` is `new | used | finished`). Link to the migration that created them.

## Security and access

- Who can see and change the data (role, ownership, RLS policy names).
- How a `blocked` user is handled.
- Anything that must never be writable by a non-admin.

## Tests

- Unit tests: [`path/to/file.test.tsx`](../../path/to/file.test.tsx)
- E2E tests: [`e2e/file.spec.ts`](../../e2e/file.spec.ts) or None

## Open decisions

- Decision still pending, and who needs to decide. Write "None" if there are none.

## Changelog

| Date       | Change                 | PR        |
| ---------- | ---------------------- | --------- |
| YYYY-MM-DD | Initial implementation | #<number> |
