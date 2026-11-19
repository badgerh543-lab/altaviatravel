# Cloudflare Pages deployment

The static website needs no paid API or persistent server. Secure public inquiries use Pages Functions, D1 and Turnstile. Hosting quotas/availability depend on your Cloudflare account; no subscription or deployment was created in this workspace.

## 1. Prepare content and account

Complete `docs/remaining-setup.md`. Add verified contacts, review routes/translations/policies and set `company.policiesApproved=true`. Use Node 24+. Run `npm ci`, `npm run check`, `npm test` and `npm run build`.

Sign in to your own Cloudflare account. Decide your real canonical HTTPS domain. Use a separate test database for previews. Do not point preview branches at customer data.

The owner has chosen **altavitravel.uz**. Use **`SITE_URL=https://altavitravel.uz`** in both production build settings and Functions runtime. This enables production canonical URLs, indexing and the robots sitemap reference. Leave this unset, or use the local URL, for local checks; Pages/Workers preview origins remain noindex. `/sitemap.xml` and `/robots.txt` are available in development and generated as static files during builds. The sitemap includes only actual public language pages. Do not manually maintain a second sitemap in `public/`.

The current checkout has not been uploaded to GitHub or deployed. Upload the current source with `.gitignore` respected, including `functions/`, `server/`, `shared/`, `src/`, `migrations/` and build scripts. Exclude `.local/`, `.env*`, `.wrangler/`, databases and keys. The connected Git repository must receive these latest files before Cloudflare can build them.

## 2. D1 and configuration

From the project root, use the official Wrangler CLI:

```powershell
npx wrangler login
npx wrangler d1 create altavia-inquiries
Copy-Item wrangler.toml.example wrangler.toml
```

Put the returned database ID into `wrangler.toml`. Keep binding name `DB`. Apply all pending migrations:

```powershell
npx wrangler d1 migrations apply DB --remote
```

The migrations are `0001_inquiries.sql`, `0002_admin.sql` and `0003_dashboard_theme.sql`. The third adds customer intents and seasonal settings while preserving existing records. Apply them to the intended account/database only, before deploying the updated Functions. See [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## 3. Turnstile and secrets

Create a Turnstile widget for the real domain. Configure these in the Pages project settings for the production environment:

| Variable/binding | Value |
|---|---|
| `DB` | D1 database binding, not a string |
| `SITE_URL` | Canonical HTTPS origin; also set at build time |
| `INQUIRY_ENCRYPTION_KEY` | Secret: 32 random bytes encoded as base64 |
| `RATE_LIMIT_SECRET` | Secret: at least 32 random characters |
| `TURNSTILE_SECRET_KEY` | Secret: widget server key |
| `TURNSTILE_SITE_KEY` | Public widget site key |
| `BUSINESS_READY` | `true` only after content/policy/operational review |

Generate keys locally and save them in your password manager:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Do not paste secrets into source files, build logs, browser code or chat. Do not prefix secrets with `PUBLIC_`. Losing the encryption key makes stored records unreadable. Rotation needs a planned migration of existing encrypted rows; do not simply replace the key and discard the old one.

The API checks Turnstile hostname and action `inquiry`, not merely the client token. [Turnstile server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) explains the integration. Local mode bypasses this only in the local server, never in the Pages adapter.

## 4. Build and deploy

Configure a Pages Git project with build command `npm run build`, output `dist`, and Node version 24 or later. Keep `functions/` at the repository root. Set `SITE_URL` and `BUSINESS_READY` in the build environment as well as runtime; the build validates business fields when enabled. Alternatively deploy from the root with Wrangler after building:

```powershell
# Set SITE_URL to your verified domain in a private .env first.
npm run build
npx wrangler pages deploy dist --project-name altavia
```

Use Wrangler or Git deployment for Functions; do not drag only `dist/` into an upload UI and expect the backend to accompany it. `public/_routes.json` restricts function execution to `/api/*`. `_headers`, `robots.txt` and `sitemap.xml` are generated into `dist/` by postbuild. Local/example builds are deliberately noindex. Cloudflare applies the configured static security/cache headers.

Read [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) and [deployment commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/). Dashboard configuration changes require redeployment. Configure preview independently with a preview database and secrets; leave `BUSINESS_READY` false until that environment is intentionally enabled.

## 5. Daily retention

Copy `wrangler.retention.toml.example` to `wrangler.retention.toml`, set the same production D1 ID, then:

```powershell
npx wrangler deploy --config wrangler.retention.toml
```

This worker has no public endpoint. Its daily 02:17 UTC schedule deletes expired inquiries and rate buckets. Inquiry expiry is 90 days after submission; daily removal can occur up to one day later. Verify scheduled runs in Cloudflare. Account backups and downloaded exports have their own retention policy.

## 6. Read and respond to inquiries

There is no public database-reading route. Staff use their authorized Cloudflare account. List references/timestamps without decrypting contact data:

```powershell
npx wrangler d1 execute DB --remote --command "SELECT id, created_at, expires_at FROM inquiries ORDER BY created_at DESC LIMIT 100"
```

To retrieve a specific record, replace `REFERENCE` with the form's UUID (a UUID only). Use a private local folder:

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
npx wrangler d1 execute DB --remote --command "SELECT id, created_at, expires_at, payload FROM inquiries WHERE id='REFERENCE'" --json | Set-Content -Encoding utf8 .local/export.json
node --env-file=.env.production.local scripts/decrypt-export.mjs .local/export.json
```

The ignored `.env.production.local` contains only the authorized encryption key needed for that operation. Decrypted output is sensitive: do not record/share the terminal. Reply through the customer's chosen contact channel. This application saves requests; it does not automatically email staff or the customer.

For an approved deletion, verify the reference, then execute `DELETE FROM inquiries WHERE id='REFERENCE'`. Delete local exports after use. Locally, `npm run inquiries -- list`, `read REFERENCE`, `delete REFERENCE` and `purge` provide the same owner operations. Querying staff must have least-privilege access and account MFA.

## 7. Production acceptance and rollback

On the live HTTPS domain, verify API status, complete a real challenge, submit a controlled test, decrypt the saved reference and delete it. Test an invalid form and confirm there is no success receipt. Check the canonical URL, hreflang, sitemap, robots, contact channels and security headers. Run browser tests against an isolated staging queue, not real production customer traffic.

Preserve a working deployment and database/key backups before subsequent migrations. Roll back static/Functions deployment in Pages if needed; do not delete the customer database to roll back UI. If the API is unavailable, forms honestly report failure and keep the request-download fallback.

## Private admin and CMS

The `/edit/` workspace is implemented. Follow [docs/admin-panel.md](docs/admin-panel.md) for all three D1 migrations, private bootstrap, roles/MFA, paid CPU allowance, CMS export token and Cloudflare deploy hook. There are no automatic production default credentials. Staff start on Dashboard, use the protected booking screen and can apply seasonal themes without a content build. The export commands above remain an operator fallback. A personal-record deletion must remove the same UUID from both `inquiries` and `bookings`, and from private exports/backups under the retention policy.
