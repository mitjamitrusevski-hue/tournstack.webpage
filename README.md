# TournStack website — v1.3 editorial candidate

A lightweight, static pre-launch website for TournStack. The repository root is the GitHub Pages publish directory; `CNAME` points to `tournstack.com`.

## Pages

- `index.html`: product overview, four core parts, clubs and independent organizers, Lisbon example, future personal use, team and an internal contact-page link.
- `vision.html`: source-grounded product vision, current status and next steps.
- `contact.html`: Name, Email and Inquiry form connected through a separately deployed Google Apps Script endpoint.
- `faq.html`: 29 expandable questions covering product fit, the four interfaces, branding, pilots, pricing and future personal use. Rounded cards use right/down chevrons and a blue open/focus outline. Native HTML disclosures work without JavaScript.
- `privacy.html`: website privacy notice for visits and contact inquiries, linked from every footer and the contact form.

The overview keeps its one-page structure and approved company slogan. Four features sit beside the shield: Organizer Dashboard, Tournament Portal, Live Screen and TournStack Draw. A short section explains B2B branding and standalone or embedded portal access; a later section states the future personal-organizer direction without implying current availability. The vision page now tells a shorter community, evidence and reliability story.

All pages share fixed navigation with the original SVG wordmark, Overview / Our vision / FAQ tabs, an internal Contact us button and a full footer. Anchors have descriptive titles and English language metadata; source and event links use `rel="external"`. Internal links use `data-link-type="internal"` for explicit classification; `internal` is not a standard HTML `rel` token.

## Run locally

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`. No package installation or build step is required. Reading the site and opening FAQ cards work without JavaScript; contact submission and the invitation require JavaScript.

## Deployment

GitHub Pages publishes the `main` branch from the repository root. The complete website assets and integration sources were restored and published on 2026-10-03 in commit `c52c9a8`; the existing `CNAME` and original asset names were preserved. All four public pages and the referenced stylesheet, scripts and hero image returned HTTP 200 after publication.

The 2026-10-04 editorial and layout update refreshes all four pages and adds two clearly labeled image slots for later photography.

App Store and Google Play badges are reserved for an actual store listing or official preorder. The current site describes personal use as a future goal and does not display availability badges.

## Assets and styling

Original vector assets are in `assets/brand/`, with the supplied naming conventions preserved. Logos and favicons remain SVG. The approved AI-generated tennis lifestyle photograph is `assets/images/TS_Hero_Tennis_Lifestyle_RGB.webp` (2048 × 768, approximately 197 KB). It appears directly below the fixed header on the overview. The desktop banner uses roughly half the viewport height, with a 240–600px range; mobile retains the full panoramic composition. The image loads eagerly with high fetch priority and explicit dimensions. A visible caption identifies the device screens as illustrative, not screenshots of the released app. Two CSS-rendered image slots reserve space for approved Lisbon and community photographs; they contain no fabricated people or event evidence. The Lisbon slot aligns with the content grid above it, and the mobile layout gives reading copy more room.

The self-hosted Montserrat variable font is in `assets/fonts/` with its SIL Open Font License. CSS is in `assets/css/styles.css`. A temporary copy of the approved WebP is stored in the user's `_TMP` Drive folder; the website serves its own local asset, so no Drive permissions are needed by visitors.

The original transparent favicon is retained. Its `DeepSlateBG` derivative adds only a Deep Slate canvas for browser use.

Deep Slate (`#0F172A`) and Soft White (`#F8FAFC`) anchor the site. No pure black or pure white is defined. Blue controls and focus rings use the brand's accessible light and dark variants. The five-color gradient appears only as a decorative separator.

The small magenta feature index uses `#E06CE3` on Raised Slate for text contrast; the original master magenta remains unchanged elsewhere.

## Content maintenance

The app is clearly marked as in development. Avoid presenting planned leagues or additional sports as released features. Affordability is an aim; no pricing is confirmed. Padel and tennis are the initial focus.

Vision and founder copy is based on the supplied “WEB TournStack: Product Vision & Commercial Strategy” document. The Lisbon example describes one deployment on 28 September 2026; it does not establish validation across external organizers. The event link is `https://timelesspassion.fun/en/padel`.

Contact buttons link internally to `contact.html`, which retains `info@tournstack.com` as a direct email alternative. All five pages include the supplied Plausible analytics snippet in the document head, loading `https://plausible.io/js/pa-hcj_wYFVMwBOaNDFRuGWR.js` asynchronously and initializing its queue. The live script returned HTTP 200; receipt of events in the Plausible dashboard remains unverified. Fonts and brand assets remain self-hosted.

## Structured data

The four product pages include a JSON-LD graph connecting the organization, website, logo, software project and verified team names. The overview uses `WebPage`, vision uses `AboutPage`, the FAQ uses `FAQPage` with 29 `Question` / `Answer` pairs, and contact uses `ContactPage`. The privacy page uses a simple `WebPage` record. Vision, FAQ and contact also include breadcrumbs. Canonical URLs and the sitemap use `https://tournstack.com/`.

## Privacy and planned consent setup

