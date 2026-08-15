# Persist database (Neon Postgres)

CBManagement production now uses **Postgres** so inventory, sales, customers, and settings sync across devices.

## Claim this database (required)

The provisioned Neon DB is claimable and **expires if not claimed**.

1. Open: https://neon.new/database/fef97eb2-182b-4498-a9a6-8f87d9b88db1
2. Sign in / create a free Neon account
3. Claim the database so it becomes permanent on the Free plan

Until claimed, the DB may expire ~72 hours after creation.

## Connection

- `DATABASE_URL` — pooled (app / Vercel)
- `DATABASE_URL_DIRECT` — direct (migrations)

These are set on Vercel for Production / Preview / Development.
