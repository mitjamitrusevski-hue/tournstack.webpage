# TournStack website — maintenance and release guide

A lightweight, static pre-launch website for TournStack. The repository root is the GitHub Pages publish directory; `CNAME` points to `tournstack.com`.

## Pages

- `index.html`: Wizard-first tournament setup, live organiser control, connected outputs, three-step workflow, four core modules, club and independent audiences, Lisbon example, tournament-and-league direction, team and contact route.
- `vision.html`: source-grounded product vision, current status and next steps.
- `contact.html`: Name, Email and Inquiry form connected through a separately deployed Google Apps Script endpoint.
- `faq.html`: 31 expandable questions covering the Tournament Wizard, automation, event control and announcements, leagues, the four modules, branding, pilots, pricing and future personal use. Rounded cards use right/down chevrons and a blue open/focus outline. Native HTML disclosures work without JavaScript.
- `privacy.html`: website privacy notice for visits and contact inquiries, linked from every footer and the contact form.
- `author-mitja-mitrusevski.html`: substantive, indexable author profile linked from every footer and listed in the sitemap.

### Public page register — published source updated 2026-10-07

The 2026-10-07 Wizard-first content update was published from commit `5e4717395429b5ac4a9ce0a110caf6579130b456` and verified on the public domain. The table below describes that published page content; a later local edit may differ until separately released. All six routes returned HTTP 200 and matched the committed HTML bytes during verification. Their intended policy is indexable, their canonicals point to the URLs shown below, and each belongs in `sitemap.xml`. The connected graphs use Mitja Mitruševski (`https://tournstack.com/#mitja-mitrusevski`) as the current first-party author and TournStack (`https://tournstack.com/#organization`) as publisher. The release record under `Marketing/WebPublishing/Operations/Releases` holds the deployment evidence.

| Canonical URL | Purpose; title / H1 | Meta description | Schema type | Incoming links |
|---|---|---|---|---|
| `https://tournstack.com/` | Product overview; “TournStack — Tournament Setup & League Management” / “More play. Less admin.” | We’re building guided ten-minute tournament setup, automatic forms and event emails, simple event control and league management. | `WebPage` | Header, footer, author profile and cross-page navigation. |
| `https://tournstack.com/vision.html` | Product direction; “Our Vision — Simple Tournament & League Organisation” / “Keep organizing simple. Keep sport at the center.” | Why we’re building guided tournament setup and connected league tools, starting with sports centres and local clubs. | `AboutPage` | Header, footer, overview and author profile. |
| `https://tournstack.com/faq.html` | Product answers; “TournStack FAQ — Setup, Automation & League Management” / “Good questions. Clear answers.” | Answers about the Tournament Wizard, ten-minute setup goal, automation, live event control, announcements, leagues and pilot access. | `FAQPage` | Header, footer, overview and author profile. |
| `https://tournstack.com/contact.html` | Inquiry route; “Contact TournStack — Tournaments, Leagues & Pilot Interest” / “What are you working on?” | Tell us about your tournament or league, a possible pilot, partnership or useful idea for TournStack. | `ContactPage` | Header contact action, overview, FAQ, vision and footer. |
| `https://tournstack.com/privacy.html` | Website privacy notice; “Privacy Policy — TournStack” / “Privacy, explained.” | How TournStack handles website visits and contact inquiries, including analytics, browser storage and service providers. | `WebPage` | Footer, contact form and author profile. |
| `https://tournstack.com/author-mitja-mitrusevski.html` | Writer biography; “Mitja Mitruševski — TournStack Author” / “Mitja Mitruševski.” | Meet Mitja Mitruševski, TournStack’s website author and vision and commercial lead. Explore his project work, background and selected writing. | `ProfilePage` with `Person` main entity | Attribution link in every footer. |