`privacy.html` identifies Mitja Mitruševski as the current controller and `info@tournstack.com` as the contact point. It describes the website's current providers, cookieless Plausible analytics, session storage for the invitation, and the contact workflow. It states a 24-month limit after the last exchange for Google Sheet inquiry rows and mailbox conversation copies. The owner must review those two stores regularly and remove expired records; no automatic deletion is currently configured for them. The Cloudflare email queue has its separate 30-day purge.

Meta Pixel and LinkedIn Insight Tag are planned but not installed. Before adding either, set up consent management, publish an updated privacy/cookie disclosure naming those providers and purposes, and verify that advertising requests remain blocked before consent and after rejection. CookieYes Free is the proposed managed service for the current traffic level. The account-specific installation key is not in this repository yet. Its free plan permits colour customization but not custom CSS or removal of CookieYes branding; keep the site's consent controls visually aligned through its colour and layout settings. See [CONSENT_SETUP.md](CONSENT_SETUP.md) for the account configuration and verification sequence.

Keep JSON-LD descriptions and FAQ answers synchronized with the HTML when editing. Do not add invented prices, reviews, released-platform support or download links. Structured data helps machines interpret content; it does not guarantee indexing or AI citations. See `2026-10-02_TournStack_Website_Structured-Data.md` for sources and maintenance details.

## Motion and invitation

`assets/js/site.js` progressively adds 750ms opacity/vertical reveals to below-fold content. Reduced-motion users receive static visible content. IntersectionObserver failures leave the page visible. A small, nonmodal invitation appears after 30 seconds of active visible time across page navigation, once per tab session. It never takes focus, is dismissible with its close button or Escape, and links to the contact form. It does not appear on the contact page.

## Contact storage and email

The native Google spreadsheet **Contacts** is already created in the requested DataBase folder, with tab **WEB Contacts** and columns **Timestamp, Name, Email, Inquiry**. [Open Contacts](https://docs.google.com/spreadsheets/d/1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM/edit?usp=drivesdk).

The backend is in `integrations/google-apps-script/`. Follow [SETUP.md](integrations/google-apps-script/SETUP.md) to maintain its deployment. The web app URL supplied on 2026-10-03 is configured in the published `assets/js/contact-config.js`; the live form enables submission when JavaScript loads. The private Sheet's `WEB Contacts` tab and four expected headers were confirmed on 2026-10-03. Live storage and email delivery still require one controlled end-to-end submission.

Submissions use a hidden iframe and checked Google-origin receipts. Apps Script saves a timestamped row before forwarding email jobs to the authenticated Cloudflare Worker in `integrations/cloudflare-mailbox/`. Both the internal **New Contact** notification and the personalized branded confirmation are designed to send through **smtp.mailbox.org**, from **TournStack <info@tournstack.com>**. The selected setup uses Workers Free compatible SQLite-backed Durable Object storage, with no rented server; see [Cloudflare setup](integrations/cloudflare-mailbox/SETUP.md). The Worker is deployed at `https://tournstack-mailbox.tournstack.workers.dev`, and all three secret names were set through private Wrangler prompts. The handoff reports that Apps Script relay properties and SMTP authentication verification are complete; the actual form-to-Sheet and inbox results have not yet been verified. The previous Node relay is retained as an alternative.

Server validation, a honeypot, literal-text storage, a concurrency lock and six-hour duplicate-retry protection are included. No Google or SMTP credentials are stored in the front end. The Worker has an authenticated endpoint, persistent queue, retry alarms and fixed mail destinations/templates. Mail failure preserves the saved Sheet row; relay enqueue failures require operational follow-up. Inbox delivery still needs a live submission check.

## Validation

On 2026-10-03, the official Schema.org validator reported zero errors and zero warnings for each of the four published pages. Live browser checks found one H1 per page, matching FAQ visible/schema answers, unique IDs, valid same-page anchors, the expected canonical URLs, four sitemap entries and working same-origin links and assets. The existing `CNAME` is preserved.

Live browser checks confirmed 20 FAQ disclosures with only one open at a time, all scroll reveal targets becoming visible on desktop and mobile, and the invitation appearing after roughly 30 seconds of visible browsing across navigation. It did not take focus, closed with Escape and stayed dismissed in the same tab. The contact page showed no invitation and an enabled submit button. No controlled live contact submission or inbox check had been completed at this documentation update.

The 2026-10-04 update has 29 visible FAQ disclosures with matching JSON-LD question IDs and answer text in local verification. The previous 20-question live browser result above is historical evidence for the earlier published version.

The Cloudflare email implementation passed six automated SMTP/MIME/HTTP/queue checks, and six retained Node/Apps Script checks passed. The deployed Worker returned HTTP 401 for an unauthenticated `/health` request, confirming that its public route and authorization gate are active. The handoff reports a successful authenticated mailbox.org TLS/SMTP check. Actual inbox placement remains unverified.

Headless Chrome visual checks on the live site covered desktop at 1440 px and mobile at 390 px. Neither viewport had horizontal overflow. The fixed header cleared content, the hero and footer rendered, and the FAQ interaction worked. A narrower mobile and reduced-motion visual review can be repeated after future layout changes.
