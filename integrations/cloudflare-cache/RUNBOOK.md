---
project: TournStack
doc_type: Website delivery and browser security runbook
date: "2026-10-15"
date_basis: Preserved NamingAudit identity creation-date baseline
updated: "2026-10-20"
version: "1.1.0"
version_scope: Local security preparation and documentation; not a deployed release
status: Existing cache configuration deployed; security changes prepared locally only
language: en
timezone: Europe/Ljubljana
owner_role: Website and public assistant maintainer
---

# Website optimization: developer runbook

## Security preparation - 2026-10-20

The owner authorised local website security fixes, explicitly excluding deployment and public chatbot activation. The publish boundary, pinned CI actions and response-header additions described here are prepared source only. Existing live cache settings below retain their recorded deployment status. No Cloudflare rule, GitHub setting, website release, credential, consent, retention period or service plan was changed by this work.

### Public artifact boundary

The Pages workflow now calls `node scripts/public-artifact.cjs _site`. It requires a fresh output directory and selects only tracked regular files from an explicit public allowlist:

- Eight registered HTML pages plus `sitemap.xml`, `robots.txt`, `CNAME` and `.nojekyll`.
- Approved file types in the flat `assets/brand`, `images`, `fonts`, `css` and `js` directories, their correctly named historical content-hashed counterparts under `assets/versioned`, and `assets/fonts/OFL.txt`.
- Operational guides, integration/backend source, tests, scripts, configuration, credentials, dotfiles and the asset-manifest metadata are excluded. The manifest remains a source/build input.

The build rejects symlinks/non-regular public entries, absent required pages and local HTML/CSS resource references that would be missing from the artifact. A new public page/directory/type requires a deliberate allowlist edit and test. Existing stable logo, author portrait and email image URLs, font licensing and historical versioned assets remain available. The owner must still review anything committed inside public asset directories; the extension filter is not a secret detector.

CI continues to run the immutable-asset and consent/receiver checks, then checks the publication boundary and the prepared header policy. The five official GitHub Actions are pinned to full commit SHAs resolved from the existing v4/v5 major tags through `api.github.com/repos/actions/.../git/ref/tags/...` on 2026-10-20. Review upstream changes before updating pins. Job permissions, deployment branch/environment and scheduling are unchanged. A push can deploy under the existing workflow, so do not push these changes until a release is explicitly authorised.

### Effective headers for GitHub Pages behind Cloudflare

This site is hosted by GitHub Pages behind the Cloudflare proxy. A Cloudflare Pages `_headers` file would not configure this origin. `response-header-rules.json` contains two added **Response Header Transform Rules** for HTTPS on exactly `tournstack.com` and `www.tournstack.com`; no demo, indexer or workers.dev host is included. Preparing the JSON does not change live headers. Preserve existing rules and merge the two reviewed refs during a separately authorised configuration change; never replace the whole zone ruleset blindly.

The baseline rule proposes:

- Enforced CSP blocking object embeds, foreign base URLs, embedding this website in frames, and form destinations outside this website and Google Apps Script transport.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- A Permissions Policy disabling camera, microphone, geolocation, USB and payments. Clipboard access is not disabled because Niko has copy controls.
- Initial HSTS `max-age=86400`, deliberately without `includeSubDomains` or `preload`; the other subdomains were not reviewed for those commitments. A later extension needs its own review.

The second rule sets **Content-Security-Policy-Report-Only**, with reviewed first-party/provider origins and SHA-256 hashes for the existing inline executable bootstrap. It restricts script sources without `unsafe-inline`/`unsafe-eval`, allows existing styles, Google nested receipt frames, Turnstile and the future cross-origin Niko iframe. It has no reporting endpoint and adds no reporting data collection. Browsers can show violations locally. This strict policy is an observation candidate, not an enforced protection and not proof that every current/future vendor behavior is compatible. The separate enforced baseline remains active if these prepared rules are later applied.

Run `node integrations/cloudflare-cache/security-policy.cjs --check` before release. If reviewed inline executable code changes, inspect the change, run `--write` to regenerate local hashes/rules, and review the diff. JSON-LD is not executable and does not create a script permission. The generator preserves unrelated transform rules and makes no API calls. Avoid HTML/JavaScript rewriting or minification at the edge: CSP hashes describe the reviewed executable bytes after browser newline normalization.

