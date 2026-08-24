## What changed

<!-- One or two sentences. If a figure changed, say which and why. -->

## Source

<!-- Required for any change to data/. URL plus page or table. Delete this section for code-only changes. -->

## Checks

- [ ] `npm run validate:strict` is clean
- [ ] `npm test` passes
- [ ] `npm run build` succeeds and `docs/DATA_DICTIONARY.md` is committed if the schema changed
- [ ] Any conflict between official sources is recorded in `data/discrepancies.csv` rather than silently overwritten
- [ ] No derived values added to the CSVs (those belong in `src/lib/derive.ts`)
- [ ] No `id` was renumbered or reused
