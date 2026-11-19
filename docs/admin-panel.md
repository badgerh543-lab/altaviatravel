# Altavia private workspace

Open **`/edit/`** on the same domain as the website, for example `http://localhost:4321/edit/`. `/edit` is also accepted by the host. There is no public navigation link. The page is excluded from the sitemap and has noindex and no-store directives. Its address is discoverable; authorization protects the data.

## Local use

Run `npm run dev` and open `/edit/`. A local developer account was created for this workspace using the initial credentials supplied by the owner. The password is stored as a salted hash, never in source or public files. If this is a fresh checkout, create the first account privately:

```powershell
npm run admin -- bootstrap
```

The default username is `developer`. The terminal prompts without echoing the password. Bootstrap refuses to overwrite existing accounts. **Localhost uses username/password only**, with an 8-character minimum for new/recovery passwords. There is no forced rotation or authenticator prompt locally, including accounts that already have an authenticator stored. The browser keeps its private session cookie for seven days; sign-out, credential changes and cookie clearing end it. Existing passwords remain valid; this update does not reset any account.

Change your password in Account. If you forget it locally, run `npm run admin -- recover --username developer`, enter a new password with 8+ characters, and sign in directly. This trusted local operation revokes sessions, resets authenticator material and clears the account/loopback login attempt limits. The login page also provides these recovery instructions. Protect the computer and `.local/` backups accordingly.

**Production remains stricter:** first sign-in requires changing the temporary password to a unique 12–128-character password and enrolling an authenticator. Save the ten one-time recovery codes privately. Authenticator codes are also single-use. A full-access colleague can reset a lost authenticator after verifying identity. Production requires fresh password plus authenticator/recovery verification for sensitive account/provider changes; local sensitive changes confirm the current password. Local mode is chosen only by the loopback server, never a browser setting or request field. The CLI recovery command changes only the local database, not remote D1 accounts.

## Roles

| Capability | Developer | Owner | Admin |
|---|---|---|---|
| Review inquiries, reservations, approvals and recorded sales | Yes | Yes | Yes |
| Add/change/remove tours and upload tour images | Yes | Yes | Yes |
| Apply a seasonal website theme | Yes | Yes | Yes |
| Publish tour-only changes after catalog review | Yes | Yes | Yes |
| Edit other website content, images and company information | Yes | Yes | No |
| Manage staff, provider settings and audit log | Yes | Yes | No |

Roles are checked by the server for every protected operation. Owners and developers have equal full workspace permissions; neither role grants Cloudflare account access or permission to execute arbitrary code.

## Booking workflow

Dashboard is the first screen after sign-in. Its five cards open the corresponding tours or customer list:

- **Active tours:** tours currently published and visible; unpublished draft changes are identified separately.
- **Booked:** reserved and approved customers, excluding completed sales and cancellations.
- **Interested**, **Wants to pay**, **Needs more info:** open customer requests grouped by the customer's selected intent.

Intent and booking status are separate. A reserved customer can still want more information, so cards can overlap. The public inquiry form asks what the customer needs; staff can update that choice in a booking. Selecting Wants to pay does not mark a payment received. Recent customer requests have a direct Open request action; recorded sales and currency totals appear separately.

New inquiry → reserved → approved → sold. Approval requires a travel date, selected tour and agreed total. A sold entry requires prior approval and an explicit confirmation of an actual received payment with its reference. This is a staff accounting record, not bank verification. Sold totals are locked; cancellations do not trigger supplier cancellations or refunds. USD and UZS totals remain separate. Revenue cards cover retained records, not an accounting ledger.

Personal records, including reservations and recorded sales, expire after 90 days in this application. Keep legally required accounting records in the company's accounting system under its approved retention policy. Staff should obtain and record customer contact permission for manually entered reservations. Names, contact details, staff notes and payment references are encrypted at rest.

## Content and publishing

