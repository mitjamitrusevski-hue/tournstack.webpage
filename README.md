# TournStack website — v1.1

A lightweight, static pre-launch website for TournStack. The repository root is the GitHub Pages publish directory; `CNAME` points to `tournstack.com`.

## Pages

- `index.html`: product overview, five key points, individual organizers and sports centers, Lisbon example, team and email contact.
- `vision.html`: source-grounded product vision, current status and next steps.
- `faq.html`: 20 expandable questions covering product fit, access, pilots, pricing and competitors. Native HTML disclosures work without JavaScript.

The overview keeps its one-page structure. Five features sit beside the shield in the hero: website widgets, one organizer back office, venue screens, TournStack Draw and no player downloads. The SaaS access section explains the planned organizer client download and browser links for everyone else.

All pages share fixed navigation with the original SVG wordmark, Overview / Our vision / FAQ tabs, a `mailto:` contact button and a full footer. Anchors have descriptive titles; source and event links are identified as external.

## Run locally

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`. No package installation, build step or JavaScript is required.

## Deployment

GitHub Pages is configured for the `main` branch, repository root. Push the website files to `main`, or extract the supplied ZIP and upload its contents while preserving the `assets/` folders. Do not upload the ZIP itself as the website. Keep the existing `CNAME` file intact. Verify the Pages deployment and all three public URLs after publishing.

The update-only ZIP contains changed and new files. The complete ZIP also includes all existing SVGs, the font, license, `robots.txt`, `.nojekyll` and `CNAME`. Original asset names are preserved. Windows `desktop.ini` metadata is excluded from ZIPs.

## Assets and styling

Original vector assets are in `assets/brand/`, with the supplied naming conventions preserved. All webpage images are SVG. The self-hosted Montserrat variable font is in `assets/fonts/` with its SIL Open Font License. CSS is in `assets/css/styles.css`.

The original transparent favicon is retained. Its `DeepSlateBG` derivative adds only a Deep Slate canvas for browser use.

Deep Slate (`#0F172A`) and Soft White (`#F8FAFC`) anchor the site. No pure black or pure white is defined. Blue controls and focus rings use the brand's accessible light and dark variants. The five-color gradient appears only as a decorative separator.

The small magenta feature index uses `#E06CE3` on Raised Slate for text contrast; the original master magenta remains unchanged elsewhere.

## Content maintenance

The app is clearly marked as in development. Avoid presenting planned leagues or additional sports as released features. Affordability is an aim; no pricing is confirmed. Padel and tennis are the initial focus.

Vision and founder copy is based on the supplied “WEB TournStack: Product Vision & Commercial Strategy” document. The Lisbon example describes one deployment on 28 September 2026; it does not establish validation across external organizers. The event link is `https://timelesspassion.fun/en/padel`.

All contact links use `info@tournstack.com`. There are no analytics, forms, tracking scripts or third-party runtime requests.

## Structured data

Each page includes a JSON-LD graph connecting the organization, website, logo, software project and verified team names. The overview uses `WebPage`, vision uses `AboutPage`, and the FAQ uses `FAQPage` with 20 `Question` / `Answer` pairs. Vision and FAQ also include breadcrumbs. Canonical URLs and the sitemap use `https://tournstack.com/`.

Keep JSON-LD descriptions and FAQ answers synchronized with the HTML when editing. Do not add invented prices, reviews, released-platform support or download links. Structured data helps machines interpret content; it does not guarantee indexing or AI citations. See `2026-10-02_TournStack_Website_Structured-Data.md` for sources and maintenance details.

## Validation

All three HTML pages passed the official Schema.org validator on 2 October 2026 with zero errors and zero warnings. Local checks passed for JSON parsing and graph references, visible FAQ/schema agreement, anchor targets and titles, heading order, unique IDs, asset references, image alternative text, contact links, the event link, brand colors and text contrast. The existing `CNAME` is preserved.

Desktop and mobile visual browser verification remains pending: local Chrome is blocked by runtime socket restrictions and the cloud browser cannot open the local preview. The authored layouts include breakpoints for desktop, tablet and small screens, keyboard focus styles and reduced-motion preferences. After publishing, check header clearance, hero feature wrapping, footer and FAQ disclosure behavior at desktop and mobile widths.
