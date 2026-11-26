-- Limits of the profiles name columns, mirroring PROFILE_NAME_MAX_LENGTH in
-- shared/validation.ts (not blank, up to 50 characters). The API already
-- enforces them; the database is the last line of defense for any other writer
-- (PostgREST with a user JWT, signup metadata sent straight to Supabase Auth).
--
-- The length is checked on the stored value, so padding with spaces cannot
-- exceed it. NULL stays allowed: a check that evaluates to NULL passes, and
-- users created without metadata have no names.
--
-- The constraints are validated against the existing rows: applying the
-- migration fails, changing nothing, if a profile violates them.
-- Does not touch RLS, handle_new_user or the privilege triggers.
alter table public.profiles
  add constraint profiles_first_name_length
    check (btrim(first_name) <> '' and char_length(first_name) <= 50),
  add constraint profiles_last_name_length
    check (btrim(last_name) <> '' and char_length(last_name) <= 50);
