# [P2-OSS] Tracking — kureen-cyber

Open-source swarm tracking for Summer Pilot 2026, Week 6.

These URLs and the merge status are taken from public GitHub records for `@kureen-cyber`. They were not invented. If a different upstream PR should be tracked instead, update this file and the cohort tracking PR body.

## Upstream repo URL

https://github.com/rogerSuperBuilderAlpha/cursor-boston

Live site (program suggested starter): https://www.cursorboston.com

## Upstream PR URL

https://github.com/rogerSuperBuilderAlpha/cursor-boston/pull/1657

## Merge status

**Merged** on 2026-07-16T11:51:00Z.

- Author: `kureen-cyber`
- Title: `feat(ecosystem): add interactive hub diagram to hero`
- Base: `develop`
- Merge commit: `060d3662e03f8bdd85b3e842c667caf6c8302f08`
- Diff: +284 / −15 across 4 files

## Qualification

`rogerSuperBuilderAlpha/cursor-boston` is a **staff-suggested starting target** for this project (`cursorboston.com` in the Week 6 open-source swarm brief). That is the staff-approved equivalent path (the repo does not have ≥1,000 stars).

Checked 2026-08-13:

- Stars: 25
- Forks: 249
- GitHub contributors API: 125 listed contributors
- Homepage: https://www.cursorboston.com

## Contribution summary

Replaced the text-only Mass AI Ecosystem hero with a hub-and-spoke map of category nodes (Universities, Accelerators, AI organizations, Venture capital, Research labs, Nonprofits) showing live counts. Clicking a node filters the directory.

Files in the upstream PR:

- `app/ecosystem/EcosystemHeroDiagram.tsx` (new)
- `app/ecosystem/page.tsx`
- `app/globals.css`
- `__tests__/app/ecosystem/page.test.tsx`

## Smoke checks (2026-08-13)

- [x] Upstream PR #1657 state is `MERGED` via GitHub API
- [x] `GET https://www.cursorboston.com/ecosystem` returns HTTP 200
- [x] Ecosystem page lists category filters with live counts (All 32, Universities, Accelerators, and related groups)
- [x] No new upstream PR was opened from this tracking run (not authorized)

## Other public PRs by kureen-cyber (not used as pass-gate evidence)

- Closed, not merged: https://github.com/CodingWCal/forth/pull/34
- Open: https://github.com/rogerSuperBuilderAlpha/admissions-task-board-fall26/pull/24
