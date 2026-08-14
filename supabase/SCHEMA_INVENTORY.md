# CBManagement Supabase schema inventory

Project: `azqufyyrchtpjjdjscua`  
SQL file: [`schema.sql`](./schema.sql)

## How to run (SQL Editor)

1. Open [API keys / project](https://supabase.com/dashboard/project/azqufyyrchtpjjdjscua) → left sidebar **SQL Editor**
2. If you see **“relation already exists”** (e.g. `companies`):
   - Prefer **Option B** on a fresh project: run [`reset.sql`](./reset.sql) first, then `schema.sql`
   - **Option A** (`IF NOT EXISTS`) skips existing tables but can leave a half-built schema
   - **Option C** (schema-qualify) does **not** fix “already exists” — we already use `public.`
3. **New query** → paste [`reset.sql`](./reset.sql) → **Run** (expect 0 leftover tables)
4. **New query** → paste full [`schema.sql`](./schema.sql) → **Run**
5. Sign up once in the app, copy your user UUID from **Authentication → Users**
6. Run the membership link at the bottom of `schema.sql` (uncomment + replace UUID)

---

## Schema inventory checklist

### CREATE TABLE

| Table | Purpose |
|-------|---------|
| `companies` | Tenant / business |
| `profiles` | 1:1 with `auth.users` |
| `company_members` | User ↔ company membership + role |
| `customers` | CRM |
| `suppliers` | Vendors |
| `products` | Inventory / services (money in cents) |
| `employees` | Staff + hourly rate |
| `quotations` | Quotes |
| `quotation_lines` | Quote line items |
| `jobs` | Projects / jobs |
| `job_materials` | Materials on a job |
| `time_entries` | Hours / OT |
| `invoices` | Invoices |
| `invoice_lines` | Invoice lines |
| `payments` | Payments received |
| `expenses` | Expenses |
| `stock_movements` | Stock in/out |
| `sales` | POS sales |
| `sale_lines` | POS lines |

All tenant tables include `company_id uuid not null references companies(id)`.

### Constraints / FKs / uniques (in `schema.sql`)

- FKs: every `*_id` column references its parent (`on delete cascade|set null|restrict` as appropriate)
- Uniques:
  - `company_members (company_id, user_id)`
  - `quotations (company_id, number)`
  - `jobs (company_id, number)`, `jobs (quotation_id)`
  - `invoices (company_id, number)`, `invoices (quotation_id)`
  - `sales (company_id, number)`
- Check: `company_members.role in ('owner','admin','member')`

### RLS

Every public business table has:

```sql
alter table public.<table> enable row level security;
```

Policies follow the pattern: authenticated users may CRUD rows only when `is_company_member(company_id)`.

Special cases:
- `profiles` — select/update own row (`id = auth.uid()`)
- `companies` — select/update if member; insert allowed for authenticated (used by `ensure_default_company`)
- `company_members` — select if member; insert self; delete self

### Functions / triggers / views

| Object | Type | Role |
|--------|------|------|
| `set_updated_at()` | function | BEFORE UPDATE trigger helper |
| `*_set_updated_at` | triggers | Auto `updated_at` |
| `is_company_member(uuid)` | function | RLS helper (`security definer`) |
| `handle_new_user()` | function | Creates `profiles` row on signup |
| `on_auth_user_created` | trigger | On `auth.users` INSERT |
| `ensure_default_company()` | function | Creates company + owner membership |
| `v_low_stock_products` | view | Products at/below min stock |
| `v_invoice_balances` | view | Open invoice balances |

### Minimal seed

Inserts demo company **Island Works Ltd.** plus:
- 2 customers (ABC, XYZ)
- 1 supplier
- 3 products
- 1 employee
- 1 quotation, 1 job, 1 invoice, 1 payment

No `INSERT` into `auth.users` (created by Supabase Auth).  
After signup, link your user with the commented `company_members` insert at the bottom of `schema.sql`.

---

## Notes

- Money = **integer cents** (e.g. TT$199.00 → `19900`)
- App still uses local SQLite via Prisma today; this SQL prepares Supabase Postgres + RLS for production data
- Do **not** put `SUPABASE_SECRET_KEY` in client code
