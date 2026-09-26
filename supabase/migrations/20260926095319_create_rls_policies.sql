-- PROFILES: l'utente vede/modifica solo la propria riga
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- PROFILES: l'admin vede/modifica tutte le righe
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- PRODUCTS: owner-only, nessun bypass admin 
create policy "Users can view own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Users can insert own products"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "Users can update own products"
  on public.products for update
  using (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.products for delete
  using (auth.uid() = user_id);