**Strict enforcement gate:** after separately authorised header deployment, inspect real desktop/mobile browser violations with the actual hosted CookieYes (including regional endpoints), Plausible, granted/withdrawn Meta and LinkedIn scripts, real Turnstile, nested Apps Script contact/newsletter receipts and Niko iframe/download/copy flows. Any form submission or event delivery needs its own existing task authority. Review each required destination; never silence failures using broad `https:`/`*`/`unsafe-eval` allowances. Only after that evidence and owner release approval should the strict candidate replace the baseline `content-security-policy`; remove the redundant observation header at that point. Mocked-provider tests do not satisfy this gate.

For rollback, disable/remove only the added security refs or restore their previously recorded values, preserving cache rules. HSTS persists in a visitor's browser for its advertised lifetime; removing the header alone does not immediately clear it. A deliberate `max-age=0` response over HTTPS can retire it. Do not add subdomain/preload flags as a shortcut.

### Local verification and remaining boundary

```sh
node scripts/version-assets.cjs --check
node --test scripts/public-artifact.test.cjs integrations/cloudflare-cache/security-policy.test.cjs
node integrations/cloudflare-cache/security-policy.cjs --check
node scripts/public-artifact.cjs --check
node scripts/public-artifact.cjs <new-private-output-directory>
# Set TS_PLAYWRIGHT to an existing Playwright module if it is not installed here:
node integrations/cloudflare-cache/security-browser.cjs
```

The private test stage included the existing pending website/chatbot assets without changing the canonical Git index. Verification produced 97 public files, 39 current asset entries, eight passing deterministic checks and five Chrome scenarios at 1440/390 pixels. All browser HTTP(S) requests were intercepted: mocked consented providers, Turnstile, contact/newsletter responses through a nested Google frame, future Niko frame, and blocked hostile framing/offsite forms/unapproved inline script. No real forms, emails, advertising events or chatbot model calls were sent. These checks verify the policy mechanisms and intended integration shapes; real vendor and account configuration verification remains a separate release gate.

Form receipt handlers already require a Google HTTPS origin, matching unpredictable pending UUID, expected receipt type and boolean result. They remain unchanged: Apps Script returns receipts from a nested Google frame, so binding `event.source` to the direct transport iframe would reject valid receipts. The nested-frame fixture reproduces that distinction. A stronger source protocol would require paired transport/backend design and real Apps Script browser verification; no unsupported equality check was added.

