# Run Altavia on the existing Cloudflare Worker

The chosen domain is **https://altaviatravel.uz**. The existing Worker is `altaviatravel` in the owner's Cloudflare account. The frontend at `altaviatravel.badgerh543.workers.dev` was deployed without the API: `/api/admin/login/`, `/api/status` and `/api/appearance` returned empty 404 responses. The admin browser code then failed while parsing JSON. This was not a password problem.

The repository now supports both hosting adapters. For this existing deployment, keep Workers and use the committed `wrangler.jsonc`, which explicitly connects `workers/app.mjs` to the same production handlers used by Pages. Do not add an Astro Cloudflare adapter: Astro still generates the public pages, while the Worker handles `/api/*`. Unknown API routes return JSON, not an HTML fallback. Accounts, bookings, content, media and themes use the D1 binding `DB`. The owner's production database `altaviatravel` is already bound and migrated, secrets are installed and the initial developer account is created. A Git push does not repeat that account setup.

## 1. Install and create the production database

Run these commands from `D:\ALTAVIA_Foundation` in PowerShell, signed in to the Cloudflare account containing the existing Worker:

```powershell
npm ci
npx wrangler login
npx wrangler d1 create altavia-inquiries --config wrangler.jsonc
```

If that database already exists, use its ID from **Cloudflare > Storage & databases > D1 > your database**, rather than creating another database. Copy the returned `database_id`, then run:

```powershell
npm run cloud:bind -- YOUR_DATABASE_ID
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

`cloud:bind` writes the nonsecret database identifier into `wrangler.jsonc`, ready to commit. It refuses to silently replace a different existing DB binding. All three migrations are required. The first creates inquiries, the second administration/CMS, and the third customer intents/themes. Existing local accounts and bookings are not transferred.

## 2. Configure security secrets

For a new production database only:

```powershell
npm run cloud:secrets
npx wrangler secret bulk .local/cloudflare-secrets.json --config wrangler.jsonc
```

The generator writes independent encryption, rate-limit and CMS-export keys to the ignored `.local/cloudflare-secrets.json`. It does not print them or replace an existing file. Back these keys up privately with the database. If the database already contains encrypted data, retain its existing encryption key; generating a different key does not migrate that data. Never commit `.local`, bootstrap SQL or secrets.

The committed configuration sets runtime `SITE_URL=https://altaviatravel.uz`, `ADMIN_ENABLED=true` and `BUSINESS_READY=false`. Admin is enabled only when its DB and keys are present. Public inquiry intake remains disabled until Turnstile and the business review are complete. Nonsecret Wrangler `vars` are the source of truth at deployment; edit those values in the file when intentionally changing them.

## 3. Create the online developer account

```powershell
npm run admin -- bootstrap-sql
npx wrangler d1 execute DB --remote --file=.local/admin-bootstrap.sql --config wrangler.jsonc
```

Enter the initial password privately in the terminal. The username defaults to `developer`. The generated SQL contains a salted password hash and creates an account only if the remote account table is empty. It never resets an existing online account. Delete the private bootstrap file after a successful import, or keep it only in a protected backup. Local passwords do not automatically become online passwords.