Select **Tours**, find an existing trip and click **Edit tour**, or choose **Add tour**. Saving keeps that same tour selected. The previous editor returned to the first trip after a save; this confusing behavior is corrected. The editor shows unsaved changes and separates six parts: Basics, Route & days, Hotels & attractions, Included & practical, Questions & notes, and Page preview.

Supply a simple name, positive USD price per person, image, visibility, route, every itinerary day, highlights, possible hotels, attractions, included/excluded services, accommodation/transport/suitability/practical notes, FAQs and travel notes in all five languages. Hotels and attractions can start from the library or be custom entries, including descriptions and official HTTPS links. Missing fields are listed with links to their section/language. Copy into empty languages is a drafting aid, not translation. Existing tours receive their original shared content as editable per-tour details; editing one tour does not overwrite another tour's hotel notes or FAQ.

Show/hide changes public visibility after publishing. Hidden/deleted tours have no generated detail page; existing reservation records retain their historical tour references. Review the page preview, save the draft, then use **Review & publish** to update public pages.

Content lets full-access users maintain destinations, journal, FAQs, policies, practical advice, interface/homepage copy, hotels, attractions and company fields. Referenced content cannot be removed until its references are changed. Some photographs and interface keys are required by layouts. The forms validate required structure and safe links. Copying text into empty language fields is a drafting aid, not translation.

Images accepts owned/permitted JPEG, PNG and WebP. The browser creates three WebP sizes; the server checks size, signature, dimensions and revision. Draft uploads are private. Publishing makes referenced library images and their rights metadata accessible. Image credits are maintained in Content/Images; arbitrary remote fetches and SVG uploads are unavailable. Keep original rights evidence privately.

Save creates a database draft. **Review & publish** lists the visible tours, prices and images and requires explicit review. An admin cannot publish another owner's pending non-tour changes. Concurrent edits conflict rather than silently overwrite. Local publishing backs up source JSON and the previous built site, builds into a staging directory, then replaces `dist/` after success. Source files are restored if a build fails. Old backups and private build logs are in `.local/content-backups/`; manage their disk usage. The staging build uses `node_modules/.cache/` so Windows development watchers cannot lock its promotion. Astro development can refresh while source is being prepared; the production preview keeps the previous successful build until promotion.

Cloud publishing saves an export snapshot and triggers a configured Cloudflare build. The panel says “build requested”; it does not claim that a hook response proves deployment success. A later request on the new Functions deployment recognizes the matching built snapshot. Check Pages deployment logs for failed builds and retry after fixing their cause.

## Seasonal themes

All three staff roles can open **Theme** and apply Autumn, Spring, Summer or Winter. Autumn preserves the existing orange design and remains the default, including when settings are unavailable. Spring uses blossom pink/green, Summer sun yellow/turquoise, and Winter ice blue/navy. The selection is saved immediately to the database, independently of content drafts. Refresh an open public page to see it; no content publish or rebuild is required.

Winter has continuous decorative snowfall with a Pause/Resume control. It does not intercept clicks, pauses while the browser tab is hidden and is disabled for visitors who request reduced motion. The public appearance endpoint exposes only the preset name. Applying a theme requires the same authenticated session, origin and CSRF checks as other staff changes; arbitrary CSS/scripts cannot be entered. Changes are audited. Administration keeps its consistent palette.

## Production configuration

For the owner's existing `altaviatravel` Worker, follow [the Workers setup guide](cloudflare-workers.md). It includes the production DB binding/migrations, private bootstrap and secrets, build settings and Workers deploy hook. The account and authentication requirements below apply to both Workers and Pages. Use the Workers guide instead of the Pages-specific configuration steps when staying on Workers.

Follow [DEPLOYMENT.md](../DEPLOYMENT.md) for the inquiry API and D1 binding. Apply **all three** migrations in order: inquiries, administration, then `0003_dashboard_theme.sql` for customer intents and theme settings. Existing records default to Interested; their encrypted contents are retained. This adds users, hashed sessions/recovery codes, audit, CMS, image assets, bookings and encrypted merchant settings. Local SQLite initializes/migrates automatically; restarting the app after updating is sufficient locally.

