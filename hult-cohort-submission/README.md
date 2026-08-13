# Hult Cohort — Phase 2 Venture PR

Official tracking PR (open today, fill as we go):

- Repo: `rogerSuperBuilderAlpha/hult-cohort-program`
- Title: `[P2-Venture] Submission — kureen-cyber`
- Head: `participants/summer26/phase-2-venture/kureen-cyber`
- Base: **`projects/summer26/phase-2-venture`** (not `main` — PRs to `main` scanned as invisible last week)
- Deadline: **Sunday 16 Aug 2026, 17:00 Eastern**
- Requirements: https://site-nine-rouge-68.vercel.app/program/phase-2-venture

Deck path in the PR body is **empty** until we fill it.

## Open the cohort PR (run as kureen-cyber)

This Cursor GitHub App install can only write `kureen-cyber/CBManagement`. The cohort fork is not in the install, so the cloud agent cannot push the participant branch.

**Option A — add the fork to Cursor, then re-run the agent**

1. GitHub → Settings → Applications → **Cursor** → Repository access  
2. Add **`hult-cohort-program`** (your fork)  
3. Re-run the venture agent on this repo

**Option B — open it from your machine (one command)**

```bash
cd /path/to/CBManagement
bash scripts/open-hult-venture-pr.sh
```

Requires `gh` logged in as **kureen-cyber**.
