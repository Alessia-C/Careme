-- Admins can no longer change their own role or status: this avoids an
-- admin-less application (e.g. the last admin blocking themselves).
-- Admins can still edit their own first_name/last_name and change role/status
-- of other users. Replaces the function from 20261018120000; the trigger
-- profiles_prevent_privilege_change already points to it by name.
create or replace function public.prevent_privilege_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- auth.uid() is null for the service role and the SQL editor, so trusted
  -- back-office changes (e.g. promoting the first admin) still work.
  if auth.uid() is not null
    and (new.role is distinct from old.role or new.status is distinct from old.status)
  then
    -- Checked first so non-admins keep getting this message.
    if not public.is_admin() then
      raise exception 'Only admins can change role or status';
    end if;

    if auth.uid() = old.id then
      raise exception 'Admins cannot change their own role or status';
    end if;
  end if;
  return new;
end;
$$;