1. Configure runtime `SITE_URL` as the exact HTTPS origin, `ADMIN_ENABLED=true`, D1 `DB`, `INQUIRY_ENCRYPTION_KEY` and `RATE_LIMIT_SECRET`. Production refuses HTTP, unconfigured administration and missing encryption settings. Keep preview and production databases/keys separate.
2. Create the first developer account with `npm run admin -- bootstrap-sql`, entering a private initial password. Apply the generated ignored `.local/admin-bootstrap.sql` to the intended remote D1 database after migrations. It inserts only if no account exists. There is no built-in production password. Remove the private bootstrap file after use.
3. Generate an independent random `CMS_BUILD_TOKEN` of at least 40 characters. Set it in both Pages runtime secrets and the private build environment. It authorizes only the published content export and must never use a `PUBLIC_` prefix.
4. In the Pages Git project, create a [deploy hook](https://developers.cloudflare.com/pages/configuration/deploy-hooks/) and put its URL in runtime secret `CMS_DEPLOY_HOOK`. Set build `CMS_SOURCE_URL=https://YOUR-DOMAIN` and the same private build token. Build with `npm run build`, output `dist`. Initial deployment uses repository content; configure the CMS export after that origin is available. Do not point production builds at a preview database/origin.
5. The build fetches `/api/cms/export/` using the private bearer token, validates the snapshot, writes allowlisted JSON, and generates the actual static routes. Failed export/validation fails the build. Git integration/deploy hook is required for automatic cloud publishing; manual `pages deploy dist` alone does not configure it.
6. Deploy the retention worker with the same migrated database. Test login, password change, authenticator/recovery, role restrictions, enquiry→booking, upload, publish and rollback on isolated HTTPS staging before enabling business use. The Workers adapter uses the private BACKEND Durable Object for the existing password hashing within its Free compute allowance; the alternative Pages adapter needs adequate paid CPU. Verify deployed latency and quotas. The Workers backend and production D1 have now been deployed; payment-provider acceptance remains unclaimed.

Use individual staff accounts. Disable departing staff promptly. Restrict Cloudflare access with MFA and protect the runtime/build secrets, database and encryption-key backups. Additional Cloudflare Access protection may be applied to `/edit*` **and** `/api/admin/*`; configure build-token access separately if protecting the export.

## Security implementation and limits

Passwords use PBKDF2-HMAC-SHA256, 600,000 iterations and random salts, following [OWASP's PBKDF2 guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Some hosted Workers impose a native PBKDF2 iteration cap ([platform issue](https://github.com/cloudflare/workerd/issues/1346)). On that specific unsupported-operation error, the server uses [Noble Hashes](https://github.com/paulmillr/noble-hashes) to calculate the same 600,000-iteration result; a regression test compares both outputs. The work factor is never reduced.

Sessions are random opaque tokens; the database stores their hashes. Production cookies are Secure, HttpOnly, SameSite=Strict with the `__Host-` prefix. Production sessions expire after eight hours or 30 minutes idle; local sessions last seven days. Credential resets revoke other sessions. CSRF tokens are bound to the session, mutations require the configured origin, cross-site requests are rejected, SQL is parameterized, and form rendering uses DOM text rather than user HTML.

Authentication/setup/write attempts have bounded rate windows. Authenticator secrets and provider credentials use AES-256-GCM. User/provider changes require fresh password and authenticator/recovery verification. Logs omit customer contents and credentials; the latest 150 audit events are shown and events expire after one year. Logs are operational records, not tamper-proof records against a database operator.

No software can promise absolute security. Host configuration, trusted staff devices, backups, dependency updates, live HTTPS verification and provider-specific payment verification remain operational responsibilities. Merchant preparation is described in [payment-integration.md](payment-integration.md).
