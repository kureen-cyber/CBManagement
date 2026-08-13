-- =============================================================================
-- CBManagement — Supabase schema inventory
-- Project: azqufyyrchtpjjdjscua
-- Paste into: SQL Editor → New query → Run
-- Money fields are integer cents (TT$). Dates are timestamptz.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) Helper: updated_at trigger function
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Tenancy: companies, profiles, membership
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'TTD',
  vat_rate numeric(6,4) not null default 0.125,
  business_type text not null default 'BOTH',
  theme text not null default 'light',
  language text not null default 'en',
  home_layout text not null default 'RETAIL',
  receipt_printing boolean not null default true,
  printer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists business_type text not null default 'BOTH';
alter table public.companies add column if not exists theme text not null default 'light';
alter table public.companies add column if not exists language text not null default 'en';
alter table public.companies add column if not exists home_layout text not null default 'RETAIL';
alter table public.companies add column if not exists receipt_printing boolean not null default true;
alter table public.companies add column if not exists tax_enabled boolean not null default true;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_id_idx on public.company_members (user_id);
create index if not exists company_members_company_id_idx on public.company_members (company_id);

-- -----------------------------------------------------------------------------
-- 3) Core business tables
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null,
  sku text,
  description text,
  unit text not null default 'each',
  unit_cost integer not null default 0,
  unit_price integer not null default 0,
  stock_qty double precision not null default 0,
  min_stock double precision not null default 0,
  track_stock boolean not null default true,
  is_service boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  role text,
  hourly_rate integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  number text not null,
  status text not null default 'DRAFT',
  title text,
  notes text,
  labour_cost integer not null default 0,
  materials_cost integer not null default 0,
  equipment_cost integer not null default 0,
  transport_cost integer not null default 0,
  other_cost integer not null default 0,
  markup_pct double precision not null default 25,
  subtotal integer not null default 0,
  total integer not null default 0,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);

create table if not exists public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  category text not null default 'MATERIALS',
  quantity double precision not null default 1,
  unit_cost integer not null default 0,
  unit_price integer not null default 0,
  line_total integer not null default 0
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  quotation_id uuid references public.quotations (id) on delete set null,
  number text not null,
  title text not null,
  status text not null default 'ACTIVE',
  contract_value integer not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number),
  unique (quotation_id)
);

create table if not exists public.job_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  quantity double precision not null default 1,
  unit_cost integer not null default 0,
  total_cost integer not null default 0
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete set null,
  work_date date not null,
  hours double precision not null,
  overtime_hours double precision not null default 0,
  hourly_rate integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  job_id uuid references public.jobs (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  number text not null,
  status text not null default 'DRAFT',
  issue_date timestamptz not null default now(),
  due_date timestamptz,
  subtotal integer not null default 0,
  tax_amount integer not null default 0,
  total integer not null default 0,
  amount_paid integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number),
  unique (quotation_id)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity double precision not null default 1,
  unit_price integer not null default 0,
  line_total integer not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  invoice_id uuid references public.invoices (id) on delete set null,
  amount integer not null,
  method text not null default 'BANK',
  reference text,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category text not null,
  description text,
  amount integer not null,
  expense_date timestamptz not null default now(),
  payment_method text not null default 'CASH',
  job_id uuid references public.jobs (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null,
  quantity double precision not null,
  unit_cost integer not null default 0,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  number text not null,
  status text not null default 'COMPLETED',
  subtotal integer not null default 0,
  tax_amount integer not null default 0,
  total integer not null default 0,
  amount_paid integer not null default 0,
  method text not null default 'CASH',
  notes text,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, number)
);

create table if not exists public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity double precision not null default 1,
  unit_price integer not null default 0,
  line_total integer not null default 0
);

-- Helpful indexes
create index if not exists customers_company_id_idx on public.customers (company_id);
create index if not exists products_company_id_idx on public.products (company_id);
create index if not exists quotations_company_id_idx on public.quotations (company_id);
create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists invoices_company_id_idx on public.invoices (company_id);
create index if not exists payments_company_id_idx on public.payments (company_id);
create index if not exists expenses_company_id_idx on public.expenses (company_id);
create index if not exists sales_company_id_idx on public.sales (company_id);

