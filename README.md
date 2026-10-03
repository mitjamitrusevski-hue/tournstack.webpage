# TournStack website — v1.2

A lightweight, static pre-launch website for TournStack. The repository root is the GitHub Pages publish directory; `CNAME` points to `tournstack.com`.

## Pages

- `index.html`: product overview, five key points, individual organizers and sports centers, Lisbon example, team and an internal contact-page link.
- `vision.html`: source-grounded product vision, current status and next steps.
- `contact.html`: Name, Email and Inquiry form connected through a separately deployed Google Apps Script endpoint.
- `faq.html`: 20 expandable questions covering product fit, access, pilots, pricing and competitors. Rounded cards use right/down chevrons and a blue open/focus outline. Native HTML disclosures work without JavaScript.

The overview keeps its one-page structure. Five features sit beside the shield in the hero: website widgets, one organizer back office, venue screens, TournStack Draw and no player downloads. The SaaS access section explains the planned organizer client download and browser links for everyone else.

All pages share fixed navigation with the original SVG wordmark, Overview / Our vision / FAQ tabs, an internal Contact us button and a full footer. Anchors have descriptive titles and English language metadata; source and event links use `rel="external"`. Internal links use `data-link-type="internal"` for explicit classification; `internal` is not a standard HTML `rel` token.

## Run locally

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`. No package installation or build step is required. Reading the site and opening FAQ cards work without JavaScript; contact submission and the invitation require JavaScript.

## Deployment

GitHub Pages is configured for the `main` branch, repository root. When approved, push the website files to `main` while preserving the `assets/` folders. Keep the existing `CNAME` file intact. Verify the Pages deployment and all four public URLs after publishing.

This working update has not been uploaded or packaged into a new ZIP. Previous v1.1 ZIPs do not contain these changes. Original asset names are preserved.

## Assets and styling

Original vector assets are in `assets/brand/`, with the supplied naming conventions preserved. Logos and favicons remain SVG. The approved AI-generated tennis lifestyle photograph is `assets/images/TS_Hero_Tennis_Lifestyle_RGB.webp` (2048 × 768, approximately 197 KB). It appears directly below the fixed header on the overview without text or logo overlays. The desktop banner uses roughly half the viewport height, with a 240–600px range; mobile retains the full panoramic composition. The image loads eagerly with high fetch priority and explicit dimensions. The device screens are illustrative, not screenshots of the released app.

The self-hosted Montserrat variable font is in `assets/fonts/` with its SIL Open Font License. CSS is in `assets/css/styles.css`. A temporary copy of the approved WebP is stored in the user's `_TMP` Drive folder; the website serves its own local asset, so no Drive permissions are needed by visitors.

The original transparent favicon is retained. Its `DeepSlateBG` derivative adds only a Deep Slate canvas for browser use.

Deep Slate (`#0F172A`) and Soft White (`#F8FAFC`) anchor the site. No pure black or pure white is defined. Blue controls and focus rings use the brand's accessible light and dark variants. The five-color gradient appears only as a decorative separator.

The small magenta feature index uses `#E06CE3` on Raised Slate for text contrast; the original master magenta remains unchanged elsewhere.

## Content maintenance

The app is clearly marked as in development. Avoid presenting planned leagues or additional sports as released features. Affordability is an aim; no pricing is confirmed. Padel and tennis are the initial focus.

Vision and founder copy is based on the supplied “WEB TournStack: Product Vision & Commercial Strategy” document. The Lisbon example describes one deployment on 28 September 2026; it does not establish validation across external organizers. The event link is `https://timelesspassion.fun/en/padel`.

Contact buttons link internally to `contact.html`, which retains `info@tournstack.com` as a direct email alternative. All four pages include the supplied Plausible analytics snippet in the document head, loading `https://plausible.io/js/pa-hcj_wYFVMwBOaNDFRuGWR.js` asynchronously and initializing its queue. Fonts and brand assets remain self-hosted. Live analytics delivery must be checked after deployment.

## Structured data

Each page includes a JSON-LD graph connecting the organization, website, logo, software project and verified team names. The overview uses `WebPage`, vision uses `AboutPage`, the FAQ uses `FAQPage` with 20 `Question` / `Answer` pairs, and contact uses `ContactPage`. Vision, FAQ and contact also include breadcrumbs. Canonical URLs and the sitemap use `https://tournstack.com/`.

