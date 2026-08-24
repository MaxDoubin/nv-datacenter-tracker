# Nevada Data Center Tax Abatement Tracker

An open, fully sourced dataset of Nevada's data center tax abatements under **NRS 360.754** — what was
promised, what it cost, and what was actually delivered.

Nevada has approved **11 active data center abatements** worth an estimated **$373,568,280** in forgone state
and local tax revenue, in exchange for **314 promised permanent jobs** — about **$1.19 million of abatement per
promised job**. The state does not publish whether those promises were kept.

Every figure in this repository cites the document it came from, with a retrieval date. Where official sources
contradict each other, both values are recorded along with the reasoning for which one is used.

**Live site: https://maxdoubin.github.io/nv-datacenter-tracker/**

Deploys automatically on every push to `main`. See [docs/DEPLOY.md](docs/DEPLOY.md) to add a free
Cloudflare deployment alongside it.

---

## What this found

Building the dataset surfaced **nine documented conflicts** between official sources, five of them
material. The most significant:

| Finding | Detail |
| --- | --- |
| **Wrong county and wrong entity** in the report to the Legislature | GOED's FY2023–24 biennial report places Novva's FY2024 award in **Clark County** under **Novva Holdings, LLC**. GOED's own board packet for the same award — identical to the dollar in both tax figures — describes a 300,000 sq ft facility in **Storey County** filed as **Novva Reno, LLC**. |
| **A broken column** in the report to the Legislature | The "Total Annual Wages" column is `jobs × wage × 2080` for the four FY2016 rows, then wrong for every row after. `$3,013,920` is copy-pasted onto five unrelated awards, and every fiscal-year total prints the identical `$82,767,610`. |
| **A copy-pasted total** | In the "After Audit Results + Withdrawals" rows, the sales-and-use-tax column repeats FY2016's `$159,387,374` for FY2019, FY2021 and FY2022 — years in which nobody withdrew. |
| **An unexplained restatement** | FY2016 post-withdrawal capital investment is `$2,796,566,566` in the FY2010–22 report (arithmetically exact) and `$2,747,337,806` in the FY2023–24 report. The difference matches no documented withdrawal. |
| **A transcribed entity name** | The biennial report prints `Vantage Data Centers MN11, LLC`; the board packet and Vantage's own naming say `NV11`. |
| **Oversight gap** | Only **3 of 13** active data center abatements had a completed audit as of January 2025. GOED publishes projections but never measures outcomes against them. |

Program-wide, across every GOED abatement program with completed audits (FY2010–FY2019), companies delivered
**48% of the capital investment they projected** while exceeding their job projections — at wages well above
what they forecast.

## The data

Thirteen CSV tables in [`data/`](data/). Full column-by-column documentation in
[`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) (generated from the schema).

| File | Rows | What it holds |
| --- | --: | --- |
| [`abatements.csv`](data/abatements.csv) | 12 | Every award approved under NRS 360.754 |
| [`companies.csv`](data/companies.csv) | 9 | Entity → operator → parent, with attribution confidence |
| [`sources.csv`](data/sources.csv) | 14 | Every source document, with retrieval dates |
| [`discrepancies.csv`](data/discrepancies.csv) | 9 | Conflicts between official sources, and which one wins |
| [`facilities.csv`](data/facilities.csv) | 33 | Nevada data center locations, operational and planned |
| [`water.csv`](data/water.csv) | 15 | Water observations, plus local benchmarks for scale |
| [`energy.csv`](data/energy.csv) | 10 | Power demand and national context |
| [`redemptions.csv`](data/redemptions.csv) | 25 | Abatements *actually* redeemed (City of Reno, FY2017–24) |
| [`statewide_wage.csv`](data/statewide_wage.csv) | 4 | Statutory wage floor by fiscal year |
| [`program_audit_summary.csv`](data/program_audit_summary.csv) | 13 | GOED's promised-vs-audited totals |
| [`compliance_rates.csv`](data/compliance_rates.csv) | 13 | Approval, withdrawal and compliance counts |
| [`policy_timeline.csv`](data/policy_timeline.csv) | 11 | Statutes and local-government actions |
| [`accountability_findings.csv`](data/accountability_findings.csv) | 5 | Published findings on oversight gaps |

### Sourcing rules

1. **Primary first.** GOED board packets outrank GOED reports to the Legislature, which outrank press
   releases, which outrank trade press. Every row records which tier it rests on.
2. **Sourced, not computed.** The CSVs hold what documents say. Anything derived — abatement per job, implied
   payroll, cumulative totals — is computed at build time and labelled as such.
3. **Conflicts recorded, not resolved silently.** See `discrepancies.csv`.
4. **Nothing invented.** A figure with no source is left empty. One award (Colovore Reno 1) is marked
   `secondary` because only trade-press coverage exists so far; it is flagged in the interface as needing a
   primary document.

## Using it

```bash
git clone https://github.com/MaxDoubin/nv-datacenter-tracker.git
cd nv-datacenter-tracker
npm run validate    # schema, references and domain rules
npm test            # 22 tests, no network
npm run build       # writes dist/ — site, JSON API, exports
npm run serve       # preview at http://localhost:8787
npm run report      # terminal summary
npm run check-sources   # verify every source URL still resolves
```

**No dependencies.** Not "few" — zero, runtime and dev. Node 22.6+ runs the TypeScript directly and
`node --test` runs the tests. `npm install` installs nothing, CI finishes in seconds, and there is no supply
chain to audit. For a dataset meant to be trusted and forked, that is a feature.

### JSON API

Static, versioned, CORS-open, no key:

```
/api/v1/all.json            everything, including derived summaries
/api/v1/summary.json        headline totals and aggregates
/api/v1/abatements.json     all awards with derived fields
/api/v1/award/{id}.json     one award, plus its company, source and conflicts
/api/v1/discrepancies.json  the data quality ledger
```

Also built: JSONL, a SQL dump (`sqlite3 tracker.db < nv-datacenter-tracker.sql`), per-table
[JSON Schema](https://json-schema.org/), and a [Frictionless Data Package](https://datapackage.org/).

## Contributing

Corrections to the underlying figures are the most valuable thing you can contribute. Bring the source
document and it goes in. See [CONTRIBUTING.md](CONTRIBUTING.md).

The highest-value open gaps:

- **FY2025–FY2027 awards.** Board packets exist for approvals this dataset only has via trade press.
- **`MECP1 Reno 1, LLC`.** Attributed to EdgeCore by contemporaneous reporting, never confirmed in a GOED
  document.
- **Redemptions outside Reno.** Awarded is not redeemed. Every other Nevada jurisdiction is a blank.
- **Personal property terms.** Statute permits 10 or 20 years; only the three most recent awards are confirmed.

## Licence

Code: [MIT](LICENSE). Data: [CC BY 4.0](LICENSE-DATA) — use it anywhere, credit the project.

Not affiliated with the State of Nevada, GOED, or any company named in the data. Figures are compiled from
public documents and may contain errors; cite the linked primary source for anything consequential.