The overview leads with the Tournament Wizard and a ten-minute **initial tournament setup goal**, then explains live organiser control and connected public outputs. The goal covers ready-to-open registration resources, not registrations arriving, competition completion or a league season; it is not a measured universal completion time. The four module cards remain beside the shield: Organizer Dashboard, Tournament Portal, Live Screen and TournStack Draw. A three-step section explains guided setup, organiser decisions and one event announcement sent to connected Portals and Live Screens. Configured registration and event emails are sent when their relevant actions occur. A separate section explains B2B branding and standalone or embedded portal access; later content covers tournaments and leagues and future personal access without implying current availability. The vision page keeps its community and development focus.

All pages share fixed navigation with the original SVG wordmark, Overview / Our vision / FAQ tabs, an internal Contact us button and a full footer. Anchors have descriptive titles and English language metadata; source and event links use `rel="external"`. Internal links use `data-link-type="internal"` for explicit classification; `internal` is not a standard HTML `rel` token.

## Run locally

```sh
python -m http.server 8000
```

Visit `http://localhost:8000`. No package installation or build step is required. Reading the site and opening FAQ cards work without JavaScript; contact submission and the invitation require JavaScript.

## Release procedure and project rules

The canonical release procedure is in [PROJECT-INDEXING-RULES.md](https://drive.google.com/file/d/1TLAVlmCwFGEiB5L7Fk2koWHchw4RtwED/view), under “Website source, deployment and release archives.” Read it before committing, publishing or producing a release ZIP. START-HERE.md owns project orientation. The working folder can contain uncommitted/undeployed edits; GitHub identifies committed source; the website is the served release; dated ZIPs are immutable historical snapshots. Pages, Cloudflare Worker and Apps Script have separate deployment records.

The 2026-10-05 audit matched the 60 Drive project files to GitHub commit 3d9324ca51ae26b63b4237f6910563cbcc2d78dc after line-ending normalization and confirmed its successful Pages build/deploy jobs. Direct live retrieval was unavailable. The 2026-10-03 ZIP is older; use an exact commit and deployment record to identify a later release.

App Store and Google Play badges are reserved for an actual store listing or official preorder. Personal use remains a future goal.

## Assets and styling

The supplied SVG logo masters are copied from `Marketing/VisualIdentity/SVG` into `assets/brand/`. Header and footer use the reversed horizontal wordmark; schema uses the full-colour light-background master. Four Soft White footer icons are vector derivatives extracted from the supplied `TS_SocialMediaLogo_Pack.eps`, with the source geometry retained.

The approved AI-generated tennis lifestyle artwork `assets/images/TS_Hero_Tennis_Lifestyle_RGB.webp` (2048 × 768) remains the desktop hero. A `<picture>` switches to the prepared 600 × 800 or 900 × 1200 portrait composition at 760 CSS pixels and below. The hero is eager with high fetch priority; a visible caption identifies its screens as illustrative. Below it, the Lisbon frame displays a real owner-supplied event photograph and the Vision frame displays a visibly labeled AI-generated multi-sport concept. Each frame uses 480, 800 and 1200-pixel WebP variants, intrinsic dimensions, `srcset`/`sizes` and lazy loading. Their captions are live HTML.

The 1200 × 630 WebP social-share image is referenced by Open Graph and Twitter/X tags on all six indexable pages. Page titles, descriptions, canonicals and the established Person/Organization entity IDs remain page-specific. The author profile uses its portrait in visible content and `Person.image`. A 1280 × 480 desktop hero derivative serves suitable intermediate widths; the approved 2048 × 768 artwork remains the largest candidate.

The self-hosted Montserrat variable font is in `assets/fonts/` with its SIL Open Font License. CSS is in `assets/css/styles.css`. A temporary copy of the approved WebP is stored in the user's `_TMP` Drive folder; the website serves its own local asset, so no Drive permissions are needed by visitors.

Public pages reference the supplied transparent MasterFavicon. The earlier `DeepSlateBG` derivative remains in the asset folder as a separate derivative.

Deep Slate (`#0F172A`) and Soft White (`#F8FAFC`) anchor the site. No pure black or pure white is defined. Blue controls and focus rings use the brand's accessible light and dark variants. The five-color gradient appears only as a decorative separator.

The small magenta feature index uses `#E06CE3` on Raised Slate for text contrast; the original master magenta remains unchanged elsewhere.

## Content maintenance

The application is clearly marked as in development. Tournament and league management are both in scope, with supported league formats and availability confirmed per pilot or release. B2B sports centres and local clubs come first; broader B2C self-service follows later. The early live reference is padel; tennis, football, basketball, volleyball, beach volleyball and climbing are wider development scope, with sport-specific formats tested before release. Do not imply that the Lisbon event validated Wizard timing, every sport, a league season or event-announcement delivery. Affordability is an aim; no pricing is confirmed.

Vision and founder copy is based on the supplied “WEB TournStack: Product Vision & Commercial Strategy” document. The Lisbon example describes one deployment on 28 September 2026; it does not establish validation across external organizers. The event link is `https://timelesspassion.fun/en/padel`.

Contact buttons link internally to `contact.html`, which retains `info@tournstack.com` as a direct email alternative. All six HTML pages include the supplied Plausible analytics snippet in the document head, loading `https://plausible.io/js/pa-hcj_wYFVMwBOaNDFRuGWR.js` asynchronously and initializing its queue. The live script returned HTTP 200; receipt of events in the Plausible dashboard remains unverified. Fonts and brand assets remain self-hosted.

## Structured data

The four product pages include a JSON-LD graph connecting the organization, website, logo, software project, named author and verified team names. The overview uses `WebPage`, vision uses `AboutPage`, the FAQ uses `FAQPage` with 31 `Question` / `Answer` pairs, and contact uses `ContactPage`. The SoftwareApplication description follows the current Wizard-first tournament-and-league scope, without claiming release availability. The privacy page also uses a connected `WebPage` graph. Mitja Mitruševski is the author of first-party website content; TournStack is the publisher. His public, linked `ProfilePage` is indexable and in the sitemap. `Person.sameAs` contains Mitja's personal LinkedIn and Timeless Tech biography; `Organization.sameAs` contains TournStack's LinkedIn, Facebook, X and TikTok profiles. Keep those identities separate when adding future authors. Vision, FAQ and contact also include breadcrumbs. Canonical URLs and the sitemap use `https://tournstack.com/`.

## Privacy and consent setup

`privacy.html` identifies Mitja Mitruševski as the current controller and `info@tournstack.com` as the contact point. It describes the website's current providers, cookieless Plausible analytics, session storage for the invitation, and the contact workflow. It states a 24-month limit after the last exchange for Google Sheet inquiry rows and mailbox conversation copies. The owner must review those two stores regularly and remove expired records; no automatic deletion is currently configured for them. The Cloudflare email queue has its separate 30-day purge.

The owner-supplied CookieYes script is installed on all six public HTML pages, and the privacy notice names CookieYes. Meta Pixel and LinkedIn Insight Tag are planned but not installed. Before adding either, configure CookieYes categories and the revisit control, update the privacy/cookie disclosure with those providers and purposes, and verify that advertising requests remain blocked before consent and after rejection. CookieYes Free currently allows 5,000 monthly pageviews but does not permit custom colours or CSS. See [CONSENT_SETUP.md](CONSENT_SETUP.md) for the account configuration and verification sequence.

Keep JSON-LD descriptions and FAQ answers synchronized with the HTML when editing. Do not add invented prices, reviews, released-platform support or download links. Structured data helps machines interpret content; it does not guarantee indexing or AI citations. See `2026-10-02_TournStack_Website_Structured-Data.md` for sources and maintenance details.

## Motion and invitation

`assets/js/site.js` progressively adds 750ms opacity/vertical reveals to below-fold content. Geometry reads are batched before reveal classes are applied. Reduced-motion users receive static visible content. IntersectionObserver failures leave the page visible. A nonmodal invitation appears after 30 seconds of active visible time across page navigation, once per tab session. The timer waits while the CookieYes choice or preference panel is open. On phones the invitation becomes a compact bottom card that keeps the contact action and close control visible while omitting its secondary text. It never takes focus, is dismissible with its close button or Escape, and links to the contact form. It does not appear on the contact page.

## Contact storage and email

The contact destination has tab **WEB Contacts** and columns **Timestamp, Name, Email, Inquiry**. The project index records two distinct Contacts workbooks; do not select one from its title. Confirm the sheet ID in the deployed Apps Script configuration before opening or changing contact data. The earlier unqualified workbook link has been removed because its active-destination identity was not verified in this audit.

The backend is in `integrations/google-apps-script/`. Follow [SETUP.md](integrations/google-apps-script/SETUP.md) to maintain its deployment. The web app URL supplied on 2026-10-03 is configured in the published `assets/js/contact-config.js`; the live form enables submission when JavaScript loads. The private Sheet's `WEB Contacts` tab and four expected headers were confirmed on 2026-10-03. For historical delivery evidence see Validation below; repeat a controlled end-to-end check after relevant backend or form changes.

Submissions use a hidden iframe and checked Google-origin receipts. Apps Script saves a timestamped row before forwarding email jobs to the authenticated Cloudflare Worker in `integrations/cloudflare-mailbox/`. Both the internal **New Contact** notification and the personalized branded confirmation are designed to send through **smtp.mailbox.org**, from **TournStack <info@tournstack.com>**. The selected setup uses Workers Free compatible SQLite-backed Durable Object storage, with no rented server; see [Cloudflare setup](integrations/cloudflare-mailbox/SETUP.md). The Worker is deployed at `https://tournstack-mailbox.tournstack.workers.dev`, and all three secret names were set through private Wrangler prompts. The handoff reports that Apps Script relay properties and SMTP authentication verification are complete; a live Turnstile-protected form submission saved one Sheet row and both expected emails arrived. The previous Node relay is retained as an alternative.

Cloudflare Turnstile server verification, field validation, a honeypot, literal-text storage, a concurrency lock and six-hour duplicate-retry protection are included. No Google or SMTP credentials are stored in the front end. The Worker has an authenticated endpoint, persistent queue, retry alarms and fixed mail destinations/templates. Mail failure preserves the saved Sheet row; relay enqueue failures require operational follow-up. The owner handoff reports both notification and visitor confirmation inbox delivery on 4 October 2026; this maintenance audit did not independently repeat that submission.

## Validation — historical evidence and current limits

Results below apply to their stated dates and versions. They are not a standing guarantee for future edits. The 2026-10-05 source/deployment audit is recorded separately above.


On 2026-10-03, the official Schema.org validator reported zero errors and zero warnings for each of the four published pages. Live browser checks found one H1 per page, matching FAQ visible/schema answers, unique IDs, valid same-page anchors, the expected canonical URLs, four sitemap entries and working same-origin links and assets. The existing `CNAME` is preserved.

Live browser checks confirmed 20 FAQ disclosures with only one open at a time, all scroll reveal targets becoming visible on desktop and mobile, and the invitation appearing after roughly 30 seconds of visible browsing across navigation. It did not take focus, closed with Escape and stayed dismissed in the same tab. The contact page showed no invitation and an enabled submit button. At the 2026-10-03 check, no controlled live contact submission or inbox check had been completed; the later 2026-10-04 owner handoff reports success.

The 2026-10-04 update has 29 visible FAQ disclosures with matching JSON-LD question IDs and answer text in local verification. The previous 20-question live browser result above is historical evidence for the earlier published version.

The Cloudflare email implementation passed six automated SMTP/MIME/HTTP/queue checks, and six retained Node/Apps Script checks passed. The deployed Worker returned HTTP 401 for an unauthenticated `/health` request, confirming that its public route and authorization gate are active. The handoff reports a successful authenticated mailbox.org TLS/SMTP check. The later owner handoff reports inbox arrival on 2026-10-04. SMTP authentication alone does not establish delivery; no new inbox check was performed in the 2026-10-05 maintenance audit.

Headless Chrome visual checks on the live site covered desktop at 1440 px and mobile at 390 px. Neither viewport had horizontal overflow. The fixed header cleared content, the hero and footer rendered, and the FAQ interaction worked. A narrower mobile and reduced-motion visual review can be repeated after future layout changes.
