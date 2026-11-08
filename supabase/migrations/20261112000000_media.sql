-- ───────────── Organization logos and profile pictures ─────────────
-- Small images (resized in the browser, re-checked on the server) are kept in
-- the database so they share its backups, access rules and tenant isolation;
-- no separate storage service is needed. The *_updated_at columns double as
-- a cache-busting version for the image URL and are null when there's no image.
alter table public.organization add column if not exists logo_updated_at timestamptz;
alter table public.profile add column if not exists avatar_updated_at timestamptz;

create table if not exists public.organization_logo (
  organization_id uuid primary key references public.organization (id) on delete cascade,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null check (octet_length(data) <= 524288),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_avatar (
  user_id uuid primary key references public.profile (id) on delete cascade,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null check (octet_length(data) <= 524288),
  updated_at timestamptz not null default now()
);

-- Served only by the app's server after a membership check; never to the browser directly.
alter table public.organization_logo enable row level security;
alter table public.profile_avatar enable row level security;
