-- ───────────── Time: entries, running timers, weekly timesheets ─────────────
-- Every row belongs to one organization; links use (organization_id, id) pairs
-- so the database refuses a link to another organization's record. RLS is on
-- with no browser policies; the server scopes each query by the verified org.

-- Weekly timesheets (weeks start on Monday). While a week is submitted or
-- approved its entries are locked; a rejected week can be corrected and sent again.
create table public.time_timesheet (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  member_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by_member_id uuid,
  reviewed_at timestamptz,
  review_note text,
  unique (organization_id, id),
  unique (organization_id, member_id, week_start),
  foreign key (organization_id, member_id) references public.organization_member (organization_id, id) on delete cascade,
  foreign key (organization_id, reviewed_by_member_id) references public.organization_member (organization_id, id) on delete set null (reviewed_by_member_id)
);
create index time_timesheet_status_idx on public.time_timesheet (organization_id, status, week_start);

create table public.time_entry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  member_id uuid not null,
  project_id uuid,
  task_id uuid,
  description text,
  work_date date not null,
  -- A running timer has started_at and no minutes yet; at most one per person.
  started_at timestamptz,
  minutes int check (minutes is null or minutes between 1 and 1440),
  billable boolean not null default false,
  -- Set when the hours were put on an invoice; deleting that draft frees them.
  invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minutes is not null or started_at is not null),
  foreign key (organization_id, member_id) references public.organization_member (organization_id, id) on delete cascade,
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete set null (project_id),
  foreign key (organization_id, task_id) references public.project_task (organization_id, id) on delete set null (task_id),
  foreign key (organization_id, invoice_id) references public.finance_document (organization_id, id) on delete set null (invoice_id)
);
create unique index time_entry_one_running_key on public.time_entry (member_id) where minutes is null;
create index time_entry_member_day_idx on public.time_entry (organization_id, member_id, work_date);
create index time_entry_project_idx on public.time_entry (organization_id, project_id, work_date);

alter table public.time_timesheet enable row level security;
alter table public.time_entry enable row level security;
