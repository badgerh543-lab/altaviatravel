# ALTAVIA

A travel discovery and inquiry application built with Astro, TypeScript and a small serverless API. The redesign uses vivid orange/yellow, self-hosted Unbounded/Manrope fonts and licensed destination photography.

The purchased domain is **altavitravel.uz**. Canonical URLs and `/sitemap.xml` use `https://altavitravel.uz` by default. The sitemap covers all 225 public language URLs and excludes administration, APIs, hidden tours and error pages. Local/preview pages remain noindex; production requires `SITE_URL=https://altavitravel.uz` at build time and runtime. No GitHub upload or Cloudflare deployment has been performed from this workspace.

## Run locally

Install **Node.js 24 or later**. Open a terminal in this folder:

```powershell
npm ci
npm run dev
```

Open **http://localhost:4321/uz/**. The header switches languages. This command starts both the website and its inquiry backend. Stop with Ctrl+C. If port 4321 or 8788 is occupied, stop the previous ALTAVIA terminal first.

For the optimized production preview, stop development first:

```powershell
npm run build
npm run preview
```

Public browsing and inquiry testing need no cloud credentials locally. Inquiries are encrypted in `.local/inquiries.sqlite`. The form identifies local mode: requests are **not sent to ALTAVIA staff**. Keep `.local/keys.json` private and back it up with the database; it is needed for decryption. Windows storage inherits your user-folder permissions.

```powershell
npm run inquiries -- list
npm run inquiries -- read REFERENCE_FROM_FORM
```

## Private admin panel

Open **http://localhost:4321/edit/** after starting the app. There is no public menu link. Locally, sign in with your username and password: 8+ characters, no forced password change or authenticator setup. Your browser stays signed in for seven days unless you sign out, reset credentials or clear its cookies. Production retains mandatory password change/authenticator setup and stronger password rules.

Forgot the local password? Run `npm run admin -- recover --username developer`, enter a new password privately, then sign in with it. There is no second forced password change locally. Recovery also clears local login attempt limits and signs out old sessions.

A new checkout uses `npm run admin -- bootstrap` to create its first account through a private password prompt. Developer and Owner have full workspace access. Admin handles bookings/approvals, complete tour editing and seasonal themes. Reservations, recorded sales, all content collections, images, staff accounts and encrypted merchant preparation are available. Save drafts, then Review & publish to rebuild public pages.

The home screen is Dashboard: active tours, booked customers, interested customers, customers ready to pay and requests for more information. Click a card to open its list. Tours has an explicit Edit tour action for every existing trip, six guided sections and a page preview. Theme offers Autumn (the unchanged orange default), Spring, Summer and Winter with continuous snowfall. Theme changes apply on the next public page load without rebuilding.

After updating this checkout, stop the running development command with Ctrl+C and start `npm run dev` again. Local database upgrades preserve existing accounts and bookings. The development command now restarts the API when backend code changes.

See [admin setup and usage](docs/admin-panel.md), [payment preparation](docs/payment-integration.md) and [initial price research](docs/market-pricing.md). Cloud deployment requires migrated D1, explicit admin enablement, private secrets and a configured CMS build hook. Live payment charging is not enabled by entering a merchant ID.

## Implemented

- Five languages: Uzbek, English, Russian, Kyrgyz and Tajik; 228 generated pages including the default redirect and 404.
- 13 tours with simple destination names, daily itineraries, 39 attraction entries, 13 sourced hotel examples, 12 destinations, four full journal articles, FAQs and policy pages.
- All 13 tours visible by default, with name/place search, optional filters, sorting, shareable URLs and empty states. Market-based planning estimates are labelled clearly; final prices and availability require a quote.
- Three-step planner, validated inquiry forms, consent, saved references and downloadable requests.
- Photo gallery with category filters, keyboard/swipe navigation, focus restoration, fullscreen and individual credits.
- Shared local SQLite / Cloudflare D1 backend: encrypted persistence, origin enforcement, server validation, rate limiting, idempotency and production Turnstile verification.
- Responsive layouts, local WebP images/fonts, reduced motion, metadata/hreflang, sitemap, robots rules and production security headers.

The final review corrected Russian duration plurals, selected Kyrgyz labels, outdated price FAQs and privacy descriptions. Known legacy wording is corrected in saved CMS snapshots without replacing staff-written alternatives. Larger form/card text and distinct route photos improve readability. Release checks include `node scripts/audit-build.mjs` and `node scripts/audit-release.mjs` after building.

## Maintain and launch

Edit `src/data/*.json`; see [CONTENT_GUIDE.md](CONTENT_GUIDE.md). Altavia travel by Travero Group M.Ch.J., the Andijon address, phone and official social links are configured. Public operation still requires an email/privacy contact, approved policies, a Cloudflare account/domain, D1 and Turnstile keys. No public deployment or email delivery is claimed. [DEPLOYMENT.md](DEPLOYMENT.md) has the setup and staff workflow; [docs/remaining-setup.md](docs/remaining-setup.md) lists owner inputs.

## Verify

```powershell
npm run content:check
npm run check
npm test
npm run build
npm run preview
# In a second terminal with preview running:
npm run test:e2e
```

Browser tests use installed Microsoft Edge. For Playwright Chromium, run `npx playwright install chromium` and remove `channel: 'msedge'` from `playwright.config.ts`. See [docs/qa-report.md](docs/qa-report.md) for measured results and limitations. `npm run audit:runtime` checks deployed dependencies; the full dependency audit is also clean as of this admin update.

| Path | Purpose |
|---|---|
| `src/pages`, `src/components`, `src/styles` | Pages and shared design |
| `src/data` | Content, translations, media credits and schemas |
| `src/scripts` | Browser enhancements |
| `server`, `functions/api` | Local backend and Cloudflare adapters |
| `migrations`, `workers` | D1 schema and scheduled retention |
| `tests`, `docs` | Verification, research, operations and launch notes |
