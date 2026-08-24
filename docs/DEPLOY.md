# Deploying

The site is fully static: HTML, CSS, one JS module, and a tree of generated JSON. It needs no server, no
database and no secrets to build. Any static host works; below are the two free ones this repository is
configured for.

## Cloudflare (recommended)

Static asset requests on Cloudflare are **free and unmetered**. There is no bandwidth bill and no request
bill for a site like this. The free plan covers everything here.

### Option A: connect the repository in the dashboard (no secrets, easiest)

This is the path to take if you just want it live.

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**.
2. Choose **Import a repository** and authorise GitHub, then pick `nv-datacenter-tracker`.
3. Set the build configuration:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 24 (set an environment variable `NODE_VERSION` = `24` if the default is older,
     the build needs Node 23.6+ to run TypeScript directly)
4. Deploy.

Cloudflare then rebuilds and republishes on every push to `main`, and gives every pull request its own
preview URL. You get a free `*.workers.dev` (or `*.pages.dev`) subdomain with TLS. No API tokens are
involved, because Cloudflare pulls from GitHub itself.

**Free plan limits that matter here:** 500 builds/month, 20,000 static asset files per deployment, 25 MiB
per file. This repository builds to well under 100 files.

### Option B: deploy from GitHub Actions

Use this if you want GitHub to drive deploys. [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml)
is already written; it validates and tests before publishing, so a bad dataset cannot go live.

It needs two repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Workers & Pages overview, right-hand sidebar |

Scope the token to Workers only. It does not need access to DNS, zones or anything else.

To deploy from your own machine instead:

```bash
npm run build
npx wrangler deploy
```

[`wrangler.jsonc`](../wrangler.jsonc) declares `dist/` as the asset directory and no Worker script, so
Cloudflare serves the files straight from its edge. `not_found_handling` is `none` deliberately, because the app
uses hash routing, so every real path is a real file and a miss should be an honest 404 rather than the
index page. The JSON API depends on that.

## GitHub Pages (free mirror)

[`deploy-pages.yml`](../.github/workflows/deploy-pages.yml) publishes the same `dist/` to Pages. Enable it
once under **Settings → Pages → Source: GitHub Actions**.

Running both is deliberate. For a public-interest dataset that other people will cite, having the same
content at two independent hosts is cheap insurance.

## A custom domain

Both hosts take one for free. You pay only for the domain registration.

- **Cloudflare:** Workers & Pages → your project → Settings → Domains & Routes → Add. If the domain's DNS is
  already on Cloudflare, TLS is automatic and immediate.
- **GitHub Pages:** Settings → Pages → Custom domain, then a `CNAME` record at your registrar.

## Verifying a deployment

```bash
curl -s https://YOUR-DOMAIN/api/v1/summary.json | head -20
curl -sI https://YOUR-DOMAIN/api/v1/all.json | grep -i access-control
```

The second should show `access-control-allow-origin: *`. [`_headers`](../src/scripts/build.ts) sets CORS on
`/api/*` so other people can build against the data. Cloudflare and Netlify-style hosts read that file;
GitHub Pages ignores it, which is one more reason to treat Cloudflare as primary.
