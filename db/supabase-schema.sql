create table if not exists public.app_users (
  id uuid primary key,
  email text not null unique,
  password jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  id uuid primary key,
  token_hash text not null unique,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_token_hash_idx on public.app_sessions(token_hash);
create index if not exists app_sessions_expires_at_idx on public.app_sessions(expires_at);

create table if not exists public.interview_kits (
  id uuid primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  kit jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_kits_user_updated_idx on public.interview_kits(user_id, updated_at desc);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.interview_kits enable row level security;

-- The application uses the server-only service_role key from API routes. RLS still
-- protects browser clients, while these grants let the trusted server persist kits.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.app_users to service_role;
grant select, insert, update, delete on public.app_sessions to service_role;
grant select, insert, update, delete on public.interview_kits to service_role;
