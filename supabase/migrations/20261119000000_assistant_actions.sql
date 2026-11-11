-- ───────────── Assistant: actions waiting for the person's OK ─────────────
-- When someone asks the assistant to create or delete something, it stores the
-- exact change here and shows it. Only the same member, in the same
-- organization, within 10 minutes, can confirm it, and only once. The change
-- itself then runs through the normal service, which checks permissions again.
create table public.assistant_action (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  member_id uuid not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  summary text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  resolved_at timestamptz,
  foreign key (organization_id, member_id) references public.organization_member (organization_id, id) on delete cascade
);
create index assistant_action_member_idx on public.assistant_action (member_id, status, created_at desc);
alter table public.assistant_action enable row level security;
