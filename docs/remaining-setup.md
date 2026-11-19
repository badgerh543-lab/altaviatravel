# Remaining setup for public operation

The owner has purchased **altaviatravel.uz** and uploaded the source to GitHub. The original Worker deployment omitted the API. The explicit Worker backend has now been deployed, the owner's `altaviatravel` D1 database has all three migrations, security secrets are configured, and a separate developer account has been created. The initial credential is stored privately in ignored `.local/online-admin-login.txt`; first sign-in still requires changing it and enrolling an authenticator. The custom domain is now connected and the login API/browser checks pass at https://altaviatravel.uz/edit/. The API runs in the private BACKEND Durable Object to avoid the Free edge Worker CPU limit during password hashing; account/customer data remains in D1. Use [cloudflare-workers.md](cloudflare-workers.md) for ongoing configuration, CMS build hooks and public booking activation.

## Remaining technical work

The final compiled-preview Lighthouse performance scores are **87 for the homepage**, 95 for tour detail and 100 for contact. All three scored 100 for accessibility. The homepage remains below the 90 target: rendering/main-thread time needs further optimization and measurement on the live CDN. The review added a smaller responsive mobile hero, removed unused search metadata from display-only cards and avoided redundant default-theme restyling. Scores vary with machine load; an earlier run reached 92, but that is not the final result. Preview indexing stays disabled; a separate production build verifies canonical URLs, indexing, headers and the sitemap for the real domain. Live-domain SEO still needs verification after deployment.

The admin update refreshed the lockfile and the full/runtime dependency audits now report zero known vulnerabilities. Recheck before launch. Evidence is in [qa-report.md](qa-report.md).

## Owner information

The owner has supplied and the site now displays **Altavia travel by Travero Group M.Ch.J.**, **+998 88 455 59 99**, **Andijon shahri, Toshkent ko‘chasi, 4-uy**, Instagram `altaviauz` and Telegram `altavia_admin`. Email/privacy contact and any registration number remain unset in `src/data/company.json`; null values stay hidden. No fabricated email, rating or customer testimonial is displayed.

The final copy review corrected known wording in all five languages, including price FAQs, privacy descriptions and Russian duration plurals. Structural and Unicode checks cover every localized field. Native-language editorial review is still recommended, particularly for Kyrgyz and Tajik; these checks do not constitute native-speaker approval. Review itineraries for operational feasibility: these are **suggested routes**, not contracted departures. Confirm services, suppliers, timings, cancellation/payment terms and applicable privacy obligations before selling. Set `policiesApproved` only after that review.

Gallery photos are licensed destination/editorial images. Group, hotel and customer categories have honest empty states until ALTAVIA supplies suitable images and consent. Andijan currently uses a captioned regional photograph of Kokand; replace it with an owned Andijan image when available.

## Hosting

For the existing Worker, follow [cloudflare-workers.md](cloudflare-workers.md): configure D1, domain, Turnstile and secrets. The main Worker includes scheduled retention. Alternatively, [../DEPLOYMENT.md](../DEPLOYMENT.md) covers Pages with its separate retention Worker. Use independent databases/keys for staging. Set `BUSINESS_READY=true` only after review. Set `SITE_URL` at build time and API runtime; preview builds remain noindex.

Use `SITE_URL=https://altaviatravel.uz` for production. The final sitemap contains 225 public pages with five-language alternatives and excludes `/edit`, `/api` and 404 pages. Submit `https://altaviatravel.uz/sitemap.xml` to Search Console after deployment, not before the domain serves the completed site.

An unconfigured public API refuses submissions without a false success receipt. Browsing, planning and downloading a request still work. Local mode saves encrypted records without cloud credentials.

## Staff workflow

The private `/edit/` workspace opens on Dashboard, with active tours, bookings and customer-intent counts. It handles complete tour pages, seasonal themes, inquiries, reservations, approvals, recorded sales, content, images, roles and merchant preparation. See [admin-panel.md](admin-panel.md) for setup. Apply all three D1 migrations, configure admin secrets, create an individual full-access account, and connect the private CMS export/build hook. After updating locally, restart `npm run dev`; SQLite upgrades automatically. Automatic email/Telegram notifications and live payment processing remain inactive. Entering an ID does not activate a gateway.

Keep encryption keys separate from exports in a password manager. Test record reading, deletion and scheduled expiry; protect Cloudflare access with MFA and appropriate staff permissions. Customer exports belong outside public folders and source control.

## Launch verification

On the configured HTTPS domain, submit a real Turnstile-protected test inquiry, read it from D1 and delete it. Verify canonical/hreflang, sitemap, robots and headers there. Cloud deployment cannot be tested without the account and real keys.

Recheck dependency updates and test the authenticated workspace, roles and publishing on the real HTTPS host. Click/Payme/bank activation requires provider credentials, a provider-specific integration and acceptance tests.

Initial prices are market planning estimates, with their calculation/source notes in [market-pricing.md](market-pricing.md). Review and replace them with approved supplier quotes before representing them as confirmed Altavia offers.
