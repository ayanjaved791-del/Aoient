-- ───────────── Inventory: locations, products, stock and movements ─────────────
-- ───────────── Attendance: daily check-in / check-out per employee ─────────────
-- Every row belongs to one organization; links use (organization_id, id) pairs
-- so the database refuses a link to another organization's record. RLS is on
-- with no browser policies; the server scopes each query by the verified org.

create table public.inventory_location (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  name text not null,
  address text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index inventory_location_org_name_key on public.inventory_location (organization_id, lower(name));

create table public.inventory_product (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  unit text not null default 'pcs',
  cost_price numeric(14, 2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14, 2) not null default 0 check (sale_price >= 0),
  reorder_level numeric(12, 2) not null default 0 check (reorder_level >= 0),
  archived_at timestamptz,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index inventory_product_org_sku_key on public.inventory_product (organization_id, lower(sku));
create index inventory_product_org_name_idx on public.inventory_product (organization_id, lower(name));

-- Quantity on hand per product and location. The check keeps stock from ever
-- going below zero, whatever the application does.
create table public.inventory_stock (
  organization_id uuid not null references public.organization (id) on delete cascade,
  product_id uuid not null,
  location_id uuid not null,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id),
  foreign key (organization_id, product_id) references public.inventory_product (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id) references public.inventory_location (organization_id, id) on delete cascade
);
create index inventory_stock_org_idx on public.inventory_stock (organization_id);

-- Every change to stock, in order. Movements are never edited: a mistake is
-- fixed with a new adjustment, so the history always adds up.
create table public.inventory_movement (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  product_id uuid not null,
  location_id uuid not null,
  kind text not null check (kind in ('receive', 'issue', 'adjust', 'transfer_in', 'transfer_out')),
  quantity numeric(12, 2) not null check (quantity <> 0),
  balance_after numeric(12, 2) not null check (balance_after >= 0),
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  reference text,
  note text,
  transfer_id uuid,
  created_by_id uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind in ('receive', 'transfer_in') and quantity > 0) or (kind in ('issue', 'transfer_out') and quantity < 0) or kind = 'adjust'),
  foreign key (organization_id, product_id) references public.inventory_product (organization_id, id) on delete cascade,
  foreign key (organization_id, location_id) references public.inventory_location (organization_id, id) on delete cascade
);
create index inventory_movement_org_idx on public.inventory_movement (organization_id, created_at desc);
create index inventory_movement_product_idx on public.inventory_movement (product_id, created_at desc);

-- Attendance links to employee records by (organization_id, id).
alter table public.employee add constraint employee_org_id_key unique (organization_id, id);

-- When the working day starts, so check-ins after start + grace count as late.
create table public.attendance_setting (
  organization_id uuid primary key references public.organization (id) on delete cascade,
  work_starts time not null default '09:00',
  grace_minutes int not null default 15 check (grace_minutes between 0 and 240),
  updated_at timestamptz not null default now()
);

create table public.attendance_record (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization (id) on delete cascade,
  employee_id uuid not null,
  work_date date not null,
  status text not null default 'present' check (status in ('present', 'half_day', 'absent')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  note text,
  -- 'self' when the person checked in; 'manager' once someone corrected it.
  source text not null default 'self' check (source in ('self', 'manager')),
  corrected_by_id uuid references public.profile (id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, work_date),
  check (check_out_at is null or (check_in_at is not null and check_out_at > check_in_at)),
  check (status <> 'absent' or (check_in_at is null and check_out_at is null)),
  foreign key (organization_id, employee_id) references public.employee (organization_id, id) on delete cascade
);
create index attendance_record_org_date_idx on public.attendance_record (organization_id, work_date);

alter table public.inventory_location enable row level security;
alter table public.inventory_product enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_movement enable row level security;
alter table public.attendance_setting enable row level security;
alter table public.attendance_record enable row level security;
