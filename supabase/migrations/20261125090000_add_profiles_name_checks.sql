-- Limits of the profiles name columns, mirroring PROFILE_NAME_MAX_LENGTH in
-- shared/validation.ts (not blank, up to 50 characters). The API already
-- enforces them; the database is the last line of defense for any other writer
-- (PostgREST with a user JWT, signup metadata sent straight to Supabase Auth).
--
-- "Not blank" means at least one non-whitespace character (\S): btrim() alone
-- strips only spaces, so a name of tabs or newlines would pass.
-- The length is checked on the stored value, so padding with spaces cannot
-- exceed it. char_length counts code points while the API counts UTF-16 units,
-- so the API is slightly stricter with emoji.
-- NULL stays allowed: a check that evaluates to NULL passes, and users created
-- without metadata have no names.
--
-- The constraints are validated against the existing rows: applying the
-- migration fails, changing nothing, if a profile violates them.
-- Does not touch RLS, handle_new_user or the privilege triggers.
alter table public.profiles
  add constraint profiles_first_name_length
    check (first_name ~ '\S' and char_length(first_name) <= 50),
  add constraint profiles_last_name_length
    check (last_name ~ '\S' and char_length(last_name) <= 50);
