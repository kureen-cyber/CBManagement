# Hult Cohort — Phase 2 Venture PR (draft)

This folder is the **draft submission package** for:

`rogerSuperBuilderAlpha/hult-cohort-program`  
Branch: `participants/summer26/phase-2-venture/kureen-cyber`  
PR title: `[P2-Venture] Submission — kureen-cyber`  
Base: `projects/summer26/phase-2-venture`

## Why it lives here first

The cloud agent can push to `kureen-cyber/CBManagement` but **cannot push** to `kureen-cyber/hult-cohort-program` (403). Review the package here, then open the cohort PR from your GitHub login.

## Open the cohort draft PR (you run once)

```bash
cd /path/to/CBManagement
bash scripts/open-hult-venture-pr.sh
```

Requires: `gh` authenticated as **kureen-cyber**, network access.

## Still needed from you (do not invent)

1. Confirm production URL (agent used: https://cbmanagement.vercel.app) — OK?
2. Review investor deck / one-pager PDFs under `hult-cohort-submission/venture-kureen-cyber/docs/` (edit HTML in product `docs/` if needed)
3. Confirm business plan path — currently the DOCX in that same `docs/` folder
4. Investor touch log (redacted) — paste into `INVESTOR_LOG.md` before Sunday merge
5. Grow external users to ≥25 and re-snapshot (current: **7** as of 13-08-2026)

After investor log + ≥25 users are ready, say “update the venture PR” and we refresh the TBD sections.
