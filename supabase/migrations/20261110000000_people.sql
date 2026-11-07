-- ───────────── People: departments, employee records, leave ─────────────
-- Every row belongs to one organization. The server scopes each query by the
-- verified organization ID; RLS is on with no browser policies.

create table public.department (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  description text,
  head_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index department_org_name_key on public.department (organization_id, lower(name));

create table public.employee (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  -- Set when the person is also a member of the workspace (has an account).
  member_id uuid references public.organization_member (id) on delete set null,
  employee_code text,
  full_name text not null,
  work_email text,
  phone text,
  job_title text,
  department_id uuid references public.department (id) on delete set null,
  manager_id uuid references public.employee (id) on delete set null,
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time', 'contract', 'intern')),
  location text,
  start_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Sensitive: only shown to roles with people.employee.sensitive.read, or to the person themselves.
  date_of_birth date,
  personal_email text,
  home_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  salary_amount numeric(14, 2) check (salary_amount is null or salary_amount >= 0),
  salary_currency char(3),
  salary_period text check (salary_period is null or salary_period in ('hourly', 'monthly', 'yearly')),
  created_by_id uuid references public.profile (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_id is null or manager_id <> id)
);
create unique index employee_org_member_key on public.employee (organization_id, member_id) where member_id is not null;
create unique index employee_org_email_key on public.employee (organization_id, lower(work_email)) where work_email is not null;
create unique index employee_org_code_key on public.employee (organization_id, lower(employee_code)) where employee_code is not null;
create index employee_org_status_idx on public.employee (organization_id, status);
create index employee_department_idx on public.employee (department_id);
create index employee_manager_idx on public.employee (manager_id);

alter table public.department
  add constraint department_head_employee_fk foreign key (head_employee_id) references public.employee (id) on delete set null;

create table public.leave_request (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  employee_id uuid not null references public.employee (id) on delete cascade,
  type text not null check (type in ('annual', 'sick', 'unpaid', 'other')),
  start_date date not null,
  end_date date not null,
  days numeric(5, 1) not null check (days > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by_id uuid references public.profile (id) on delete set null,
  decided_by_id uuid references public.profile (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_request_org_status_idx on public.leave_request (organization_id, status);
create index leave_request_employee_idx on public.leave_request (employee_id, start_date);

alter table public.department enable row level security;
alter table public.employee enable row level security;
alter table public.leave_request enable row level security;
