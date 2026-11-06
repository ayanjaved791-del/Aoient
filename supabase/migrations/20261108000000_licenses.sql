-- ───────────── Licenses (one per organization) ─────────────
-- What an organization may use comes from here. Rows change only on the
-- server: a trial when the organization is created, and verified Paddle
-- webhooks afterwards. Never from the browser.
create table public.organization_license (
  organization_id uuid primary key references public.organization (id) on delete cascade,
  plan text not null check (plan in ('medisea', 'indiana', 'pacfic_deepdive')),
  billing_interval text check (billing_interval in ('monthly', 'yearly')),
  -- trialing (app trial or Paddle trial), active, past_due (grace), paused, canceled
  status text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  source text not null check (source in ('trial', 'paddle')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  paddle_subscription_id text unique,
  paddle_customer_id text,
  -- occurred_at of the last applied Paddle event; older events are ignored.
  paddle_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every Paddle webhook event id is stored once, so retries are not applied twice.
create table public.paddle_webhook_event (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  organization_id uuid references public.organization (id) on delete set null,
  outcome text not null,
  received_at timestamptz not null default now()
);
create index paddle_webhook_event_org_idx on public.paddle_webhook_event (organization_id, received_at);

alter table public.organization_license enable row level security;
alter table public.paddle_webhook_event enable row level security;

-- Existing organizations start a 14-day trial today.
insert into public.organization_license (organization_id, plan, status, source, trial_ends_at)
select id, 'medisea', 'trialing', 'trial', now() + interval '14 days'
from public.organization
on conflict (organization_id) do nothing;
