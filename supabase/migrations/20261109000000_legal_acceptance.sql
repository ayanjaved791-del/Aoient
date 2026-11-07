-- ───────────── Terms & Privacy acceptance ─────────────
-- One row each time someone agrees to the Terms of Service and Privacy Policy:
-- before creating a workspace and before every plan purchase. Written only by
-- the server; never readable from the browser.
create table public.legal_acceptance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (id) on delete cascade,
  organization_id uuid references public.organization (id) on delete set null,
  context text not null check (context in ('workspace', 'checkout')),
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now()
);
create index legal_acceptance_user_idx on public.legal_acceptance (user_id, accepted_at desc);
alter table public.legal_acceptance enable row level security;
