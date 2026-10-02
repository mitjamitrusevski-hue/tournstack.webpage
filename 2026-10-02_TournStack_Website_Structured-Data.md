---
project: TournStack
doc_type: Website
date: 2026-10-02
topic: Structured data and v1.1 handoff
status: Ready for upload; visual browser review pending
---

# TournStack website v1.1

The update keeps the existing product overview, audience sections, Lisbon example, team and vision page. It adds five prominent hero features, a concise SaaS access explanation, fixed navigation, a full footer, an expandable FAQ page and Schema.org JSON-LD.

## Page and entity map

| Page or entity | Schema.org type | Stable identifier |
| --- | --- | --- |
| TournStack project | Organization | `https://tournstack.com/#organization` |
| Original horizontal logo | ImageObject | `https://tournstack.com/#logo` |
| Website | WebSite | `https://tournstack.com/#website` |
| Software in development | SoftwareApplication | `https://tournstack.com/#software` |
| Mitja and Jane | Person | Named fragment identifiers on the home URL |
| Overview | WebPage | `https://tournstack.com/#webpage` |
| Vision | AboutPage | `https://tournstack.com/vision.html#webpage` |
| FAQ | FAQPage | `https://tournstack.com/faq.html#webpage` |
| Visible secondary-page breadcrumbs | BreadcrumbList | Page URL plus `#breadcrumb` |
| 20 visible questions | Question with acceptedAnswer / Answer | FAQ URL plus the matching disclosure ID |

`@id` references connect these entities instead of introducing contradictory copies. Every graph is self-contained. The FAQ's `mainEntity` answers reproduce the visible text, including competitor source references. Content is present in HTML; no script execution is needed to reveal the text to a parser.

The organizer client is described as planned, consistent with the latest instruction and the development status. No installer, current availability, operating-system requirement or release date is asserted. The site states that players and spectators use browser links. SoftwareApplication describes the overall project without implying that the organizer client is itself browser-only.

## Content and claims

The five hero features are website widgets, one organizer back office, browser-based venue screens, TournStack Draw and no player downloads. The supplied product vision and funding brief support this direction. The Lisbon example describes a single early deployment on 28 September 2026, with 80+ players and 70+ spectators; it is not evidence of repeated external validation.

Independent organizers are presented first, followed by sports centers, as requested. Affordability is an aim. Pricing, league support, external pilots and additional sports are not presented as confirmed general availability.

Competitor copy was checked against official documentation. Tournify already describes public tournament websites, live information and presentation screens. Score7 already offers tournament embedding. The FAQ therefore explains TournStack's intended combination and fit without claiming exclusive widgets, universal superiority, forced competitor player downloads or unsupported cost comparisons.

## Links, discoverability and accessibility

- Descriptive `title` attributes accompany clear visible link labels. Titles supplement labels; they do not replace them.
- Email controls use `mailto:info@tournstack.com` and do not send an email automatically.
- External source and event links use `rel="external"`; they open in the current tab.
- Each page has an absolute canonical URL, unique title and description, Open Graph metadata and index/follow robots metadata.
- `sitemap.xml` includes the overview, vision and FAQ. Existing `robots.txt` and domain configuration are preserved.
- The FAQ uses native `details` / `summary` controls, keyboard focus styles, visible numbering and plus/minus indicators.
- The fixed header is offset by body padding and anchor scroll padding. The footer includes navigation, contact and development status.
- Montserrat remains self-hosted. SVG filenames and original logos remain intact. Deep Slate and Soft White remain the anchors.

Structured data provides explicit meaning for parsers that support it. It does not guarantee that a search engine or LLM will crawl, index, rank, recommend or cite the site. Google discontinued FAQ rich results starting 7 May 2026; the FAQPage type still exists in Schema.org. No FAQ search-result enhancement is promised.

## Maintenance

When changing a FAQ, edit both its visible question/answer and the corresponding `mainEntity` JSON-LD entry. Keep its HTML ID and `@id` synchronized. Update the shared feature descriptions across the three pages when product capabilities change. Retain the `In development` status until release is confirmed. Add prices, supported platforms, availability or ratings only when factual and visible on the site.

Keep `tournstack.com` URLs consistent in canonicals, graphs, sitemap and CNAME. If a page moves, update the visible links and structured-data references together. Revalidate HTML in the official validator after substantive markup changes.

## Verification and handoff

On 2 October 2026, the official Schema.org validator reported zero errors and zero warnings for each of the three pages. Local checks verified FAQ text parity, JSON graph references, IDs, link titles and targets, asset paths, heading order, email links and the absence of pure-black/pure-white definitions. The added hero text colors meet at least 4.5:1 contrast on their defined backgrounds; the magenta index uses `#E06CE3` on `#1E293B` (5.17:1).

Desktop/mobile visual review and live deployment remain outstanding. The runtime blocks Chrome's required sockets and the cloud browser cannot open this local preview. Check the published site at desktop and mobile widths, including header clearance, feature wrapping, footer layout, keyboard navigation and FAQ open/close behavior.

Upload the extracted full ZIP contents to the existing repository root, preserving `assets/`; or merge the update-only ZIP into the current files. Keep CNAME unchanged. GitHub Pages should continue using `main` / root. The ZIPs are prepared files, not a confirmation of a completed public deployment.

## Primary references checked

- [Schema.org FAQPage](https://schema.org/FAQPage)
- [Schema.org Question](https://schema.org/Question) and [Answer](https://schema.org/Answer)
- [Schema.org SoftwareApplication](https://schema.org/SoftwareApplication)
- [Schema.org Organization](https://schema.org/Organization), [WebSite](https://schema.org/WebSite) and [BreadcrumbList](https://schema.org/BreadcrumbList)
- [Official Schema.org validator](https://validator.schema.org/)
- [Google structured-data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google Search documentation updates: FAQ rich results retirement](https://developers.google.com/search/updates)
- [Tournify: Present](https://help.tournifyapp.com/en/articles/8954107-present)
- [Score7: Tournament embedding](https://www.score7.io/en/tournament-embedding)

Internal source documents: the supplied Product Vision & Commercial Strategy, Strategy Pitch Funding Brief, consolidated market intelligence and Documentation Standards. Unverified absolute competitor claims were not reused.
