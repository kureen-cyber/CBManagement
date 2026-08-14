# Data isolation & personal info

## What the app can and cannot access

CBManagement is a **browser web app**. It cannot read files, contacts, or other personal data stored on a user’s laptop unless the user explicitly uploads a file (e.g. future CSV import). Browsers block silent access to the device filesystem.

If someone “saw personal info,” it was almost certainly one of:

1. **Shared-database leak (fixed in tenant isolation)** — another business’s customers/sales stored in Neon were visible to everyone before `companyId` scoping.
2. **Browser autofill** — Chrome/Safari filling home address, personal email, or phone into CRM forms from the laptop profile.
3. **Shared device / leftover login** — another account still signed in on that browser.

## Prevent going forward

| Control | Status |
|---------|--------|
| Per-company data isolation (`CompanyMember` + `companyId`) | Required — deploy PR #10 |
| Demo mode forced **off** in production builds | Enabled in code |
| Autofill off on customer/supplier/employee CRM forms | Enabled |
| Sign out when finished on shared computers | Operational practice |
| Do not run production with `NEXT_PUBLIC_DEMO_MODE=true` | Keep false on Vercel Production |

## Operator checklist after isolation deploy

1. Merge/deploy tenant isolation so new signups cannot see each other’s CRM data.
2. Confirm Vercel Production `NEXT_PUBLIC_DEMO_MODE=false` (code also ignores it in production).
3. Ask affected users to sign out, clear site data for `cbmanagement.vercel.app` if autofill keeps injecting the wrong contact, then sign back in.
4. Only enter **business** contacts into Customers/Employees — treat the CRM as business records, not a personal address book.
