-- ───────────── Finance: vendors, invoices and estimates, payments, expenses ─────────────
-- Every row belongs to one organization. The server scopes each query by the
-- verified organization ID; RLS is on with no browser policies. Links between
-- rows use (organization_id, id) pairs, so the database itself refuses a link
-- to another organization's record.
--
-- Payments here are the organization's own bookkeeping of money its customers
-- paid it (bank transfer, cash, …). Aoient never moves money for them.

create table public.finance_vendor (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  tax_id text,
  notes text,
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index finance_vendor_org_name_key on public.finance_vendor (organization_id, lower(name));

-- Invoices and estimates share one shape. Numbers run per organization and kind
-- (INV-0001, EST-0001) and are never reused.
create table public.finance_document (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'estimate')),
  number int not null check (number > 0),
  status text not null default 'draft',
  company_id uuid,
  project_id uuid,
  bill_to_name text not null,
  bill_to_email text,
  bill_to_address text,
  issue_date date not null,
  due_date date,
  currency char(3) not null,
  notes text,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(14, 2) not null default 0 check (tax_total >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0 and amount_paid <= total),
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  converted_from_id uuid,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, kind, number),
  check ((kind = 'invoice' and status in ('draft', 'issued', 'void'))
      or (kind = 'estimate' and status in ('draft', 'sent', 'accepted', 'declined'))),
  check (due_date is null or due_date >= issue_date),
  foreign key (organization_id, company_id) references public.crm_company (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete set null (project_id),
  foreign key (organization_id, converted_from_id) references public.finance_document (organization_id, id) on delete set null (converted_from_id)
);
create index finance_document_list_idx on public.finance_document (organization_id, kind, issue_date desc);
-- An estimate becomes at most one invoice.
create unique index finance_document_converted_key on public.finance_document (converted_from_id) where converted_from_id is not null;

create table public.finance_document_line (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  document_id uuid not null,
  position int not null,
  description text not null check (length(description) between 1 and 300),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  amount numeric(14, 2) not null check (amount >= 0),
  foreign key (organization_id, document_id) references public.finance_document (organization_id, id) on delete cascade
);
create index finance_document_line_doc_idx on public.finance_document_line (document_id, position);

create table public.finance_payment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  invoice_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('bank_transfer', 'cash', 'card', 'cheque', 'online', 'other')),
  reference text,
  notes text,
  recorded_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.finance_document (organization_id, id) on delete cascade
);
create index finance_payment_org_idx on public.finance_payment (organization_id, paid_on desc);
create index finance_payment_invoice_idx on public.finance_payment (invoice_id);

create table public.finance_expense (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  description text not null,
  category text not null check (category in ('travel', 'meals', 'software', 'equipment', 'office', 'marketing', 'contractors', 'utilities', 'rent', 'other')),
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null,
  spent_on date not null,
  vendor_id uuid,
  project_id uuid,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  submitted_by_member_id uuid,
  reviewed_by_member_id uuid,
  reviewed_at timestamptz,
  review_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, vendor_id) references public.finance_vendor (organization_id, id) on delete set null (vendor_id),
  foreign key (organization_id, project_id) references public.project (organization_id, id) on delete set null (project_id),
  foreign key (organization_id, submitted_by_member_id) references public.organization_member (organization_id, id) on delete set null (submitted_by_member_id),
  foreign key (organization_id, reviewed_by_member_id) references public.organization_member (organization_id, id) on delete set null (reviewed_by_member_id)
);
create index finance_expense_org_idx on public.finance_expense (organization_id, spent_on desc);
create index finance_expense_status_idx on public.finance_expense (organization_id, status);

alter table public.finance_vendor enable row level security;
alter table public.finance_document enable row level security;
alter table public.finance_document_line enable row level security;
alter table public.finance_payment enable row level security;
alter table public.finance_expense enable row level security;
