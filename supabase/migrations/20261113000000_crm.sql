-- ───────────── CRM: companies, contacts, leads, pipeline, deals, notes ─────────────
-- Every row belongs to one organization. The server scopes each query by the
-- verified organization ID; RLS is on with no browser policies.
-- References between CRM rows use (organization_id, id) pairs, so the database
-- itself refuses a link to another organization's record.

-- Lets CRM rows name a record owner that must be a member of the same organization.
create unique index organization_member_org_id_key on public.organization_member (organization_id, id);

create table public.crm_company (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  website text,
  industry text,
  phone text,
  city text,
  owner_member_id uuid,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, owner_member_id) references public.organization_member (organization_id, id) on delete set null (owner_member_id)
);
create unique index crm_company_org_name_key on public.crm_company (organization_id, lower(name));

create table public.crm_contact (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  company_id uuid,
  full_name text not null,
  email text,
  phone text,
  job_title text,
  owner_member_id uuid,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, company_id) references public.crm_company (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, owner_member_id) references public.organization_member (organization_id, id) on delete set null (owner_member_id)
);
create unique index crm_contact_org_email_key on public.crm_contact (organization_id, lower(email)) where email is not null;
create index crm_contact_company_idx on public.crm_contact (organization_id, company_id);

create table public.crm_stage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  position int not null,
  -- open stages are the working pipeline; a deal in a won or lost stage is closed.
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  probability int not null default 0 check (probability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index crm_stage_org_name_key on public.crm_stage (organization_id, lower(name));
create index crm_stage_org_position_idx on public.crm_stage (organization_id, position);

create table public.crm_deal (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  title text not null,
  stage_id uuid not null,
  company_id uuid,
  contact_id uuid,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency char(3) not null,
  expected_close_date date,
  owner_member_id uuid,
  closed_at timestamptz,
  lost_reason text,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, stage_id) references public.crm_stage (organization_id, id),
  foreign key (organization_id, company_id) references public.crm_company (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, contact_id) references public.crm_contact (organization_id, id) on delete set null (contact_id),
  foreign key (organization_id, owner_member_id) references public.organization_member (organization_id, id) on delete set null (owner_member_id)
);
create index crm_deal_org_stage_idx on public.crm_deal (organization_id, stage_id) where archived_at is null;
create index crm_deal_company_idx on public.crm_deal (organization_id, company_id);
create index crm_deal_contact_idx on public.crm_deal (organization_id, contact_id);

create table public.crm_lead (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  company_name text,
  source text not null default 'other' check (source in ('website', 'referral', 'event', 'social', 'outbound', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'disqualified', 'converted')),
  estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  owner_member_id uuid,
  converted_contact_id uuid,
  converted_deal_id uuid,
  converted_at timestamptz,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, owner_member_id) references public.organization_member (organization_id, id) on delete set null (owner_member_id),
  foreign key (organization_id, converted_contact_id) references public.crm_contact (organization_id, id) on delete set null (converted_contact_id),
  foreign key (organization_id, converted_deal_id) references public.crm_deal (organization_id, id) on delete set null (converted_deal_id)
);
create index crm_lead_org_status_idx on public.crm_lead (organization_id, status) where archived_at is null;

-- Notes on any CRM record. The server checks the record belongs to the same organization.
create table public.crm_note (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  subject_type text not null check (subject_type in ('lead', 'contact', 'company', 'deal')),
  subject_id uuid not null,
  body text not null check (length(body) between 1 and 4000),
  author_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);
create index crm_note_subject_idx on public.crm_note (organization_id, subject_type, subject_id, created_at desc);

alter table public.crm_company enable row level security;
alter table public.crm_contact enable row level security;
alter table public.crm_stage enable row level security;
alter table public.crm_deal enable row level security;
alter table public.crm_lead enable row level security;
alter table public.crm_note enable row level security;
