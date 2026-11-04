create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  plan text not null default 'free' check (plan in ('free', 'season_pass', 'lifetime')),
  unlocked_skins text[] not null default array['midnight', 'snow', 'glass-day'],
  license_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null,
  stripe_session_id text not null unique,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists users_license_token_idx on public.users (license_token);
create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_stripe_session_id_idx on public.purchases (stripe_session_id);

alter table public.users enable row level security;
alter table public.purchases enable row level security;

drop policy if exists "service role manages users" on public.users;
drop policy if exists "service role manages purchases" on public.purchases;

create policy "service role manages users"
  on public.users
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role manages purchases"
  on public.purchases
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