-- -----------------------------------------------------------------------------
-- 4) updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists quotations_set_updated_at on public.quotations;
create trigger quotations_set_updated_at
before update on public.quotations
for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5) Auth helpers + profile bootstrap
-- -----------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional: create a personal company when a user first signs up (demo-friendly)
create or replace function public.ensure_default_company()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select m.company_id into v_company_id
  from public.company_members m
  where m.user_id = auth.uid()
  order by m.created_at
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  select coalesce(p.full_name, 'My Business') || ' Co.'
  into v_name
  from public.profiles p
  where p.id = auth.uid();

  insert into public.companies (name)
  values (coalesce(v_name, 'My Business Co.'))
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, auth.uid(), 'owner');

  return v_company_id;
end;
$$;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.ensure_default_company() to authenticated;

-- -----------------------------------------------------------------------------
-- 6) Views
-- -----------------------------------------------------------------------------
create or replace view public.v_low_stock_products
with (security_invoker = true)
as
select
  p.id,
  p.company_id,
  p.name,
  p.sku,
  p.stock_qty,
  p.min_stock,
  p.unit
from public.products p
where p.track_stock = true
  and p.is_service = false
  and p.stock_qty <= p.min_stock;

create or replace view public.v_invoice_balances
with (security_invoker = true)
as
select
  i.id,
  i.company_id,
  i.number,
  i.customer_id,
  i.status,
  i.total,
  i.amount_paid,
  greatest(i.total - i.amount_paid, 0) as balance_due,
  i.due_date
from public.invoices i
where i.status in ('SENT', 'PARTIAL', 'OVERDUE');

-- -----------------------------------------------------------------------------
-- 7) Row Level Security
-- -----------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.employees enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.jobs enable row level security;
alter table public.job_materials enable row level security;
alter table public.time_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;

-- Profiles: user can read/update own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Companies: members can read; owners/admins can update
drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
on public.companies for select
to authenticated
using (public.is_company_member(id));

drop policy if exists "companies_insert_authenticated" on public.companies;
create policy "companies_insert_authenticated"
on public.companies for insert
to authenticated
with check (true);

drop policy if exists "companies_update_member" on public.companies;
create policy "companies_update_member"
on public.companies for update
to authenticated
using (public.is_company_member(id))
with check (public.is_company_member(id));

-- Membership
drop policy if exists "company_members_select_own_companies" on public.company_members;
create policy "company_members_select_own_companies"
on public.company_members for select
to authenticated
using (public.is_company_member(company_id) or user_id = auth.uid());

drop policy if exists "company_members_insert_self_owner" on public.company_members;
create policy "company_members_insert_self_owner"
on public.company_members for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "company_members_delete_self" on public.company_members;
create policy "company_members_delete_self"
on public.company_members for delete
to authenticated
using (user_id = auth.uid());

-- Generic tenant CRUD policies (repeat per table)
-- customers
drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert" on public.customers for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "customers_delete" on public.customers;
create policy "customers_delete" on public.customers for delete to authenticated
using (public.is_company_member(company_id));

-- suppliers
drop policy if exists "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "suppliers_insert" on public.suppliers;
create policy "suppliers_insert" on public.suppliers for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "suppliers_update" on public.suppliers;
create policy "suppliers_update" on public.suppliers for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "suppliers_delete" on public.suppliers;
create policy "suppliers_delete" on public.suppliers for delete to authenticated
using (public.is_company_member(company_id));

-- products
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products for delete to authenticated
using (public.is_company_member(company_id));

-- employees
drop policy if exists "employees_select" on public.employees;
create policy "employees_select" on public.employees for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "employees_insert" on public.employees;
create policy "employees_insert" on public.employees for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "employees_update" on public.employees;
create policy "employees_update" on public.employees for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "employees_delete" on public.employees;
create policy "employees_delete" on public.employees for delete to authenticated
using (public.is_company_member(company_id));

-- quotations
drop policy if exists "quotations_select" on public.quotations;
create policy "quotations_select" on public.quotations for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "quotations_insert" on public.quotations;
create policy "quotations_insert" on public.quotations for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "quotations_update" on public.quotations;
create policy "quotations_update" on public.quotations for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "quotations_delete" on public.quotations;
create policy "quotations_delete" on public.quotations for delete to authenticated
using (public.is_company_member(company_id));

