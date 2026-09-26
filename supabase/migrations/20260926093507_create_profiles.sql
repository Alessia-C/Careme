create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check ( status in  ('active', 'blocked')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
