# Database

Moved from CLAUDE.md. Read it when changing the schema, RLS or types.

- **Database**: hosted Supabase (Postgres 17, Auth, RLS) — no Docker/local stack. Schema lives only in `supabase/migrations/` (`supabase migration new <name>`, `supabase db push`). Tables: `profiles` (1:1 with `auth.users`, auto-created from signup metadata `first_name`/`last_name` by the `handle_new_user` trigger; `role` is `user|admin`, `status` is `active|blocked`; admins can read/update all profiles) and `products` (`user_id` → `profiles.id`; `category` is `skincare|makeup`, `status` is `new|used|finished`; owner-only RLS for all CRUD, no admin bypass). Enum-like values are `text` + `check` constraints, not Postgres enums. Schema changes always go in a new migration. After a schema change regenerate types: `supabase gen types typescript --linked > src/types/database.types.ts` (currently empty, hence `'profiles' as never` casts).
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS: use only in `api/`, never with a `VITE_` prefix.
