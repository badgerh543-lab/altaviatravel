# QA report — 19 November 2026

The redesigned application builds and works locally. Public launch still requires the inputs in [remaining-setup.md](remaining-setup.md). This report replaces the obsolete 38-page prototype assessment.

## Verified implementation

| Check | Result |
|---|---|
| Content | 13 tours, 39 attraction entries, 13 sourced hotel examples, 12 destinations, four full articles, 12 photographs; five languages |
| Recorded Astro/TypeScript check | 38 files, 0 errors, warnings or hints |
| Production build | 228 HTML pages, including the private workspace; rebuilt after the dashboard/theme update |
| Link/asset audit | 14,827 local references, 262 unique targets, no broken targets |
| Backend tests | 42 passed, including HTTPS enforcement, expired-booking access, sitemap routing, language plurals and local/production authentication separation |
| Full browser suite | 42 passed, 0 failed, including sitemap XML, Russian duration and default-theme render checks; raw results in `test-results.json` |
| Latest visual checks | Desktop/mobile public pages, admin, and all four seasons; zero WCAG A/AA findings in final palette scans (`final-visual-review.json`) |
| Release artifacts | 225 public URLs, 963 localized groups / 4,815 translated values structurally checked; no detected private/test material in 242 public text files |
| Production SEO | Separate production build passes domain canonicals, language alternatives, robots sitemap reference and HSTS checks (`production-build-audit.json`) |
| Logo layout review | Header/footer logo loaded with no overflow in five languages at 320, 390, 768, 1051, 1200 and 1440px; `brand-review.json` |
| Cloudflare Functions | Wrangler 4.164.0 compiled the Worker successfully |
| Recorded runtime dependency audit | 0 known vulnerabilities in full/runtime audit; Noble Hashes is the server cryptography fallback dependency |

Browser coverage includes language/path/query preservation, all 13 catalog tours visible without pagination, name/place search with apostrophe/spelling variants, filters/sorting/reset, every tour's simple title and attraction/hotel sections, exact company/social links in five languages, gallery keyboard/focus/empty states, a real encrypted local inquiry save, failure/download fallback, planner review/edit/payload, mobile menu, compiled CSP, JavaScript-disabled browsing, accessibility scans and eight viewport widths from 320 to 1920px. Planner payload inspection mocks submission; the contact test saves a real local record in an isolated QA database. An open mobile gallery dialog was scanned too.

The dashboard/theme update adds browser coverage for Dashboard as the landing screen, genuine public customer-intent capture and card filtering, editing a non-first tour while preserving its selection, required complete page sections, and creating/deleting a new tour. An earlier focused nine-test run enabled actual publishing: the generated public page was checked for the custom hotel's description, attraction, itinerary and FAQ, then the temporary tour was removed and the catalog republished. All four themes were applied and verified publicly; winter flakes moved continuously, Pause/Resume worked and reduced-motion settings removed the animation. A delayed dashboard response was prevented from overwriting the tour editor. The final full suite uses the compiled preview and isolated `.local/qa-dashboard-20261119` database, never business accounts or customer records.

Backend coverage includes encryption/decryption, persistence/idempotency, validation/consent, origin/method/content-type checks, body limits, honeypot, rate limiting, missing configuration, Turnstile hostname/action, database failures, inert SQL/script-like input, expiry and recovery after oversized streamed HTTP bodies. Tests use isolated temporary databases and mock external challenge responses.

## Latest compiled-preview measurements

The final Lighthouse mobile simulation used the compiled preview at localhost:4322, leaving the user's development server at port 4321 untouched. It follows the final readability, translation, responsive-image and default-theme updates. The audit script rejects development pages or previews without CSP. Scores vary with host load and browser; these are lab measurements, not field guarantees.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---|---|
| Homepage | 87 | 100 | 100 | 69 | 3.0 s | 0.004 |
| Tour detail | 95 | 100 | 100 | 69 | 2.9 s | 0 |
| Contact | 100 | 100 | 100 | 66 | 1.3 s | 0 |