Keep JSON-LD descriptions and FAQ answers synchronized with the HTML when editing. Do not add invented prices, reviews, released-platform support or download links. Structured data helps machines interpret content; it does not guarantee indexing or AI citations. See `2026-10-02_TournStack_Website_Structured-Data.md` for sources and maintenance details.

## Motion and invitation

`assets/js/site.js` progressively adds 750ms opacity/vertical reveals to below-fold content. Reduced-motion users receive static visible content. IntersectionObserver failures leave the page visible. A small, nonmodal invitation appears after 30 seconds of active visible time across page navigation, once per tab session. It never takes focus, is dismissible with its close button or Escape, and links to the contact form. It does not appear on the contact page.

## Contact storage and email

The native Google spreadsheet **Contacts** is already created in the requested DataBase folder, with tab **WEB Contacts** and columns **Timestamp, Name, Email, Inquiry**. [Open Contacts](https://docs.google.com/spreadsheets/d/1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM/edit?usp=drivesdk).

The backend is in `integrations/google-apps-script/`. Follow [SETUP.md](integrations/google-apps-script/SETUP.md) to maintain its deployment. The web app URL supplied on 2026-10-03 is configured in `assets/js/contact-config.js`; the local website enables submission when JavaScript loads. These changes still need to be published to GitHub Pages. No public sharing of the Sheet is needed. Live storage and email delivery require an end-to-end submission check after publishing.

Submissions use a hidden iframe and checked Google-origin receipts. Apps Script saves a timestamped row before forwarding email jobs to the authenticated Cloudflare Worker in `integrations/cloudflare-mailbox/`. Both the internal **New Contact** notification and the personalized branded confirmation send directly through **smtp.mailbox.org**, from **TournStack <info@tournstack.com>**. The selected setup uses Workers Free and a SQLite-backed Durable Object queue, with no rented server; see [Cloudflare setup](integrations/cloudflare-mailbox/SETUP.md). It still needs Cloudflare deployment and privately configured SMTP secrets. GitHub Pages hosts the website only. The currently deployed Apps Script Version 1 still uses its previous Google sender until this updated code is redeployed. The previous Node relay is retained as an alternative.

Server validation, a honeypot, literal-text storage, a concurrency lock and six-hour duplicate-retry protection are included. No Google or SMTP credentials are stored in the front end. The Worker has an authenticated endpoint, persistent queue, retry alarms and fixed mail destinations/templates. Mail failure preserves the saved Sheet row; relay enqueue failures require operational follow-up. Inbox delivery must be checked with a live submission after the Worker and updated Apps Script are deployed.

## Validation

The original three v1.1 HTML pages passed the official Schema.org validator on 2 October 2026 with zero errors and zero warnings. Local checks passed for JSON parsing and graph references, visible FAQ/schema agreement, anchor targets and titles, heading order, unique IDs, asset references, image alternative text, contact links, the event link, brand colors and text contrast. The existing `CNAME` is preserved.

The v1.2 local checks cover all four pages’ JSON-LD graph references, exact FAQ/schema parity, anchor metadata and destinations, asset references, retained analytics and brand constraints. JavaScript behavior checks cover FAQ exclusivity, reduced motion, scroll reveals, invitation timing/dismissal/navigation persistence and contact receipt/retry handling. Service mocks verify timestamp placement, exact notification content, input validation, formula escaping, duplicate handling and storage surviving email failure. The converted native Contacts Sheet was exported, rendered and inspected. No test contact was added to the real Sheet and no test email was sent.

The Cloudflare email implementation passes six automated SMTP/MIME/HTTP/queue checks, including TLS settings, authentication modes, fragmented replies, timeout behavior, fixed sender, inline logo, duplicate IDs, leases, caps and retention. Six retained Node/Apps Script checks also pass. Source and standalone Worker bundles pass Wrangler dry-run builds. Live Cloudflare health, SMTP authentication and inbox delivery remain pending deployment; a local emulator HTTP check was inaccessible in the authoring environment.

Desktop and mobile visual browser verification remains pending: local Chrome is blocked by runtime socket restrictions and the cloud browser cannot open the local preview. The authored layouts include breakpoints for desktop, tablet and small screens, keyboard focus styles and reduced-motion preferences. After publishing, check header clearance, hero feature wrapping, footer and FAQ disclosure behavior at desktop and mobile widths.
