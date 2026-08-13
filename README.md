# CBManagement

**Run your entire business from one place.**

Simple business OS for small businesses in Trinidad & Tobago and the Caribbean.

## Quick start

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → **Demo** in the sidebar (or `/demo`) to browse without an account.

## Features (V1)

- Dashboard, Customers, Quotations, Jobs, Invoices, Payments, Expenses, Inventory, Suppliers, Employees, Reports
- **POS** — cart checkout, stock deduction, sales history
- **Demo tab** — guided tour of sample data (no login)
- **Supabase Auth** — email/password sign-in & sign-up when configured

## Supabase Auth setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local`
3. Set:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_DEMO_MODE=true
```

4. In Supabase Auth settings, add redirect URL: `http://localhost:3000/auth/callback`

Without Supabase keys, the app still runs in local/demo mode.

## Pricing (proposed)

Subscription only for now (no setup fees).

| Plan | Monthly | Annual |
|------|---------|--------|
| Starter | TT$99 | TT$999 |
| **Business** | **TT$199** | **TT$1,999** |
| Professional | TT$399 | TT$3,999 |
| Enterprise | TT$750+ | TT$7,500+ |

## Stack

Next.js · TypeScript · Tailwind · Prisma/SQLite · Supabase Auth
