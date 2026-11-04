create extension if not exists pgcrypto;

create type public.plan_type as enum ('free', 'starter', 'pro', 'team');
create type public.model_type as enum ('claude', 'gpt', 'gemini');
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.workspace_role as enum ('admin', 'member', 'viewer');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  plan public.plan_type not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  api_key_anthropic text,
  api_key_openai text,
  api_key_google text,
  theme text not null default 'midnight',
  messages_used_this_month integer not null default 0 check (messages_used_this_month >= 0),
  billing_period_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null default 'New conversation',
  model public.model_type not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  model public.model_type,
  tokens_input integer not null default 0 check (tokens_input >= 0),
  tokens_output integer not null default 0 check (tokens_output >= 0),
  created_at timestamptz not null default now()
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  model public.model_type not null,
  tokens_input integer not null default 0 check (tokens_input >= 0),
  tokens_output integer not null default 0 check (tokens_output >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations(user_id, updated_at desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index usage_logs_user_created_idx on public.usage_logs(user_id, created_at desc);
create index prompts_user_created_idx on public.prompts(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

create trigger prompts_set_updated_at before update on public.prompts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.prompts enable row level security;
alter table public.usage_logs enable row level security;

create policy "users can read own profile" on public.users
for select using (auth.uid() = id);

create policy "users can update own profile" on public.users
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can read own workspaces" on public.workspaces
for select using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
  )
);

create policy "owners can manage workspaces" on public.workspaces
for all using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can read memberships" on public.workspace_members
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  )
);

create policy "owners can manage memberships" on public.workspace_members
for all using (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspaces w
    where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
  )
);

create policy "users can manage own conversations" on public.conversations
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can manage own messages" on public.messages
for all using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = auth.uid()
  )
);

create policy "users can manage own prompts" on public.prompts
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can read public prompts" on public.prompts
for select using (is_public or user_id = auth.uid());

create policy "users can read own usage" on public.usage_logs
for select using (user_id = auth.uid());
