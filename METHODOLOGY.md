# Methodology

## Scope

This dataset covers tax abatements approved by the Nevada Governor's Office of Economic Development (GOED)
board under **NRS 360.754**, the data center abatement program created by S.B. 170 (2015).

**In scope:** every NRS 360.754 award, whether active or withdrawn.

**Out of scope:** data centers abated under other programs. Apple's Washoe County facility is the notable
example — its abatements predate the 2015 program and sit under the standard abatement (NRS 360.750). It
appears in `companies.csv` for context and in the City of Reno's redemption figures (which group pre-2015
data centers together for comparability), but not in the NRS 360.754 award table. Mixing them would inflate
the program's totals.

## The program

A data center, and its co-located tenants, may qualify for:

- **Sales and use tax** reduced to **2%** for 10 or 20 years. The reduction to 2% requires a two-thirds vote
  of the GOED board.
- **Personal property tax** abated **75%** for 10 or 20 years.

All three thresholds must be met within the first five years of operation:

| Tier | Jobs (Nevada residents, full-time) | Wages | Cumulative capital investment |
| --- | --- | --- | --- |
| 10-year | 10 | ≥ 100% of the statewide average wage | $25 million |
| 20-year | 50 | ≥ 100% of the statewide average wage | $100 million |

Further statutory requirements: paid family and medical leave for employers reaching 50 employees by the
eighth quarter; remain in Nevada 10 years; offer medical insurance with ≥65% of premiums employer-paid; and
**≥50% of construction workers must be Nevada residents**. That last requirement's compliance data is not
published.

Capital investment and job thresholds are enforced by the validator as warnings, so a row inconsistent with
its own stated term gets flagged.

## Source hierarchy

When documents disagree, the higher tier wins and the conflict is recorded in `discrepancies.csv`:

1. **GOED board packets** — the application itself, with the applicant's own figures and GOED's economic
   analysis. Highest authority.
2. **GOED biennial reports to the Legislature** (NRS 231.0685) — comprehensive but, as this project
   documents, containing transcription and formula errors.
3. **GOED press releases** — accurate on headline figures, thin on detail.
4. **Municipal and legislative analyses** — the City of Reno's ACFR-based redemption figures and the
   Legislative Counsel Bureau's briefings are authoritative for what they measure directly.
5. **Trade and news reporting** — used only where nothing official exists, and always flagged
   `verification = secondary`.

Later reports supersede earlier ones *except* where the earlier one is arithmetically verifiable and the
later one is not. See `disc-fy2016-postwithdrawal-capex`.

## Fiscal years

Nevada's fiscal year runs 1 July – 30 June; FY2016 ends 30 June 2016. An award approved in July 2015 is an
FY2016 award. The validator recomputes the fiscal year from the approval date on every row and fails the
build on a mismatch.

## Derived figures

Nothing derived is stored in the CSVs. All of it is computed at build time in
[`src/lib/derive.ts`](src/lib/derive.ts):

| Figure | How |
| --- | --- |
| Total abatement | `sales_and_use + personal_property`, or the published total where components are not broken out (flagged in the interface) |
| Implied annual payroll | `jobs × hourly wage × 2080` |
| Abatement per promised job | `total abatement ÷ jobs promised` |
| Abatement per capex dollar | `total abatement ÷ capital investment` |
| Wage premium | `promised wage ÷ statutory floor` |
| Term end | `approval fiscal year + term years` |
| Cumulative series | Running total of active awards by fiscal year; withdrawn awards excluded entirely |
| Delivery ratios | `audited ÷ projected`, from GOED's own audit table; wage ratio is jobs-weighted |

**Why 2080 hours.** Not a convention picked at random: GOED's own FY2016 rows satisfy
`jobs × wage × 2080` to the dollar. Using it reproduces the state's arithmetic — which is also how the
broken "Total Annual Wages" column in the FY2023–24 report was detected. A test pins this.

## What is not measured

- **Outcomes.** GOED publishes projections; it does not publish measured results, and its audit tables do
  not break results out by program. Promised-versus-delivered is therefore only available program-wide
  (standard + aviation + data center combined), and is labelled as such everywhere it appears.
- **Redemptions.** *Awarded* is the ceiling; *redeemed* is what a jurisdiction actually forgave, and
  companies may redeem at any point across a 10–20 year window. Only the City of Reno publishes it.
- **Confidential schedules.** Applicants routinely request confidentiality under NRS 231.069 for detailed
  capital equipment and employment schedules, so the year-by-year build-up behind each headline figure is
  not public.
- **Resource use per facility.** Only Google publishes facility-level water data for a Nevada site.

## Validation

`npm run validate` enforces, and CI fails on any error:

- every column declared in the schema, and no undeclared columns
- type patterns per field (slug, year-month, date, integer, decimal, URL)
- enum membership, including a closed list of Nevada's 17 counties
- primary key uniqueness
- referential integrity across tables (`company_id`, `source_id`, `primary_source_id`)
- numeric bounds
- fiscal year consistent with approval date
- abatement components summing to any published total
- every award carrying at least one abatement figure
- statutory tier consistency (warning)
- non-primary rows carrying an explanatory note (warning)

`npm run check-sources` separately verifies that every source URL still resolves — government PDFs move
often, and a citation-based dataset rots silently without this.
