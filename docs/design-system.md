# Design system

Bright expedition-editorial styling combines geometric headlines, sun-yellow accents, saturated orange actions, clean white space and expansive photography. It replaces the previous muted cream/Georgia prototype.

The brand mark recreates the owner's winged A reference in orange `#ff681f` and teal `#007d72`. Header and footer use the shared `Brand.astro` component. Transparent SVG, a white SVG and a 1920px-wide PNG are in `public/images/brand/`; `public/favicon.svg` uses a simplified version for small sizes. Preserve the aspect ratio and leave space around the wings.

- **Unbounded** display and **Manrope** body/UI fonts are self-hosted with Latin/Cyrillic extended subsets. Licenses: `public/fonts/OFL-*.txt`.
- Orange `#ff681f`, yellow `#ffdb58`, near-black text, white and pale turquoise. Dark button text and a dark hero overlay preserve contrast.
- Homepage rhythm: panoramic hero/search, circular destination portraits, tours, asymmetric Uzbekistan story, yellow planner panel, approach, image ribbon, journal, FAQs and orange invitation.
- Cards show duration/country, descriptive links and a consistent arrow. Motion is subtle; no autoplay carousel or scroll hijacking.
- Mobile uses stacked forms/cards, scrollable chips and a keyboard-operable compact menu. Long translated text grows naturally.
- Accessibility includes visible focus, skip link, semantic headings, live feedback, native details/dialog, Escape/focus restoration and reduced-motion overrides.

Tokens/breakpoints live in `src/styles/main.css`. Keep shared styling there; preserve the deliberate alternation of large photographs and readable editorial text.
