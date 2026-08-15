-- =============================================================================
-- CBManagement — RESET (Option B: drop then recreate)
-- Destructive: removes CBManagement public tables/views/functions created by schema.sql
-- Use only if you have NO important data in these tables yet.
-- Run this FIRST, then run schema.sql again.
-- =============================================================================

-- Drop views first
drop view if exists public.v_invoice_balances cascade;
drop view if exists public.v_low_stock_products cascade;

-- Drop indexes if left behind from a partial run (normally removed with tables)
drop index if exists public.company_members_user_id_idx;
drop index if exists public.company_members_company_id_idx;
drop index if exists public.customers_company_id_idx;
drop index if exists public.products_company_id_idx;
drop index if exists public.quotations_company_id_idx;
drop index if exists public.jobs_company_id_idx;
drop index if exists public.invoices_company_id_idx;
drop index if exists public.payments_company_id_idx;
drop index if exists public.expenses_company_id_idx;
drop index if exists public.sales_company_id_idx;

-- Drop tenant tables (children first)
drop table if exists public.sale_lines cascade;
drop table if exists public.sales cascade;
drop table if exists public.stock_movements cascade;
drop table if exists public.expenses cascade;
drop table if exists public.payments cascade;
drop table if exists public.invoice_lines cascade;
drop table if exists public.invoices cascade;
drop table if exists public.time_entries cascade;
drop table if exists public.job_materials cascade;
drop table if exists public.jobs cascade;
drop table if exists public.quotation_lines cascade;
drop table if exists public.quotations cascade;
drop table if exists public.employees cascade;
drop table if exists public.products cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.customers cascade;
drop table if exists public.company_members cascade;
drop table if exists public.profiles cascade;
drop table if exists public.companies cascade;

-- Drop trigger on auth.users (safe if missing)
drop trigger if exists on_auth_user_created on auth.users;

-- Drop functions
drop function if exists public.ensure_default_company() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_company_member(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

-- Confirm clean
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'companies','profiles','company_members','customers','suppliers','products',
    'employees','quotations','quotation_lines','jobs','job_materials','time_entries',
    'invoices','invoice_lines','payments','expenses','stock_movements','sales','sale_lines'
  )
order by 1;
-- Expect: 0 rows
