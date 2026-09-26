create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  brand text not null,
  status text not null default 'new' check (status in ('new', 'used', 'finished')),
  category text not null check (category in ('skincare', 'makeup')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;