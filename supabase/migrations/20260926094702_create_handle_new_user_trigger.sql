create function public.handle_new_user()
returns trigger
language plpgsql
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data->> 'first_name', new.raw_user_meta_data->> 'last_name');
  return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();