-- quotation_lines
drop policy if exists "quotation_lines_select" on public.quotation_lines;
create policy "quotation_lines_select" on public.quotation_lines for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "quotation_lines_insert" on public.quotation_lines;
create policy "quotation_lines_insert" on public.quotation_lines for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "quotation_lines_update" on public.quotation_lines;
create policy "quotation_lines_update" on public.quotation_lines for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "quotation_lines_delete" on public.quotation_lines;
create policy "quotation_lines_delete" on public.quotation_lines for delete to authenticated
using (public.is_company_member(company_id));

-- jobs
drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select" on public.jobs for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "jobs_insert" on public.jobs;
create policy "jobs_insert" on public.jobs for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "jobs_update" on public.jobs;
create policy "jobs_update" on public.jobs for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "jobs_delete" on public.jobs;
create policy "jobs_delete" on public.jobs for delete to authenticated
using (public.is_company_member(company_id));

-- job_materials
drop policy if exists "job_materials_select" on public.job_materials;
create policy "job_materials_select" on public.job_materials for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "job_materials_insert" on public.job_materials;
create policy "job_materials_insert" on public.job_materials for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "job_materials_update" on public.job_materials;
create policy "job_materials_update" on public.job_materials for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "job_materials_delete" on public.job_materials;
create policy "job_materials_delete" on public.job_materials for delete to authenticated
using (public.is_company_member(company_id));

-- time_entries
drop policy if exists "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "time_entries_insert" on public.time_entries;
create policy "time_entries_insert" on public.time_entries for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "time_entries_update" on public.time_entries;
create policy "time_entries_update" on public.time_entries for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "time_entries_delete" on public.time_entries;
create policy "time_entries_delete" on public.time_entries for delete to authenticated
using (public.is_company_member(company_id));

-- invoices
drop policy if exists "invoices_select" on public.invoices;
create policy "invoices_select" on public.invoices for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "invoices_insert" on public.invoices;
create policy "invoices_insert" on public.invoices for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "invoices_update" on public.invoices;
create policy "invoices_update" on public.invoices for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "invoices_delete" on public.invoices;
create policy "invoices_delete" on public.invoices for delete to authenticated
using (public.is_company_member(company_id));

-- invoice_lines
drop policy if exists "invoice_lines_select" on public.invoice_lines;
create policy "invoice_lines_select" on public.invoice_lines for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "invoice_lines_insert" on public.invoice_lines;
create policy "invoice_lines_insert" on public.invoice_lines for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "invoice_lines_update" on public.invoice_lines;
create policy "invoice_lines_update" on public.invoice_lines for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "invoice_lines_delete" on public.invoice_lines;
create policy "invoice_lines_delete" on public.invoice_lines for delete to authenticated
using (public.is_company_member(company_id));

-- payments
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "payments_insert" on public.payments;
create policy "payments_insert" on public.payments for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "payments_update" on public.payments;
create policy "payments_update" on public.payments for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "payments_delete" on public.payments;
create policy "payments_delete" on public.payments for delete to authenticated
using (public.is_company_member(company_id));

-- expenses
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses for delete to authenticated
using (public.is_company_member(company_id));

-- stock_movements
drop policy if exists "stock_movements_select" on public.stock_movements;
create policy "stock_movements_select" on public.stock_movements for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "stock_movements_insert" on public.stock_movements;
create policy "stock_movements_insert" on public.stock_movements for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "stock_movements_update" on public.stock_movements;
create policy "stock_movements_update" on public.stock_movements for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "stock_movements_delete" on public.stock_movements;
create policy "stock_movements_delete" on public.stock_movements for delete to authenticated
using (public.is_company_member(company_id));

-- sales
drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "sales_insert" on public.sales;
create policy "sales_insert" on public.sales for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "sales_update" on public.sales;
create policy "sales_update" on public.sales for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "sales_delete" on public.sales;
create policy "sales_delete" on public.sales for delete to authenticated
using (public.is_company_member(company_id));

-- sale_lines
drop policy if exists "sale_lines_select" on public.sale_lines;
create policy "sale_lines_select" on public.sale_lines for select to authenticated
using (public.is_company_member(company_id));
drop policy if exists "sale_lines_insert" on public.sale_lines;
create policy "sale_lines_insert" on public.sale_lines for insert to authenticated
with check (public.is_company_member(company_id));
drop policy if exists "sale_lines_update" on public.sale_lines;
create policy "sale_lines_update" on public.sale_lines for update to authenticated
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "sale_lines_delete" on public.sale_lines;
create policy "sale_lines_delete" on public.sale_lines for delete to authenticated
using (public.is_company_member(company_id));