First production sign-in requires changing the temporary password to a unique 12+ character password and setting up an authenticator. Save the recovery codes privately. The entrypoint forwards APIs to the private SQLite-backed `AltaviaBackend` Durable Object through binding `BACKEND`. This supplies a 30-second default CPU allowance, including on the Free plan, instead of the edge Worker's 10 ms Free budget. All existing authentication, authorization and storage handlers run there unchanged; customer/account data remains in D1, not Durable Object storage. No subscription upgrade is required for this configuration, within Cloudflare's Free quotas. The class is created by the committed `v1-backend-compute` migration. Keep that migration history and binding when deploying. See [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/) and [quotas](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## 4. Deploy to the existing Worker

In **Workers & Pages > altaviatravel > Settings > Builds**, configure:

| Setting | Value |
|---|---|
| Git repository | `badgerh543-lab/altaviatravel` |
| Production branch | `main` |
| Root | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --config wrangler.jsonc` |
| Non-production deploy command, if enabled | `npx wrangler deploy --config wrangler.jsonc --env preview` |
| Production build variable | `NODE_VERSION=24` |
| Production build variable | `SITE_URL=https://altaviatravel.uz` |

The preview environment is separate, with no production D1 binding, admin disabled, inquiry intake disabled and no scheduled cleanup. Give preview builds their own `SITE_URL` ending in `.workers.dev` to retain noindex. Configure a separate preview DB/secrets only if backend staging is required. Do not point preview builds at the production CMS export.

The build runner also recognizes Cloudflare's `WORKERS_CI` and `WORKERS_CI_BRANCH`: a `main` build defaults a missing `SITE_URL` to the verified production domain. Other Workers build branches force noindex even if a production URL was inherited. Local builds keep their original noindex behavior unless explicitly configured. All four build stages receive the same environment.

Commit/push the code and the DB binding, including the lockfile:

```powershell
git add .
git commit -m "Deploy the full Altavia backend on Workers"
git push
```

For a direct deployment from this computer instead, set the build origin first:

```powershell
$env:SITE_URL='https://altaviatravel.uz'
npm run cloud:deploy
```

Keep the existing custom domain attached through **Settings > Domains & Routes > Custom Domain**. Sign in at **https://altaviatravel.uz/edit/**. The explicit `ADMIN_ORIGIN` also enables the owner's existing **https://altaviatravel.badgerh543.workers.dev/edit/** workspace while a domain connection is pending. Each production request must use an allowed hostname, and each POST Origin must match that exact request hostname. Cookies remain Secure, HttpOnly and bound to their individual host. A session on one hostname does not sign in the other. Arbitrary alternate hosts and cross-host POST requests are rejected.

The Worker includes the existing retention handler and runs it daily at 02:17 UTC (07:17 Asia/Tashkent). Do not also deploy the separate Pages retention Worker for this installation.

## 5. Enable content publishing and bookings

Editing/saving drafts and applying themes work after the DB/account setup. Rebuilding public content also needs a deploy hook:

1. Open **Worker > Settings > Builds > Deploy Hooks**, create a hook for `main`, and store its private URL as runtime secret `CMS_DEPLOY_HOOK`.
2. Set build variable `CMS_SOURCE_URL=https://altaviatravel.uz` and build secret `CMS_BUILD_TOKEN` to the same value already saved in the Worker's runtime secrets. Configure this only after the initial API deployment is reachable.
3. Redeploy, then test **Review & publish**. The panel reports that a build was requested; check Cloudflare's build result before assuming the new content is live. Both official Pages and Workers hook URLs are accepted; arbitrary URLs are rejected.

For public bookings, create a Turnstile widget for `altaviatravel.uz`, add runtime `TURNSTILE_SITE_KEY` and secret `TURNSTILE_SECRET_KEY`, finish the company/policy review, then set `BUSINESS_READY` to `true` in the configuration and build environment. The existing business validation must pass. Deploy and submit/read/delete a controlled test inquiry. Do not use Turnstile's always-pass development keys in production.

## Verify the live deployment

- `/api/status` returns JSON with `mode: production`. `ready: false` is expected until public inquiry setup is complete.
- `/api/admin/login/` returns production login options after DB/secrets are configured. A JSON 503 means configuration remains incomplete; an empty 404 means the backend was not deployed.
- `/api/admin/session/` returns JSON 401 when signed out. It must not return account data anonymously.
- `/api/appearance` returns the chosen seasonal preset, defaulting to Autumn.
- `/edit/` shows the login screen and HTTPS sessions use Secure/HttpOnly cookies. Verify account setup, role restrictions, tour editing, themes, bookings and publishing on isolated staging before business use.
- Canonical URLs and the 225-page sitemap use `https://altaviatravel.uz`; public indexing requires the correct production build variable.

See [Workers static assets](https://developers.cloudflare.com/workers/static-assets/binding/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and [Workers build hooks](https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/).
