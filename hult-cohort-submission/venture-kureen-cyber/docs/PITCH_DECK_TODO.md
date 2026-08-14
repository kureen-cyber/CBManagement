# Pitch deck

**Status:** Present (draft for review)

| File | Path |
|------|------|
| Editable HTML source | `docs/pitch-deck.html` (product repo root `docs/`) |
| Investor deck PDF | `venture-kureen-cyber/docs/pitch-deck.pdf` |
| One-pager PDF | `venture-kureen-cyber/docs/one-pager.pdf` |

## Edit workflow

1. Edit `/docs/pitch-deck.html` (or `/docs/one-pager.html`).
2. Regenerate PDF with Chrome headless (example):

```bash
google-chrome --headless --disable-gpu --no-sandbox \
  --user-data-dir=/tmp/chrome-deck \
  --print-to-pdf=docs/pitch-deck.pdf \
  --print-to-pdf-no-header \
  file://$PWD/docs/pitch-deck.html
```

3. Copy into the venture package:

```bash
cp docs/pitch-deck.pdf hult-cohort-submission/venture-kureen-cyber/docs/pitch-deck.pdf
cp docs/one-pager.pdf hult-cohort-submission/venture-kureen-cyber/docs/one-pager.pdf
```

## Still customize before investor meetings

- Founder legal name / bio (currently `@kureen-cyber`)
- Real traction numbers once ≥25 external users / paid pilots exist
- Exact ask amount within TT$25–40k range if you lock a figure
