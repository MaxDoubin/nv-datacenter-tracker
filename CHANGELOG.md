# Changelog

Versioned so that a citation to a figure stays reproducible. Data changes are called out separately from
code changes, because a changed number matters more than a changed function.

## 1.1.0 (2026-08-24)

Visual release. The dataset is unchanged apart from one added source; everything else is presentation.

### Data

- Added `data/geo/nv-counties.geojson`: Nevada county boundaries from the US Census Bureau's public domain
  cartographic boundary files, filtered to Nevada, Douglas-Peucker simplified at 0.001 degrees and rounded to
  4 decimal places. Committed rather than fetched so the build stays reproducible offline, and recorded in
  `sources.csv` like every other input.

### Code

- Maps. `src/lib/geo.ts` projects the county geometry at build time with an Albers equal area conic and
  publishes it at `/api/v1/geo.json`, so the browser ships no mapping library and does no trigonometry.
- Graduated symbol overlay on every choropleth. Storey County holds the largest share of approved abatement
  value and renders about 22 times smaller than Clark, so shading alone buried the largest figure in the
  dataset. Circle area now carries magnitude and the shading drops back to context.
- Nine new chart types: a lock in timeline showing each award from approval to expiry, bubble scatter,
  dumbbell for projected against audited, ranked lollipop with a reference line, donut, squarified treemap,
  stacked bars, area proportional circles and a heatmap.
- New Map view with five selectable metrics and a dot for each of the 33 counted facilities.
- Every chart is now wrapped in a figure with a caption and a source line.

### Fixed

- Horizontal page overflow on narrow screens. Grid and flex items default to `min-width: auto`, so wide
  tables inflated their track instead of scrolling inside it. Verified at 375, 768 and 1280 pixels.
- The eight item nav wrapped to three lines below 720 pixels, leaving a 186 pixel sticky header on an
  812 pixel viewport. It is now one sideways scrolling row and the header is 85 pixels.
- Removed every em dash from the project, in prose, code comments, commit-facing strings and templates. The
  "no value" glyph in tables is now `n/a`.

## 1.0.0 (2026-08-24)

First release.

### Data

- 12 abatement awards under NRS 360.754, FY2016 to FY2027, from GOED's biennial reports to the Legislature and
  individual GOED board packets.
- 9 documented conflicts between official sources, 5 of them material. Notably: the FY2024 Novva award is
  recorded in the FY2023 to FY2024 biennial report with the wrong county *and* the wrong entity name, both
  contradicted by GOED's own board packet for the same award.
- The "Total Annual Wages" column of the FY2023 to FY2024 biennial report is excluded as unreliable; annual payroll
  is recomputed as `jobs × wage × 2080`, which reproduces GOED's own FY2016 arithmetic exactly.
- 33 Nevada data center locations, 15 water observations with local benchmarks, 10 energy figures, and the
  City of Reno's redeemed-abatement series FY2017 to FY2024, the only such series published by any Nevada
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
