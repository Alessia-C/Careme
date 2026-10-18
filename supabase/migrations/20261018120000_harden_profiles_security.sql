-- Hardens profiles and products security:
--  1. handle_new_user runs as security definer, so the profile row is created
--     even though no INSERT policy exists on profiles.
--  2. Admin checks go through security definer helpers: querying profiles
--     from a profiles policy would recurse infinitely.
--  3. Only admins can change role/status (enforced by a trigger, because RLS
--     cannot restrict single columns).
--  4. Blocked users cannot read or write anything (existing sessions stay
--     valid until token expiry, so this must live in RLS).

-- 1. Signup trigger: take only first_name/last_name from user-controlled
--    metadata, role and status always use the table defaults.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

-- 2. Helpers used by the policies. security definer bypasses RLS on profiles,
--    which avoids the recursion.
create function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

revoke execute on function public.is_active() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_active() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 3. Block role/status changes by non-admins. auth.uid() is null for the
--    service role and the SQL editor, so trusted back-office changes
--    (e.g. promoting the first admin) still work.
create function public.prevent_privilege_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and not public.is_admin()
    and (new.role is distinct from old.role or new.status is distinct from old.status)
  then
    raise exception 'Only admins can change role or status';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_change
  before update on public.profiles
  for each row execute function public.prevent_privilege_change();

-- 4. Recreate policies, requiring an active profile.
drop policy "Users can view own profile" on public.profiles;
drop policy "Users can update own profile" on public.profiles;
drop policy "Admins can view all profiles" on public.profiles;
drop policy "Admins can update all profiles" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id and public.is_active());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id and public.is_active())
  with check (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy "Users can view own products" on public.products;
drop policy "Users can insert own products" on public.products;
drop policy "Users can update own products" on public.products;
drop policy "Users can delete own products" on public.products;

create policy "Users can view own products"
  on public.products for select
  using (auth.uid() = user_id and public.is_active());

create policy "Users can insert own products"
  on public.products for insert
  with check (auth.uid() = user_id and public.is_active());

create policy "Users can update own products"
  on public.products for update
  using (auth.uid() = user_id and public.is_active())
  with check (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.products for delete
  using (auth.uid() = user_id and public.is_active());