**Homepage performance remains below the requested 90 target.** Rendering/main-thread time still needs work and deployed CDN measurement. The final review reduced the mobile hero request from about 152 KB to 92 KB at the measured viewport, removed catalog-only search metadata from display cards and avoided redundant whole-page theme restyling. The font preload experiment was removed after it worsened measurements. The page retains normal layout flow. An earlier run reached 92, but the final result is 87. Accessibility remains 100; automated scans do not replace human assistive-technology review.

Preview intentionally blocks indexing through robots/meta directives until a real HTTPS SITE_URL is configured. This lowers SEO scores. Canonical/hreflang and sitemap output exist. Recheck indexing, headers, compression/cache behavior, TLS and Turnstile on the live domain. Reports are in `performance/`; earlier screenshots are in `screenshots/`.

## Dependency finding

The admin update refreshed the lockfile. The current full npm audit reports **0 known vulnerabilities**, superseding the earlier 12-entry picomatch finding. See `dependency-audit.json`. This audit does not constitute a penetration test or remove the need for ongoing dependency updates.

## Public operation remains unverified

No public deployment, real-domain Turnstile test, email delivery, payment integration or independent penetration test is claimed. Verified business details, operational tour offers, approved policies, native-language review, hosting keys and staff monitoring remain owner inputs. Current routes require quotes. Local inquiries are encrypted on this computer and are not emailed to staff. Scheduled production deletion is supplied but cannot run until deployed.

## Private workspace verification

The local-login update verifies username/password sign-in with an existing authenticator stored, direct access without forced setup, eight-character password changes, logout/repeat login and restoring the session in a newly opened browser context. The local cookie has a seven-day lifetime. Tests exercise the real recovery CLI through a private stdin pipe, confirm credential/session reset and clearing of stale login limits, and then sign in immediately. Separate HTTPS production tests still enforce first-password rotation, MFA/recovery single use, stronger passwords, sensitive-action reauthentication and the 30-minute idle limit. Client-supplied local-mode fields cannot relax production rules. No business account password was reset by this update.

The combined browser checks cover no public `/edit` links/sitemap entries, private headers, first password change, local QR/TOTP enrollment, one-time recovery codes, server-enforced roles, reservation?approval?sold flow, tour price editing, catalog review and a real local publish/rebuild. A focused full-access form test also adds/removes FAQ content, uploads and previews actual WebP variants through HTTP, removes the draft image, creates a staff account, and saves/reloads encrypted Payme preparation without returning its key. Tests use `.local/qa-admin`, never the business database. Example customer/payment data is synthetic.

Backend checks cover session cookies, expiry/logout/revocation, origin/CSRF/method/setup checks, encrypted records/provider keys, TOTP standard vectors, portable/native password-hash equivalence at the full work factor, one-time recovery, fresh sensitive-action authentication, role restrictions, required price/image fields, stale revisions, owner-draft isolation, sale amount locking, draft image privacy and binary integrity, private build-token export, content structure/unsafe link rejection, retention and a concurrent publishing lease. Local publication was exercised on Windows, with a watcher-safe staging directory and previous-output backup.

Screenshots: `screenshots/admin-overview.png`, `screenshots/admin-dashboard-mobile.png`, `screenshots/admin-mobile.png`, `screenshots/admin-themes.png`, `screenshots/winter-theme.png`. The panel follows the existing typography, orange/yellow accents and teal navigation. A mobile navigation overflow found during regression testing was corrected and retested; image-picker rows retain full thumbnails/captions in their scroll area. The requested developer account exists only in the private local database and requires password change/authenticator setup; no production default credential is built in.

Cloudflare Functions were compiled with Wrangler 4.164.0. Remote D1/HTTPS deployment and live payment providers have not been tested because no accounts/credentials were supplied. Cloudflare native PBKDF2 limitations use the tested same-strength Noble fallback; actual deployed CPU allowance must still be verified on a paid plan. Merchant screens are configuration preparation, not a payment gateway.
