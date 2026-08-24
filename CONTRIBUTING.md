# Contributing

The most valuable contribution is a **correction backed by a source document**. Second most valuable is a
**board packet or report this dataset is missing**.

## Ground rules

1. **Every figure needs a source.** Add it to `data/sources.csv` first, with a retrieval date, then
   reference its `source_id`. No source, no row.
2. **Do not overwrite a conflict.** If your document disagrees with what is already there, add a row to
   `data/discrepancies.csv` recording both values, both sources, and which one should win and why. Then
   update the affected row.
3. **Never invent a value.** Leave a field empty. Empty means "not published"; a guess is worse than a gap.
4. **Do not put derived numbers in the CSVs.** Totals, per-job figures and ratios are computed in
   `src/lib/derive.ts`. If you need a new derived figure, add it there.
5. **Stable ids are forever.** Never renumber or reuse an `id`. External citations depend on them.

## Before opening a pull request

```bash
npm run validate:strict   # must be clean, warnings included
npm test
npm run build
```

CI runs the same. A PR that fails validation will not be merged.

## Adding an award

1. Find the GOED board packet. They live at `goed.nv.gov/wp-content/uploads/YYYY/MM/...` and are usually
   linked from the board meeting agenda. This is the best source available.
2. Add the source to `sources.csv`.
3. Add the operator to `companies.csv` if new. Set `parent_confidence` honestly. `confirmed` means a
   primary document states it, `reported` means journalism does, `unknown` means nobody has.
4. Add the row to `abatements.csv`. Use the entity name **as it appears in the board packet**, not as the
   biennial report transcribes it.
5. Set `verification`: `primary` for a GOED document, `secondary` for press coverage, and in the latter case
   write a note saying what still needs confirming.
6. Run the checks above.

## Adding a column

Columns are declared in [`src/lib/schema.ts`](src/lib/schema.ts). Add the field there, with a `doc` string,
because the data dictionary is generated from it, then update the CSV. The validator will reject any column
that is not declared, and any declared column that is missing.

## Reporting a problem without fixing it

Open an issue using the **Data correction** template. Include the source document, the field, the value you
believe is wrong and the value you believe is right. That is enough for someone else to act on.

## Style

- Prose in data notes: plain sentences, no abbreviations that are not in the source.
- Code: match the surrounding file. No dependencies. This is deliberate, and PRs adding one need to argue
  for it.
- Commit messages: what changed and why, present tense.
