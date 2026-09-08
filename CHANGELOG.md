# Changelog

Versioned so that a citation to a figure stays reproducible. Data changes are called out separately from
code changes, because a changed number matters more than a changed function.

## 1.2.0 (2026-09-08)

Motion release. The dataset is unchanged; everything else is presentation and accessibility.

### Code

- Every hand-rolled SVG chart (bar/column, gantt, scatter, dumbbell, lollipop, donut, treemap, heatmap,
  proportional circles, choropleth map) now draws itself in on mount: bars grow, dots pop, arcs sweep, lines
  trace via a `pathLength="1"` stroke-dashoffset trick, staggered per element with a small `--i` CSS custom
  property set in `charts.js`/`map.js`.
- Cards, figures, callouts, timeline entries and list rows fade and lift into view on scroll via
  `IntersectionObserver`; the headline `.stat .value` numbers count up from zero the first time they scroll
  into view, preserving their original formatting.
- A custom styled tooltip replaces the browser's slow native SVG `<title>` popup on every chart, detaching the
  `<title>` node while visible (screen-reader access is unaffected) and restoring it on mouse-out or route
  change.
- Route changes fade and lift `#main`; the sticky header gains a shadow on scroll; the theme toggle icon
  rotates; the search field on Awards gets a clear button; the policy timeline gets a rail that fills with how
  far the reader has scrolled through it; the overview headline gets a quiet radial glow; a back-to-top
  control appears after scrolling; the light/dark toggle crossfades instead of snapping.
- The "Loading dataset…" placeholder is a shimmering skeleton that mirrors the overview layout.
- All of the above lives inside `@media (prefers-reduced-motion: no-preference)`; a `reduce` block forces
  every animated or revealed element to its final visible state regardless of JS, `@media print` does the
  same for export, and `IntersectionObserver` use is feature-detected with an immediate-reveal fallback, so
  visibility never depends on an animation completing.

### Fixed

- `--text-faint` fell short of WCAG AA contrast (4.5:1) against the page background almost everywhere it was
  used — stat labels, figure sources, field labels, timeline dates. Darkened it in light mode and lightened it
  in dark mode; verified against both `--bg` and `--surface`.
- The lollipop chart's clickable dots had no accessible name: the descriptive text lived on a sibling
  `<title>`, not inside the `<a>` itself. Added `aria-label` with the same text.
- Five chart types (gantt, scatter, lollipop, treemap, stacked bars) and the choropleth map declared
  `role="img"` — "this is one flat, non-interactive picture" — while containing real `<a href>` links, a
  direct ARIA contradiction. Switched those five to `role="group"`, which permits a label and real
  interactive descendants; chart types that never render links keep `role="img"`.
- Two "callout" boxes used `<h3>` directly after `<h1>` with no `<h2>` between (Overview, Data quality);
  promoted them to `<h2>` with a CSS override so their visual size is unchanged. The policy timeline had no
  heading above `<h1>` at all before its per-entry `<h3>`s; added a visible "Every event, in order" `<h2>`.
- The two horizontally-scrolling chart wrappers (proportional circles, heatmap) weren't keyboard-focusable;
  added `tabindex="0"` and a `role="region"` label.
- A stale chart tooltip could survive a route change, left floating over the next page with the previous
  page's text, if the user clicked a linked chart shape while hovering it.
- The search-clear button on Awards showed even with an empty search box, on every load: its own `display`
  declaration overrode the `[hidden]` attribute meant to hide it (author CSS beats the UA stylesheet on a
  specificity tie) — the same class of bug already caught once on the back-to-top control.

All found via an axe-core audit run across every route in both themes; confirmed against a worktree of the
prior commit that every violation predated this release, then fixed the ones with a safe, high-confidence fix.

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
