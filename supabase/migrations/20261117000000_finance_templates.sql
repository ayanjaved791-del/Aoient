-- ───────────── Finance: how invoices, estimates and receipts look ─────────────
-- One row per organization, edited in Finance → Editor. Nothing here is money;
-- it's the layout, colour, business details and wording printed on documents.
create table public.finance_template (
  organization_id uuid primary key references public.organization (id) on delete cascade,
  layout text not null default 'classic' check (layout in ('classic', 'modern', 'compact')),
  accent text not null default '#0a0a0a' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  show_logo boolean not null default true,
  business_name text,
  business_address text,
  business_email text,
  business_phone text,
  tax_id text,
  invoice_title text not null default 'Invoice',
  estimate_title text not null default 'Estimate',
  receipt_title text not null default 'Payment receipt',
  default_notes text,
  footer text,
  default_due_days int not null default 14 check (default_due_days between 0 and 365),
  default_tax_rate numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100),
  updated_by_id uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.finance_template enable row level security;
