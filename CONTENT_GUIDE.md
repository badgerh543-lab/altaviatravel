# Editing ALTAVIA

Use the private `/edit/` workspace for normal content editing; see [admin-panel.md](docs/admin-panel.md). Save drafts and Review & publish. You can also edit JSON in VS Code, keep a backup, then run `npm run content:check` and `npm run build`. Editor schemas cover the main collections. Every localized value needs `uz`, `en`, `ru`, `ky`, `tg`; save as UTF-8. No paid CMS or translation API is needed.

| File in `src/data/` | Content |
|---|---|
| `tours.json` | Routes, duration, styles, seasons, prices, daily itineraries and complete per-tour page details |
| `places.json` | Localized attraction names/descriptions, official references and optional-activity flags |
| `hotels.json` | Possible hotels, localized areas/planning notes, official websites and verification dates |
| `destinations.json` | Destinations, countries and highlights |
| `articles.json` | Journal titles, introductions and full sections |
| `gallery.json` | Image captions/categories |
| `media.json` | Image IDs, sources, authors, licenses and dimensions |
| `faqs.json`, `service-notes.json` | FAQs, transport, accommodation and suggested inclusions |
| `translations.json` | UI labels and homepage copy |
| `policies.json`, `company.json` | Policies and verified company information |

## Tours

Duplicate a tour object and assign a unique lowercase hyphenated slug. Destination/image IDs must exist in their collections. Write all five title/summary translations. Types: `inbound`, `outbound`, `domestic`. Styles: `culture`, `beach`, `adventure`, `city`. Seasons: `spring`, `summer`, `autumn`, `winter`.

`days` must equal itinerary length. Number days consecutively from 1; use a destination in that route and a specific daily description. Verify actual logistics. New pages are generated in all five languages automatically.

Use `priceStatus: "market-estimate"` for a positive planning price that needs a quote. Include `priceSource`, `priceBasis` and `priceCheckedOn`; initial research is documented in [market-pricing.md](docs/market-pricing.md). The panel requires price and image for new/edited tours. Set `visible: false` to hide a tour from public lists and detail-page generation. Without even a planning estimate, repository content may keep `price: null` and `priceStatus: "on-request"`. For an approved starting price use a positive number, `currency: "USD"` and `priceStatus: "verified-from"`. Cards/details show the localized price. Budget filters exclude known prices above the chosen amount; unpriced routes remain visible because a quote is required. Explain the price basis in the tour copy. Do not invent discounts or availability.

Keep tour display names simple, such as Dubai or Samarkand. Preserve existing URL slugs when renaming. Each tour's `attractions` and `hotels` arrays reference IDs in `places.json` and `hotels.json`; `travelNotes` holds practical advice in all five languages. Hotel entries are examples subject to availability, not booked accommodation or partner claims. Verify their official pages before changing details. Sources are recorded in `docs/tour-content-sources.md`.

The homepage uses one tour/place search field. The catalog displays every tour by default; extra filters are collapsed until requested. `searchAliases` adds useful spellings without changing display names. Search includes all five translated tour/place names, countries and attractions, and ignores case, apostrophe variants and diacritics.

Each tour's `details` object contains localized `highlights`, `included`, `excluded`, `accommodation`, `transport`, `suitable`, `practical`, `faqs`, plus complete `hotels` and `attractions` records. These are the actual tour-page contents. The editor copies shared defaults into legacy tours when needed, then edits each tour independently. Global hotel/place/FAQ changes no longer replace an existing tour's saved details. The older ID arrays remain valid library references; custom inline entries do not need a global record. Without `details`, legacy repository tours fall back to shared content. `scripts/upgrade-dashboard-content.mjs` fills missing details and interface labels without replacing existing entries.

Website-wide **Theme** is a separate runtime setting in the database, not the tour's travel-season filter. Autumn is the default; any staff role can select a preset in `/edit/`. Theme changes need no content publication.

## Photographs

1. Obtain the photograph and permission/license; do not imply stock travelers are ALTAVIA customers.
2. Save a JPEG as `public/images/travel/my-photo.jpg`, preferably at least 1600px wide. This shared library also supplies gallery images.
3. Duplicate a `media.json` record; set `id: "my-photo"`, truthful title, author, source URL and license URL. URLs use HTTPS. For owned material, link to public owner rights/credits and retain consent privately.
4. Run `npm run media` to create responsive WebP variants and record dimensions.
5. Add `image: "my-photo"`, five translated captions and categories to `gallery.json`. Categories: `uzbekistan`, `international`, `groups`, `culture`, `adventure`, `hotels`, `customers`.
6. Validate/build and inspect desktop/mobile cropping, captions and geographic accuracy. Credits are automatic.

Keep original license records. CC BY-SA derivatives retain the same license; resizing, conversion and layout cropping are disclosed on the credits page. Research image-fetch scripts can overwrite records; they are not the normal editing workflow.

## Company and policies

Email/privacy contact fields are email addresses; phone/WhatsApp use international format beginning `+`; Telegram uses `https://t.me/username`. Configured channels appear on the inquiry page; null values stay hidden. `policiesApproved` removes the draft policy notice. Production activation separately requires `BUSINESS_READY` and service bindings.

The legacy empty testimonials field is not displayed as reviews. No Click, Payme or other payment gateway is active. Prices and services must be confirmed in writing before external payment.

## Recovery

Restore the previous JSON backup, validate and rebuild. Use your own Git repository for history. Never commit `.local/`, `.env*`, customer databases or exports. TypeScript data files are thin application wrappers; JSON is the content source of truth.

Uploaded panel images do not need `npm run media`: their three WebP variants are stored by the API. The media command preserves uploaded records. Cloud CMS builds use the published database snapshot, so repository-only edits must be incorporated into the CMS draft before using that publishing workflow.

The final review's exact legacy text replacements are recorded in `shared/content-corrections.json`. CMS loading applies those replacements and fills missing interface labels, preserving different staff-authored wording and existing revisions. The original price FAQ is corrected in both shared FAQs and existing per-tour copies. Review changed policies before public activation; the audit does not set `policiesApproved` automatically.