-- -----------------------------------------------------------------------------
-- 8) Minimal seed data (no auth users; attach after you sign up)
-- -----------------------------------------------------------------------------
-- Fixed UUIDs so you can re-run safely with ON CONFLICT where applicable.

insert into public.companies (id, name, currency, vat_rate)
values ('11111111-1111-1111-1111-111111111111', 'Island Works Ltd.', 'TTD', 0.125)
on conflict (id) do nothing;

insert into public.customers (id, company_id, name, email, phone, address, notes)
values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111',
   'ABC Construction Ltd.', 'accounts@abcconstruction.tt', '868-555-0145',
   'San Fernando, Trinidad', 'Prefers WhatsApp for invoice reminders.'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111',
   'XYZ Ltd.', 'ops@xyz.tt', '868-555-0199', 'Port of Spain', null)
on conflict (id) do nothing;

insert into public.suppliers (id, company_id, name, email, phone)
values (
  '33333333-3333-3333-3333-333333333301',
  '11111111-1111-1111-1111-111111111111',
  'Caribbean Electrical Supplies',
  'sales@ces.tt',
  '868-555-0200'
)
on conflict (id) do nothing;

insert into public.products (
  id, company_id, supplier_id, name, sku, unit, unit_cost, unit_price, stock_qty, min_stock, track_stock, is_service
)
values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333301', 'Electrical cable 2.5mm', 'CAB-25', 'm',
   850, 1200, 750, 200, true, false),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333301', 'Wall outlet', 'OUT-01', 'each',
   2500, 4500, 40, 10, true, false),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111',
   null, 'Labour — electrician', null, 'hour',
   4000, 6500, 0, 0, false, true)
on conflict (id) do nothing;

insert into public.employees (id, company_id, first_name, last_name, role, hourly_rate, phone)
values (
  '55555555-5555-5555-5555-555555555501',
  '11111111-1111-1111-1111-111111111111',
  'John', 'Smith', 'Electrician', 4000, '868-555-0301'
)
on conflict (id) do nothing;

insert into public.quotations (
  id, company_id, customer_id, number, status, title,
  labour_cost, materials_cost, equipment_cost, transport_cost, markup_pct, subtotal, total, notes
)
values (
  '66666666-6666-6666-6666-666666666601',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222202',
  'Q-2026-0001', 'SENT', 'Electrical Installation',
  250000, 180000, 50000, 30000, 25, 637500, 637500,
  'Guide example: TT$5,100 cost → TT$6,375 at 25%.'
)
on conflict (id) do nothing;

insert into public.jobs (
  id, company_id, customer_id, number, title, status, contract_value
)
values (
  '77777777-7777-7777-7777-777777777701',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222202',
  'JOB-2026-0145', 'Electrical Installation', 'ACTIVE', 1850000
)
on conflict (id) do nothing;

insert into public.invoices (
  id, company_id, customer_id, number, status, due_date, subtotal, total, amount_paid
)
values (
  '88888888-8888-8888-8888-888888888801',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222201',
  'INV-2026-0001', 'PARTIAL', now() + interval '7 days',
  1850000, 1850000, 425000
)
on conflict (id) do nothing;

insert into public.payments (
  id, company_id, customer_id, invoice_id, amount, method, reference, paid_at
)
values (
  '99999999-9999-9999-9999-999999999901',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222201',
  '88888888-8888-8888-8888-888888888801',
  425000, 'BANK', 'TTD-TXN-1001', now()
)
on conflict (id) do nothing;

-- After you create your first Auth user in the app/dashboard, link yourself:
-- replace YOUR_AUTH_USER_UUID below (Authentication → Users → copy UUID)
--
-- insert into public.company_members (company_id, user_id, role)
-- values ('11111111-1111-1111-1111-111111111111', 'YOUR_AUTH_USER_UUID', 'owner')
-- on conflict (company_id, user_id) do nothing;

-- =============================================================================
-- Done. Verify:
--   select tablename from pg_tables where schemaname = 'public' order by 1;
--   select * from public.customers;
-- =============================================================================