References: [Cloudflare response-header transforms](https://developers.cloudflare.com/rules/transform/response-header-modification/), [Turnstile CSP requirements](https://developers.cloudflare.com/turnstile/reference/content-security-policy/), [GitHub secure use of Actions](https://docs.github.com/en/actions/reference/security/secure-use).


Updated 2026-10-15. This document owns the deployed website cache configuration and publishing procedure. It supersedes the preparation-only state described in historical release records. The owner applied Cloudflare settings manually; GitHub Actions publishes website source independently.

## Architecture and current settings

```text
Visitor -> Cloudflare DNS / TLS / cache / response headers -> GitHub Pages origin
Contact/newsletter UI -> separate Google Apps Script / mail Worker endpoints
Demo and indexer hostnames -> Firebase directly (DNS only)
```

| Component | Configuration |
|---|---|
| Source | github.com/mitjamitrusevski-hue/tournstack.webpage, main |
| Origin | GitHub Pages; CNAME tournstack.com; HTTPS enforced |
| Publishing gate | GitHub Pages Source = GitHub Actions; .github/workflows/pages.yml |
| Cloudflare | Free plan; mitja@tournstack.com account |
| Zone ID | 7b88540b5413ee032ca609eb75aa8bcf (identifier, not a secret) |
| Registrar | GoDaddy; registration was not transferred |
| Nameservers | aitana.ns.cloudflare.com, tim.ns.cloudflare.com |
| Proxied | Four apex A records and www CNAME |
| DNS-only | demo, indexer, _domainconnect; MX and TXT |
| TLS | Full (strict); Universal SSL Active; automatic renewal |
| Global cache | Standard; Browser Cache TTL Respect Existing Headers |
| AI policy | Bot Preference Sync off; source robots.txt retained |

The mail Worker is separate and does not proxy this website. No new Worker route or backend deployment was needed for CDN activation.

## What changed and why

The owner supplied a Lighthouse short-cache-lifetime report estimating 304 KiB repeat-visit savings. GitHub's origin headers gave first-party assets 10 minutes of freshness; a repository configuration file alone cannot change those headers. We implemented content-hashed assets and Cloudflare policies together. The report's estimate is not a measured achieved saving or proof of improved Core Web Vitals.

Related optimization records distinguish completed changes from investigations:

- Newsletter Privacy link: persistent underline and 3px offset added to `.newsletter-signup .newsletter-note a`. Scoped axe link/contrast checks passed at desktop/mobile widths. This is not complete WCAG certification.
- Render-blocking review: CookieYes and main CSS were investigated, not marked fixed. CookieYes remains synchronous in the head using the established vendor integration; CSS remains available for initial rendering. No unsupported async/defer conversion, critical-CSS rewrite or speculative preconnect was shipped.
- Third-party CookieYes/Plausible cache headers remain vendor-controlled.

## Asset editing and publishing

Edit canonical originals under `assets/brand`, `images`, `fonts`, `css` and `js`, then run:

```sh
node scripts/version-assets.cjs
node scripts/test-version-assets.cjs
node scripts/version-assets.cjs --check
```

Commit canonical edits, generated HTML, `assets/asset-manifest.json` and new `assets/versioned/` files together. Push main, wait for **Validate and deploy website** to succeed, then inspect served URLs/headers. Settings > Pages > Source must remain **GitHub Actions**, as verified by API after the owner's manual change. The initial settings API write returned 404; it did not change source mode.

The generator writes SHA-256-derived URLs and a manifest containing source, source hash, served-byte hash and size. Fonts/images are versioned before CSS; CSS dependency URLs are rewritten before CSS hashing. Text assets use canonical LF; `.gitattributes` preserves generated bytes on Windows/Linux. Tests cover stale references, dependency invalidation, unchanged URL stability, historical retention and tamper detection. The prepared workflow validates before publishing and uses the explicit public artifact boundary documented above; the previously deployed workflow excluded only desktop.ini/.github.

Never edit generated files or overwrite different bytes at an existing hashed URL. Retain older hashed assets because cached HTML/shared previews can still reference them. Corrected bytes require a new hash and updated references. Routine new hashed URLs do not require an edge purge. Original URLs remain available with short freshness, including the stable author portrait and PNG referenced by previously sent emails. Initial generation created 32 assets used by eight pages.

## Exact Cloudflare rules

These rules were deployed in the dashboard, not automatically by Pages. Adjacent JSON files are maintenance templates; do not blindly replace an existing ruleset. Preserve unrelated rules and inspect ordering/conflicts. Template refs are not verified remote rule IDs.

### Cache Rules, request phase, in order

**1. TournStack – bypass non-versioned pages**

```text
(http.host in {"tournstack.com" "www.tournstack.com"} and not starts_with(http.request.uri.path, "/assets/versioned/"))
```

Action **Bypass cache**; Browser TTL unset.

**2. TournStack – versioned assets**

```text
(http.host in {"tournstack.com" "www.tournstack.com"} and http.request.method in {"GET" "HEAD"} and starts_with(http.request.uri.path, "/assets/versioned/"))
```

Action **Eligible for cache**. Edge TTL: **Ignore cache-control header and use this TTL**, **1 month** (2592000 seconds in template). Status-code TTL: **Greater than or equal**, **300**, **No store**. Browser TTL and other optional settings unset. Rule placed last.

The dashboard named-code list stopped at 526, although the documentation example uses 599. The open-ended >=300 setting covers higher codes too; template JSON uses `from: 300` with no upper bound and `value: -1` for no-store.

### Response Header Transform Rules, in order

Select **Response Header**, not Request Header. The wrong phase rejects `http.response.code` and cannot implement the response policy. Use **Set static**, not Add static, to replace the origin header without duplicate values.

**1. TournStack – immutable asset headers**

```text
(http.host in {"tournstack.com" "www.tournstack.com"} and http.request.method in {"GET" "HEAD"} and starts_with(http.request.uri.path, "/assets/versioned/") and http.response.code eq 200)
```

Set static `Cache-Control` = `public, max-age=31536000, immutable`.

**2. TournStack – asset errors no store**

```text
(http.host in {"tournstack.com" "www.tournstack.com"} and starts_with(http.request.uri.path, "/assets/versioned/") and http.response.code ne 200)
```

Set static `Cache-Control` = `no-store`; placed last.

The second transform matches every non-200 response, including 206/304; the edge >=300 condition also includes 304. Follow-up on 2026-10-15 at 10:53:36Z tested a real versioned image: conditional ETag GET returned **304, no-store, HIT**, and `Range: bytes=0-99` returned **206, 100 bytes, no-store, HIT**. These conservative headers can reduce browser reuse for conditional/partial responses. No rule was changed in the messaging release; revisit status conditions only with a separate edge/browser regression check. Do not describe this rule as only 4xx/5xx handling.

Edge caching and browser freshness are separate because response-header transforms run after edge-cache decisions. An unconditional one-year Browser TTL override could retain a missing asset; status-scoped headers avoid that.

### Keep public contact addresses usable without JavaScript

Live verification of the messaging release found Cloudflare replacing public contact text/mailto links on FAQ, Contact, Privacy and Unsubscribe with email-protection URLs and injecting `email-decode.min.js`. This was an edge HTML transformation, not a stale Pages file. Those intentionally public addresses are now surrounded by Cloudflare's documented `<!--email_off-->` / `<!--/email_off-->` comments. Preserve the comments when editing fallback/contact copy. No zone setting was changed. Verify the served email text and mailto URLs with JavaScript disabled, and check that no decoder is injected. See [Cloudflare's address-specific exclusion](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/#prevent-cloudflare-from-obfuscating-email).

| Response / service | Policy |
|---|---|
| Versioned asset GET/HEAD, 200 | Edge one month; browser one year, immutable |
| Versioned missing asset, 404 | Edge no-store; response no-store |
| Ordinary HTML / original mutable URL | Edge bypass; origin browser freshness, observed max-age=600 |
| www homepage | Preserve 301 to https://tournstack.com/ |
| Google / mail Worker endpoints | Outside host/path policy; private caching remains separate |
| Demo / indexer | Firebase DNS-only; independent TLS/cache policy |
| Third-party scripts | Vendor-controlled caching |

## Migration sequence and troubleshooting

1. Backed up the owner's complete GoDaddy export; 18 service records matched public DNS: four A, four CNAME, four MX, six TXT. No DKIM/AAAA/CAA supplied; none invented. No parent DS answer observed before cutover.
2. Prepared a BIND import without GoDaddy SOA/authoritative NS, initially all A/CNAME DNS-only. Owner connected the domain to Cloudflare Free and imported all 18 records.
3. Configured Full (strict), Respect Existing Headers and the four rules while DNS-only. Assigned nameservers came from the actual new zone.
4. Owner changed delegation from ns11/ns12.domaincontrol.com to aitana/tim.ns.cloudflare.com. API reported zone Active at 2026-10-15T09:52:02.959Z.
5. Waited for Universal SSL Pending Validation (TXT) to become Active. Cloudflare validated automatically; no manual TXT, CSR, paid certificate or periodic manual renewal was needed. In a full setup certificate issuance follows domain activation, so delegation preceded certificate readiness while proxying stayed off. Screenshot expiry: 2027-01-13.
6. Owner proxied only apex/www after certificate activation. Future authoritative DNS edits belong in Cloudflare; GoDaddy remains registrar.
7. Verified Cloudflare responses and cache behavior below.

The orange onboarding warning prompted enabling the proxy; it was not an outage. Domain activation alone did not prove proxied traffic. The CSR permission popup referred to an advanced feature unrelated to Universal SSL. API links on dashboard panels are developer documentation, not required extra configuration.

Existing Wrangler OAuth has Zone Read but no DNS/cache/transform editing scopes. Refresh resolved an expired-token 403 without adding missing permissions. API automation needs a private, zone-scoped credential with appropriate DNS, Zone Settings, Cache Rules/Cache Settings and Transform Rules edits. Never put secrets in chat, Git, Drive handoffs or public Pages artifacts.

## Verification and limits

At 2026-10-15T10:03:50.928Z, source `82e0ed78071689e548f98a7a9fcbc36110482005`:

- All 32 versioned assets: 200, exact manifest SHA-256, one-year immutable header.
- Repeated asset: Cloudflare HIT, Age 7, establishing edge reuse.
- Deliberately missing versioned SVG: 404, no-store, BYPASS.
- Homepage: 200, max-age=600, DYNAMIC; www: 301 to canonical apex with valid TLS.
- Public demo/indexer CNAME targets and all four mailbox.org MX records preserved; TXT/DMARC queries recorded.
- Preparation checks: eight pages matched committed source after newline normalization and 16 local desktop/mobile layout comparisons passed.

The PC resolver temporarily cached GitHub addresses after activation. Checks used a freshly resolved Cloudflare edge IP with curl `--resolve`, retaining the correct hostname and TLS validation. Do not permanently hardcode that IP or infer failed activation from a cached origin response.

For routine checks use `curl -I` on the homepage, www, a real URL from the manifest (twice) and a missing versioned URL. Check CF-Ray/Server cloudflare, expected Cache-Control and repeat HIT/Age. For browser reuse keep DevTools Disable cache unchecked; edge HIT does not prove browser disk-cache reuse.

No real inquiries, emails, subscriber changes or conversion events were generated. DNS parity does not prove inbox delivery. Full resolver propagation, browser-cache reuse and a new comparable Lighthouse result were not established by the activation checks. The later conditional/range sample is recorded above. Normal resolver requests at 10:53:36Z reached Cloudflare: CSS/JS/image samples had one-year immutable headers and repeat HIT/Age; HTML and original mutable JS retained max-age=600/DYNAMIC; missing versioned JS returned 404/no-store/BYPASS. Run comparable device/network/consent conditions before claiming measured savings.

## Rollback and future changes

- Rule issue: disable/correct the affected owned rule, preserve unrelated rules, verify again.
- CDN bypass: set all four apex A and www CNAME DNS-only; GitHub origin/HTTPS must remain available. Resolver caches delay effect.
- Bad immutable bytes: publish a new hashed URL and update HTML; an edge purge cannot recall browser copies.
- Delegation rollback: first restore/reconcile the complete current zone at the old provider, then restore old nameservers. Original export is historical and may omit later changes; rollback is not immediate.
- Bot Fight Mode, Under Attack Mode, HSTS preload, Rocket Loader, new Worker routes and automatic script optimization were not introduced. Minimum TLS/DNSSEC hardening can be considered separately and should not be labelled enabled without verification. Test visitor/forms/crawlers when changing security controls; AI discovery preferences are separate from abuse controls.

## History and evidence locations

Project-relative `Marketing/WebPublishing/Operations/`:

- `DNS/`: original GoDaddy export, prepared import, DNS comparison JSON, activation report and proxy verification JSON (all prefixed `2026-10-15_TournStack_`).
- `Releases/2026-10-15_TournStack_Cloudflare-Cache-Preparation_Implementation-and-Verification.md`: historical preparation/deployment evidence.
- `Releases/2026-10-15_TournStack_Website_Privacy-Link-Accessibility_Implementation-and-Verification.md`: underline fix and scoped tests.
- `Audits/2026-10-15_TournStack_Render-Blocking_CookieYes-and-CSS_Review.md`: investigated finding, not fixed.

Preparation source commits: `fe3777254ec14381e186215a7cb4fd574613a22b`, `82e0ed78071689e548f98a7a9fcbc36110482005`. Immutable exact-commit archives live in `Marketing/WebPublishing/Website/WebsiteArchives/`. Shared policy: `Marketing/Guides/2026-10-03_TournStack_Marketing_Web-Performance-Accessibility-and-Motion.md`. This runbook owns technical configuration; shared guides own general standards.

References: [Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/), [DNS import](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/), [Cache settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/), [Status TTL / 304](https://developers.cloudflare.com/cache/how-to/configure-cache-status-code/), [Response transforms](https://developers.cloudflare.com/rules/transform/response-header-modification/), [Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/enable-universal-ssl/), [GitHub workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
