# Changelog

Versioned so that a citation to a figure stays reproducible. Data changes are called out separately from
code changes, because a changed number matters more than a changed function.

## 1.0.0 — 2026-08-24

First release.

### Data

- 12 abatement awards under NRS 360.754, FY2016–FY2027, from GOED's biennial reports to the Legislature and
  individual GOED board packets.
- 9 documented conflicts between official sources, 5 of them material. Notably: the FY2024 Novva award is
  recorded in the FY2023–24 biennial report with the wrong county *and* the wrong entity name, both
  contradicted by GOED's own board packet for the same award.
- The "Total Annual Wages" column of the FY2023–24 biennial report is excluded as unreliable; annual payroll
  is recomputed as `jobs × wage × 2080`, which reproduces GOED's own FY2016 arithmetic exactly.
- 33 Nevada data center locations, 15 water observations with local benchmarks, 10 energy figures, and the
  City of Reno's redeemed-abatement series FY2017–FY2024 — the only such series published by any Nevada
  jurisdiction.
- 14 source documents, all with retrieval dates.
- One award (Colovore Reno 1, FY2027) rests on trade press only and is flagged `secondary` pending a board
  packet.

### Code

- Zero-dependency pipeline: RFC 4180 CSV reader, declarative schema with referential integrity and
  domain rules, build to a static site plus versioned JSON API, JSONL, SQL dump, per-table JSON Schema and a
  Frictionless Data Package.
- Generated data dictionary, so documentation cannot drift from the schema.
- 22 tests covering CSV edge cases and dataset invariants, including that withdrawn awards never reach a total.
- `check-sources` to catch citation rot.
