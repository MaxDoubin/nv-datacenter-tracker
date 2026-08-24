# Security

## Reporting

This project is a static dataset and a static site; it stores no user data, has no accounts, no server-side
code, and no runtime dependencies. The realistic risk surface is small.

If you find a vulnerability, whether in the build scripts, the generated site or the deployment configuration,
open a [security advisory](https://github.com/MaxDoubin/nv-datacenter-tracker/security/advisories/new)
rather than a public issue. Expect a reply within a week.

## Not security issues

- **A wrong figure in the data.** That is a correction: open an issue with the source document. See
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **A source URL that 404s.** Run `npm run check-sources`; open a normal issue with a replacement URL or an
  archive link.

## Design notes

- **No dependencies**, runtime or dev, so there is no third-party supply chain to compromise.
- **No inline event handlers.** All interpolation into HTML goes through `esc()` in
  [`src/site/format.js`](src/site/format.js). Data in this repository is public-record text, but it is
  community-editable, so it is escaped as untrusted.
- **The local preview server** (`npm run serve`) is for development only. It normalizes paths to keep
  requests inside `dist/` and has a test for that, but it is not hardened for public exposure.
- **The published site is fully static.** No secrets are needed to build it. Deploy credentials, if you use
  the GitHub Actions path, live only in repository secrets and are never read by the build.
