-- Aoient — initial schema (Supabase Postgres).
-- Identity lives in Supabase Auth (auth.users). Everything below is in `public`.
--
-- Access model: the Next.js server connects with the database connection string
-- and enforces tenancy + RBAC itself (src/server/tenancy). Row Level Security is
-- ENABLED on every table with NO policies for the `anon` / `authenticated` roles,
-- so the public Supabase key used in the browser cannot read or write any of it.

create extension if not exists pgcrypto;

create type user_status as enum ('active', 'deactivated');
create type organization_status as enum ('active', 'suspended', 'archived');
create type member_status as enum ('active', 'suspended');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type audit_source as enum ('web', 'api', 'system', 'webhook');

-- ───────────── Profiles (mirror of auth.users kept by triggers) ─────────────
create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  email_verified boolean not null default false,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profile_email_key on public.profile (lower(email));

create or replace function public.sync_profile_from_auth() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, name, email, email_verified)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    email = excluded.email,
    email_verified = excluded.email_verified,
    name = case when nullif(trim(new.raw_user_meta_data ->> 'name'), '') is not null
                then excluded.name else public.profile.name end,
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_changed
  after insert or update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- ───────────── Rate limiting ─────────────
create table public.rate_limit_bucket (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);

-- ───────────── Tenancy ─────────────
create table public.organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  currency char(3) not null default 'USD',
  status organization_status not null default 'active',
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System roles: organization_id is null and is_system = true (shared by all tenants).
create table public.role (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organization (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
create index role_organization_id_idx on public.role (organization_id);
create unique index role_system_key_key on public.role (key) where organization_id is null;

create table public.permission (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null,
  module text not null,
  created_at timestamptz not null default now()
);

create table public.role_permission (
  role_id uuid not null references public.role (id) on delete cascade,
  permission_id uuid not null references public.permission (id) on delete cascade,
  primary key (role_id, permission_id)
);
create index role_permission_permission_id_idx on public.role_permission (permission_id);

create table public.organization_member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  user_id uuid not null references public.profile (id) on delete cascade,
  role_id uuid not null references public.role (id) on delete restrict,
  status member_status not null default 'active',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_member_user_id_idx on public.organization_member (user_id);
create index organization_member_org_status_idx on public.organization_member (organization_id, status);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  email text not null,
  role_id uuid not null references public.role (id) on delete restrict,
  -- SHA-256 of the random token. The raw token only exists in the email link.
  token_hash text not null unique,
  status invitation_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by_id uuid references public.profile (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invitation_org_status_idx on public.invitation (organization_id, status);
create index invitation_email_idx on public.invitation (email);
create unique index invitation_org_email_pending_key on public.invitation (organization_id, lower(email)) where status = 'pending';

-- ───────────── Audit ─────────────
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organization (id) on delete cascade,
  actor_user_id uuid references public.profile (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  source audit_source not null default 'web',
  correlation_id text,
  -- Sanitised metadata only — never secrets, tokens or payment payloads.
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (organization_id, created_at);
create index audit_log_org_action_idx on public.audit_log (organization_id, action);
create index audit_log_actor_idx on public.audit_log (actor_user_id);

-- ───────────── Lock down the Data API ─────────────
alter table public.profile enable row level security;
alter table public.rate_limit_bucket enable row level security;
alter table public.organization enable row level security;
alter table public.role enable row level security;
alter table public.permission enable row level security;
alter table public.role_permission enable row level security;
alter table public.organization_member enable row level security;
alter table public.invitation enable row level security;
alter table public.audit_log enable row level security;
-- Intentionally no policies: anon/authenticated get nothing through the Data API.
