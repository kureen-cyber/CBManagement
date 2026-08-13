# CBManagement

**Run your entire business from one place.**

Simple business OS for small businesses in Trinidad & Tobago and the Caribbean.

## Production

**Live app:** [https://cbmanagement.vercel.app](https://cbmanagement.vercel.app)

- Demo (no account): [https://cbmanagement.vercel.app/demo](https://cbmanagement.vercel.app/demo)
- Sign up: [https://cbmanagement.vercel.app/signup](https://cbmanagement.vercel.app/signup) — choose Retail / Service / Both
- Retail POS demo: sign in page → **Retail POS**

## Quick start (local)

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) → **Demo**, or use **Create account / Sign up**.

## Features (V1)

- Dashboard, Customers, Quotations, Jobs, Invoices, Payments, Expenses, Inventory, Suppliers, Employees, Reports
- **POS** — cart, receipts, stock updates, CSV stock export (Loyverse-style for retail accounts)
- **Business type on signup** — Retail / Service / Both (retail gets POS-first dashboard)
- **Demo tab** — browse sample data without login
- **Supabase Auth** — email/password sign-in & sign-up

## Supabase Auth setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local`
3. Set:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_DEMO_MODE=true
```

4. In Supabase → Authentication → URL configuration, add:
   - `http://localhost:3001/auth/callback`
   - `https://cbmanagement.vercel.app/auth/callback`

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

Next.js · TypeScript · Tailwind · Prisma/SQLite · Supabase Auth · Vercel
