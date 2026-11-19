# Architecture

Astro builds 228 static pages from typed JSON. Shared language-aware layouts and small browser modules need no client framework hydration or paid content API. `dist/` is the public website. The chosen Workers deployment uses `workers/app.mjs` and an `ASSETS` binding. `/api/*` is forwarded through the private `BACKEND` binding to `AltaviaBackend`, a SQLite-backed Durable Object, which executes the shared production handlers with a 30-second default CPU allowance. This avoids Error 1102 during password hashing on the Free edge Worker budget. The object supplies compute only; D1 still stores accounts, bookings, content and encrypted records. Static assets bypass it. The alternative Pages deployment compiles `functions/` separately and needs adequate paid CPU for authentication. Both use the same authorization and storage code; a static asset upload by itself does not deploy the API.

## Inquiry flow

Form → same-origin `/api/inquiries/` → `server/inquiries.mjs` → transactional SQLite locally / D1 in production → encrypted record → saved reference.

The server enforces method, origin and content type; limits streamed JSON to 16KB; validates fields/consent; rejects honeypots; and limits submissions to five per 15-minute IP bucket. Rate identifiers are keyed hashes, not stored raw IPs. Production verifies Turnstile success, hostname and `inquiry` action.

AES-256-GCM encrypts the payload with a random 12-byte nonce. Metadata stores reference, timestamps and an idempotency fingerprint. Reusing a reference with different content conflicts. SQL parameters are bound. Success is returned only after persistence or for a matching already-saved request. No unauthenticated inquiry-reading endpoint exists. Staff use the private authenticated `/edit/` workspace.

Customer intent (`interested`, `ready-to-pay`, `needs-info`) is validated and stored with both the encrypted payload and queryable metadata. Dashboard aggregates open intents separately from reservation/approval/sale status. Public intent never authorizes payment or approval. Legacy records default to interested through migration 0003.

Records expire after 90 days. Successful writes prune expired records; the local CLI supports `purge`; the production retention worker deletes daily. Owners must separately manage backup/export retention. Staff use role-restricted authenticated bookings, with D1 export/decryption retained as an operator fallback.

## Environment boundaries

`npm run dev` starts a localhost-only API on 8788 and Astro on 4321, joined by a same-origin proxy. Local keys are generated privately; Turnstile bypass is a server-controlled local option that cannot be enabled by a production request. The UI states that data stays on this computer.

The loopback adapter also selects simplified local administration: username/password only, an 8-character password minimum, no forced rotation or authenticator challenge, and seven-day sessions. Login policy comes from a public endpoint containing only mode/requirements; the browser cannot select local mode. Existing passwords are preserved. Local recovery resets credentials and account/loopback login buckets without requiring another password change. Production retains its 12-character minimum, initial rotation, mandatory MFA, eight-hour sessions and 30-minute idle limit. Role, origin, CSRF, encryption and login rate checks apply in both modes.

`npm run preview` serves compiled assets/CSP and the same API. Production fails closed until D1, encryption/rate keys, Turnstile, origin and `BUSINESS_READY` are present. Status exposes readiness/public widget key, never secrets.

Postbuild generates sitemap, robots and headers. Preview domains stay noindex; a configured HTTPS production domain enables indexing. Static assets cache; API responses do not. There is no analytics, marketing cookie, browser localStorage draft persistence, third-party font or image hotlink. Turnstile loads only on enabled production inquiry pages.

Persistence is the inquiry delivery mechanism, not email. Staff must monitor the queue. Encryption does not protect against account/key compromise or sensitive terminal output. Tests do not establish legal compliance or native translation quality; operational review remains necessary.

## Administrative CMS

See [admin-panel.md](admin-panel.md) and [cloudflare-workers.md](cloudflare-workers.md). Static public pages remain inexpensive to serve. Authenticated APIs maintain versioned JSON drafts and published snapshots in SQLite/D1. Local publish backs up source and output, builds into staging and promotes on success. Cloud publish triggers an allowlisted Cloudflare Pages or Workers build hook; that build fetches the private content export. New/hidden/deleted tours generate the appropriate public routes at build time. Image bytes are immutable size-checked WebP assets in the database, exposed after publication. Merchant secrets, customer details and authenticator secrets are encrypted, and no arbitrary filesystem/code editing API is exposed.

`shared/tour-details.mjs` resolves complete per-tour public contents and legacy shared defaults for both the editor and Astro. Tour-only staff can maintain these inline fields without editing global collections. The editor preserves the selected tour and displays missing requirements by section/language. Navigation renders asynchronous responses into their own view so an old dashboard response cannot overwrite a newly opened editor.

Seasonal appearance lives in `site_settings`. Public `/api/appearance/` returns only a validated preset name with no-store caching. Authenticated `/api/admin/theme/` accepts only the four allowlisted names, checks CSRF/origin/roles and audits changes. Public CSS variables preserve autumn defaults; winter adds a bounded decorative animation with pause/reduced-motion support. Applying appearance does not alter content revisions or require static rebuilding.
