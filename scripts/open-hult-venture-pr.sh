#!/usr/bin/env bash
# Run this on your machine (logged in as kureen-cyber) to open the cohort PR.
# Usage: bash scripts/open-hult-venture-pr.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/hult-cohort-submission"
WORK="/tmp/hult-cohort-program-venture-$$"

echo "==> Cloning your fork…"
rm -rf "$WORK"
git clone --depth 1 https://github.com/kureen-cyber/hult-cohort-program.git "$WORK"
cd "$WORK"
git remote add upstream https://github.com/rogerSuperBuilderAlpha/hult-cohort-program.git
git fetch upstream projects/summer26/phase-2-venture
git checkout -B participants/summer26/phase-2-venture/kureen-cyber upstream/projects/summer26/phase-2-venture

echo "==> Copying submission package…"
mkdir -p submissions
rm -rf venture-kureen-cyber
cp -a "$SRC/venture-kureen-cyber" .
cp "$SRC/kureen-cyber-p2-venture.md" submissions/kureen-cyber-p2-venture.md

git add venture-kureen-cyber submissions/kureen-cyber-p2-venture.md
git commit -m "Draft P2 Venture submission for kureen-cyber (CBManagement)"

echo "==> Pushing branch…"
git push -u origin participants/summer26/phase-2-venture/kureen-cyber

echo "==> Opening draft PR to upstream…"
gh pr create \
  --repo rogerSuperBuilderAlpha/hult-cohort-program \
  --base projects/summer26/phase-2-venture \
  --head kureen-cyber:participants/summer26/phase-2-venture/kureen-cyber \
  --title "[P2-Venture] Submission — kureen-cyber" \
  --draft \
  --body-file "$SRC/PR_BODY.md"

echo "Done. Review the draft PR URL above, then update TBD sections after deck + user evidence."
