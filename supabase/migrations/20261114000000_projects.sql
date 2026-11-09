-- ───────────── Projects: projects, members, milestones, tasks, comments ─────────────
-- Every row belongs to one organization. The server scopes each query by the
-- verified organization ID; RLS is on with no browser policies. Links use
-- (organization_id, id) pairs so the database refuses cross-organization links.

create table public.project (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  company_id uuid,
  deal_id uuid,
  owner_member_id uuid,
  start_date date,
  due_date date,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (organization_id, company_id) references public.crm_company (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, deal_id) references public.crm_deal (organization_id, id) on delete set null (deal_id),
  foreign key (organization_id, owner_member_id) references public.organization_member (organization_id, id) on delete set null (owner_member_id)
);
create unique index project_org_name_key on public.project (organization_id, lower(name)) where archived_at is null;
create unique index project_org_deal_key on public.project (organization_id, deal_id) where deal_id is not null;
create index project_org_status_idx on public.project (organization_id, status) where archived_at is null;

create table public.project_member (
  organization_id uuid not null references public.organization (id) on delete cascade,
  project_id uuid not null,
  member_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (project_id, member_id),
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete cascade,
  foreign key (organization_id, member_id) references public.organization_member (organization_id, id) on delete cascade
);
create index project_member_member_idx on public.project_member (organization_id, member_id);

create table public.project_milestone (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  project_id uuid not null,
  name text not null,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete cascade
);
create index project_milestone_project_idx on public.project_milestone (project_id, due_date);

create table public.project_task (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  project_id uuid not null,
  milestone_id uuid,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_member_id uuid,
  due_date date,
  position double precision not null default 0,
  completed_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete cascade,
  foreign key (organization_id, milestone_id) references public.project_milestone (organization_id, id) on delete set null (milestone_id),
  foreign key (organization_id, assignee_member_id) references public.organization_member (organization_id, id) on delete set null (assignee_member_id)
);
create index project_task_project_idx on public.project_task (project_id, status, position);
create index project_task_assignee_idx on public.project_task (organization_id, assignee_member_id) where status <> 'done';

create table public.project_task_comment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  task_id uuid not null,
  body text not null check (length(body) between 1 and 4000),
  author_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, task_id) references public.project_task (organization_id, id) on delete cascade
);
create index project_task_comment_task_idx on public.project_task_comment (task_id, created_at);

alter table public.project enable row level security;
alter table public.project_member enable row level security;
alter table public.project_milestone enable row level security;
alter table public.project_task enable row level security;
alter table public.project_task_comment enable row level security;
