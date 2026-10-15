# Advertising integration and activation gates

Updated 2026-10-15. **Current source enables Meta and normal LinkedIn behind renewed v2 consent.** The preceding `2d2aa71` release was Meta-only; its renewal, processed browser PageViews and withdrawal check are owner-confirmed complete. The matching CookieYes wording and four LinkedIn entries were published by the owner. Deployment, v2 renewal and Campaign Manager receipt status belong in Operations/Releases/2026-10-15_TournStack_LinkedIn-Activation.md. No campaigns, spend, audience uploads, lead conversions, CAPI, GTM or GA4 are included.

## LinkedIn lifecycle and verification

Owner reconfirmed partner **11117593** and accepted the normal tag plus a warned reload on withdrawal. This supersedes the earlier form-page refusal and unselected image-only proposal. Full SDK tests (Chrome 1440/390, real hosted CMP, actual captured libraries with collectors blocked) passed: default denial, genuine grant, one SDK, decoded automatic PAGE_VISIT/CLICK payloads, unsent-text warning cancel/continue, withdrawal reload, regrant, and another-tab withdrawal. No synthetic address/hash or matching value appeared in inspected payloads. The tag can automatically capture button/form activity; do not describe it as PageView-only or infer a disabled feature from an empty Website Actions list.

On withdrawal, a document-only CSP stops new network egress during retirement, except CookieYes logging; it disappears on reload. Meta is revoked, accessible known ad cookies are removed and the local marker is deleted. The code does not use undocumented LinkedIn teardown commands or patch browser networking APIs. A blocked Meta SDK only revokes Meta, avoiding a reload loop. On ordinary preferences opening with unsent text, cancel leaves text and choice intact. After an accepted warning, withdrawal reloads. An unwarned cross-tab withdrawal leaves text in the DOM to copy while the retired page's networking is stopped; an explicit reload restores the page with advertising off. No form values are saved to new storage. Do not send forms from a retired page.

The single separately authorised live visit at 15:45:09–15:45:20 UTC reached partner 11117593 and received a 204 Website Actions response. Observed `.linkedin.com` cookies: `bcookie` ~365 days, `li_gc` ~180 days, `lidc` ~1 day, `__cf_bm` ~30 minutes. Server cookies differ from first-party app cookies and cannot be deleted by this website. This did not verify Campaign Manager receipt or all browser/account states. Public collector response redirects were not fully recorded by the first harness; report only observed responses/cookies, not a complete redirect trace. No extra live visit has been run.

Published owner fields and coordinated activation sequence: [CookieYes setup](../CONSENT_SETUP.md). New notice **advertising-2026-10-15-v2** replaces v1; an earlier Meta-only choice is rejected. Perform the documented renewal after deployment.

Current checks: **43** isolated advertising contracts plus **29** receiver gate tests; intercepted existing-form/browser regression PASS. Run `node integrations/advertising/linkedin-browser.cjs` with `TS_PLAYWRIGHT` and `TS_ADVERTISING_FIXTURES` pointing to the privately captured SDKs. This test permits public CookieYes CDN GETs only; all ad collectors, consent logs and backend submissions are intercepted. Fixture files: `linkedin-current-sdk.js`, `alignment-meta-fbevents.js`, `alignment-meta-config.js`. Raw SDKs are not committed. LinkedIn SHA256: `6969c6e5ca8f76fcdcaf88c0d7f5139aceccc8bd5c6b0b30f145c8c817254c8a`. Set `TS_CMP_TEST_WIDTH=390` for mobile. Exact evidence and legal sources are in Operations/Audits/2026-10-15_LinkedIn_Normal-Tag_Verification.md.

The sections below preserve the Meta release and earlier preparation history; the current status above supersedes their pending/limitation statements.

## Single owner and switches

`assets/js/advertising.js` is the sole loading path, referenced through generated immutable URLs on six public HTML pages. Contact/privacy execute cleanup but fail the advertising route gate. Receipt/unsubscribe pages do not include this script. No advertising noscript image or preconnect is installed.

| Configuration | Value |
|---|---|
| Meta Pixel | `1637153127858631` |
| LinkedIn partner | `11117593` |
| Notice version | `advertising-2026-10-15-v2` |
| `noticePublished` / `metaEnabled` / `linkedInEnabled` | **true / true / true** |

The policy and CookieYes wording describe optional Meta and LinkedIn measurement, LinkedIn automatic Website Actions and additional provider uses. Current consent plus the v2 marker is mandatory. LinkedIn has a single loading owner, despite the CookieYes blocking rule for snap.licdn.com. Regenerate versioned assets after a source flag change. Roll back either tag by setting its enabled switch false and redeploying; preserve backend protections and consent records.

## Eligible contexts and data boundaries

Only HTTPS apex and `www.tournstack.com` may qualify. Candidate paths are `/`, `/index.html`, `/vision.html`, `/faq.html`, `/author-mitja-mitrusevski.html`. All other paths and hosts are excluded, including contact, privacy, receipts, unsubscribe, confirmation, demo, indexer, apps, Portals and backend origins.

All query strings currently suppress advertising, including UTMs. Incoming links and attribution remain unchanged. A future campaign allowlist must register understood non-personal values; arbitrary UTM text is not assumed safe. Fragments must identify an existing element. Same-host referrers must be eligible, query-free and fragment-free. External referrers must contain only an HTTPS origin and `/`. Missing referrers are accepted. DNT `1` and GPC `true` suppress advertising.

The module checks unsent text locally for the reload warning; it never stores or transmits it. No email hashes, receipt IDs or newsletter state are supplied to advertising vendors. Actual SDK payload inspection remains necessary after vendor/account changes.

## Consent contract

Use hosted CookieYes `getCkyConsent()`: completed action, nonempty consent ID, and `categories.advertisement === true`. Also require `tournstack-advertising-choice` in localStorage with matching consent ID/current notice version and a valid expiry, maximum 180 days. This is a project limit, not a vendor lifetime. With `noticePublished:false`, no new marker is written and no vendor is loaded.

The marker requires a trusted accept/save click followed promptly by a valid CMP update. Initial updates, old consent and programmatic clicks cannot renew it. Use supported CookieYes renewal when the new notice is published; the marker supplements that process. Real save-button/event timing passed at 1440/390 px with the published CMP, as recorded below. The owner located Renew now under Advanced Settings → Consent settings on Free. Earlier Meta-only renewal is complete; repeat renewal for v2 after deployment.

Listen for `cookieyes_banner_load`, `cookieyes_banner_loaded` and `cookieyes_consent_update`, plus an immediate state read for returning visitors. Actual hosted inspection observed an initial update before any user action. Missing/malformed/unreadable state fails closed; denial removes the marker. Storage/pageshow/hash/visibility events recheck the gate.

## Meta lifecycle

After the gates pass, load `https://connect.facebook.net/en_US/fbevents.js` once. Recheck consent on completion. Queue revoke before initialization; then grant, set `autoConfig` false, initialize the one ID without user data, and send one `trackSingle` PageView. Repeat updates do not add views. Regrant allows one current view, without replaying denied-period activity or adding another loader. Another existing Pixel owner prevents initialization.

Withdrawal closes the local event gate synchronously, calls `fbq('consent','revoke')`, and expires accessible `_fbp`, `_fbc` and `li_fat_id` cookies at applicable host/domain/path variants. Unrelated cookies are preserved. Clearing cookies does not recall sent data. Bounded actual-SDK and published-CMP withdrawal/regrant checks passed; see their scope below.

### Owner screenshot evidence, 2026-10-15

| Setting | Observed | Action |
|---|---|---|
| Automatic website matching | Off | Keep Off |
| Automatic events | Off | Keep Off |
| Track events automatically without code | Off | Keep Off |
| Automatically include more detailed page and product info | **Off — confirmed by subsequent owner screenshot** | Keep Off |
| First-party cookies | On | Isolated consented inspection observed `_fbp`, approximately 90 days; withdrawal removed it |
| Conversions API | Connection pending | No connection or token setup in scope |

Screenshots identify dataset 1637153127858631. They verify account controls only, not consent, withdrawal or actual transmitted data.

## LinkedIn bootstrap and account

Base library: `https://snap.licdn.com/li.lms-analytics/insight.min.js`. One partner array and standard `lintrk` queue load the normal library after the common consent gate. Website Actions can automatically collect page/button/form activity; the library also contains dwell behavior. No enhanced matching, email hashes, `setUserData` or conversion ID is added. There is no assumed general revoke API: withdrawal uses the tested document retirement/reload behavior above. Newsletter forms remain available.

Owner screenshots show selected company ad account **TournStack Ad Manger**, ID **560071493**, Company TournStack, and its actual partner ID **11117593**. This supersedes the brief's supplied **11116129**, whose account association was not verified. The code and test expectation were corrected before activation. Tracking settings remain unconfirmed. Current navigation: Measure → Signals manager → Insight Tag; the installation section's “I will use a tag manager” option reveals the partner ID without requiring a tag manager.

### LinkedIn settings screenshot, 2026-10-15

Manage Insight Tag → Settings initially showed **Enable enhanced conversion tracking checked**. The visible description identifies first-party cookies and Click IDs added to ad URLs. After the instruction to uncheck and Save, the owner reported “done” and supplied an unchecked screenshot: **Off, owner-confirmed** (no independent dashboard readback). No separate enhanced matching or Website Actions control appears in this panel. Do not treat this switch as evidence that Website Actions is disabled. The owner requested completing Meta and LinkedIn settings before proceeding to CookieYes.

The official Understanding Website Actions guide checked on 2026-10-15 describes automatic page visits, button clicks and form submissions, and gives Data → Website actions as navigation. A subsequent owner screenshot confirms this account uses **Measure → Website actions**. With **All website actions** selected, account 560071493 shows **No website actions found** and no visible collection-disable control. The Website actions in use tab was not inspected. An empty activity list does not establish disabled collection, and no global opt-out has been verified. Dashboard inspection is complete for the controls shown; actual collection and withdrawal remain implementation activation gates. No action, conversion or audience was created.

## Historical activation checklist (see current lifecycle above)

1. Meta's requested automatic-collection switches are confirmed Off in owner screenshots; LinkedIn enhanced conversion tracking is Off per owner confirmation and screenshot. Website Actions shows no recorded actions and no visible disable control; resolve actual automatic collection before LinkedIn activation. Verify absence of duplicate installation through a CMP/tag manager.
2. The owner confirmed **Mitja Mitruševski personally, operating from Slovenia**, with no registered company yet. Supplied Meta terms and Privacy Policy transfer panels establish the EU entity, purpose-specific roles, joint-controller allocation, maximum Event Data retention and provider-stated transfer mechanisms. Keep their scope qualifications in the notice. LinkedIn-specific review was subsequently completed in the normal-tag audit. Do not call every service a processor.
3. Finalise public purposes, recipient links, actual automatic collection, retention distinctions and rights/withdrawal text. No placeholders or unsupported no-form-data assurances.
4. Necessary and `_fbp` inventory are published and the Free plan's renewal control is located. Finalise CookieYes wording, keep advertising initially off, preserve reject/preferences/revisit, then publish and renew in coordination with the new notice; no trial/upgrade.
5. Intercept actual SDK traffic with synthetic form values, preventing production-account events. Verify URLs/referrers, automatic collection, withdrawal/regrant, cookies and no-JS. Record observed inventory instead of copying a vendor's full cookie table.
6. Obtain explicit approval for a small owner live test, then record actual platform receipt separately. Regenerate assets, review, publish and verify the exact release only when ready.

The zero-cookie scan dated 4 October is not a current tracking audit. Vendor cookie expiry, vendor event retention, CMP consent-log retention and website record retention are separate facts.

## Tests and limits

```sh
node --test integrations/advertising/consent.test.cjs
node integrations/advertising/browser-regression.cjs
```

Browser tests require Playwright and Chrome; `TS_PLAYWRIGHT` can point to an existing module. Every request is intercepted; repository files are served at a synthetic production origin, and CMP/vendor/Turnstile/receiver behavior is mocked. No real events, mail or submissions run.

2026-10-15: **37 VM tests passed**. Chrome at 1440/390 px passed denial/grant/withdraw/regrant, single mock Meta loader, preserved typed newsletter input, no form values in loader arguments, LinkedIn refusal, excluded contexts and no-JS. The browser suite also verifies saved-contact success despite throwing analytics/blocked storage, one-use receipts, rejected receipt IDs/origins and preserved input on server error.

### Isolated actual Meta library inspection — 2026-10-15

Private helper `alignment-meta-sdk.cjs` served the local repository at an intercepted HTTPS origin, enabled only Meta/current-notice flags in memory, and supplied a synthetic CMP choice and synthetic newsletter address. Only the public SDK and pixel configuration GETs reached Meta. All collector endpoints and other external requests were blocked; production files, flags and accounts were not changed.

Latest evidence `alignment-meta-sdk.json`, 11:35:19–11:35:32 UTC: actual fbevents.js 433365 bytes, SHA-256 `9e4b581a7483e88873ad835a840ffaaff1c85b3be28951e12e8207a318e7776b`; configuration 335295 bytes, SHA-256 `250ed2af189eef2c7afd6bc6ab9396f9927f09c675db9bbef858a8c78e1d3872`.

- No vendor library/cookie before simulated consent. After consent, `_fbp` was observed on `.tournstack.com`, path `/`, approximately 90 days, SameSite Lax, Secure false as set by the vendor. No `_fbc` was observed on the clean URL tested.
- Withdrawal removed `_fbp`; regrant recreated it. Typed newsletter input survived both. This is actual-library cookie behavior with a mock CMP, not end-to-end hosted CMP verification.
- No collector request was observed, although the SDK's own event count incremented. **PageView delivery/payload remains unresolved**, so do not mark activation ready or conclude that automatic collection is absent. The library's reported user-data maps were empty in this bounded case.
- A deliberate test-only direct PageView call during revoked consent was queued by the SDK, then counted upon regrant. The site's module does not make that call while denied. This demonstrates why revocation alone is insufficient to promise no replay if any automatic/other producer remains active; verify those producers and payloads before enabling.

The observed `_fbp` inventory was saved and subsequently **published by the owner and verified in the hosted CMP**: Advertisement, domain `.tournstack.com`, duration 3 months (approximately 90 days), script pattern `connect.facebook.net`. The initial missing-pattern warning was corrected and is absent in the final screenshot. It is not currently set by the disabled production integration. Do not invent `_fbc` or LinkedIn cookie observations. No events reached the production dataset during this inspection.

#### Standard-user-agent follow-up

The captured configuration contains a BotBlocking plugin. Repeating the test with a standard Chrome user-agent string, using **the same captured library/config bytes served entirely offline**, resolved the missing-request observation. This is evidence that the automated user-agent affected the earlier test; it is not a production change or a request to disable bot protection.

`alignment-meta-sdk-standard-ua.json`, 11:43:19–11:43:35 UTC: one intercepted GET PageView to `www.facebook.com/tr/` after grant, none before consent or during withdrawal, and one current PageView after regrant. Repeated CMP updates, visibility updates, and synthetic form submission while granted did not add events. A synthetic form submission while denied did not queue an event for regrant. SDK queue stayed empty; no `ud[...]` keys or plaintext synthetic email appeared in the captured requests, and reported user-data maps remained empty. Newsletter input was preserved; `_fbp` was cleared/recreated across withdrawal/regrant. No JavaScript exceptions occurred. All collector requests were aborted; **no event was delivered to Meta**.

Observed payload key families include page URL/referrer, browser/screen characteristics, timestamp, `_fbp`, timezone, library/experiment metadata and performance-related fields. These checks cover the clean homepage and tested interactions only, with a mock CMP and captured SDK configuration. Do not generalise to other routes, click-ID links, real CookieYes auto-blocking, third-party response cookies or every future vendor release.

#### Actual published CookieYes integration

After owner publication of the `_fbp` entry/provider pattern, private `alignment-cmp-meta.cjs` fetched the actual unmodified CookieYes bootstrap, banner and JSON configuration. The local website flags alone were enabled in memory; Meta library/configuration came from the recorded bytes. All vendor collector and CMP log endpoints were blocked. No consent IDs/cookie values were retained.

At 1440 px (11:58:01–11:58:16 UTC) and 390 px (11:58:49–11:59:04 UTC), the generated Advertisement switch began Off. Keyboard selection and the real Save My Preferences button created the new-notice marker and produced exactly one intercepted PageView. Reject All through the real revisit control removed `_fbp` and the marker with no extra event; Accept All through revisit produced exactly one new PageView with no duplicate library load. Typed newsletter input remained intact; no synthetic email or user-data request keys were captured. Both runs PASS, evidence `alignment-cmp-meta-1440.json` / `alignment-cmp-meta-390.json`. This verifies the Save button class/event timing and current CookieYes provider-blocking compatibility. Production flags remain false; the displayed inactive-advertising notice remains accurate.

#### Actual SDK route and performance checks

Private `alignment-meta-boundaries.cjs` passed 29 offline cases with the same captured Meta library/configuration and a synthetic returning CMP choice. Four eligible pages were compared at 1440/390 px with advertising denied/granted. Each granted page produced one intercepted PageView for `1637153127858631`; denial produced no library or event. Contact, privacy, receipt, unsubscribe, arbitrary fragment, email query, UTM query, click-ID query and disallowed referrers produced no advertising requests. Permitted public same-site and HTTPS origin-only external referrers were tested. No synthetic private value or user-data key appeared in captured events; no JavaScript exceptions occurred.

The bounded unthrottled comparison observed 768,660 additional uncompressed SDK/config bytes on grant. Script execution was 65–75 ms granted versus 2–4 ms denied across the eight page/width pairs. CLS was zero; LCP ranged 88–128 ms granted and 96–268 ms denied. Cold-cache/order noise prevents inferring an LCP improvement. A 51 ms long task occurred in two granted cases and a 55 ms task in one denied case. These offline figures demonstrate real code cost, not transferred network bytes, mobile CPU performance or field Core Web Vitals. Actual hosted CMP behavior was tested separately above.

**REMAINING:** LinkedIn runtime/cookies and withdrawal, final disclosures/renewal and platform receipt. The bounded Meta route/payload/performance and hosted-CMP withdrawal tests passed; they do not certify every future vendor behavior or legal compliance.

## Legal evidence and maintenance

### Owner-supplied Meta legal evidence, 2026-10-15

The owner supplied the text of Meta Business Tools Terms, effective 3 November 2025, and the Controller Addendum, effective 25 April 2023, from the requested signed-in pages. Direct automated retrieval of those pages and the Privacy Policy redirected to blocked login pages; this evidence is attributed to the supplied text, not an independent account-contract audit.

- Business Tools Terms section 4 states a maximum of two years for Event Data. Audience retention is separate and may continue until deletion; no audience has been created by this work. Neither period is the `_fbp` cookie's observed 90-day expiry.
- For GDPR processing, the named entity is Meta Platforms Ireland Limited. Roles differ by purpose: processor for instructed matching/measurement/analytics; joint controller for specified collection/transmission; independent controller for subsequent processing outside that joint operation.
- The Controller Addendum allocates the website's transparency duties to the operator and rights handling for data stored by Meta to Meta Ireland. Requests about joint processing received by the operator must be forwarded promptly, within seven calendar days. It does not authorise the operator to answer on Meta's behalf.
- Meta may correlate Event Data with its users and use it for ads, personalised features/content, security, research and product improvement. Disabling advanced matching does not prevent all provider-side account correlation. Future notices must explain these uses; do not describe all processing as anonymous or solely our measurement.
- The supplied documents list different historical street addresses for the same EU entity. Public copy should use its verified legal name and link to the current provider notice rather than inventing a reconciled address.
- The owner subsequently supplied the Privacy Policy's transfer section and the expanded “Mechanisms we use for global data transfers” text and screenshot. It states that Meta Ireland data may be processed globally, including the US, and describes adequacy decisions where applicable, EU–US/Swiss–US DPF reliance for covered transfers to certified Meta Platforms, Inc., and SCCs or applicable derogations in other circumstances. The notice attributes those mechanisms to Meta and preserves their destination/service qualifications; it does not claim this operator signed separate SCCs, universal DPF coverage or EU-only processing.

Sources: [Business Tools Terms](https://www.facebook.com/legal/terms/businesstools), [Controller Addendum](https://www.facebook.com/legal/controller_addendum), and the international-transfer panels of [Meta Privacy Policy](https://www.facebook.com/privacy/policy/), supplied by the owner in this conversation. A current automated DPF registry read returned a JavaScript shell, not independently verified certification details. Meta's [September 2023 statement](https://about.fb.com/news/2023/05/our-response-to-the-decision-on-facebooks-eu-us-data-transfers/) identifies Business Tools among its DPF uses; this is historical corroboration, not a current registry audit. No further owner legal screenshot is required for the qualified policy wording now drafted.

### Meta activation — published CMP wording verified

The owner published the final Cookie Notice, Preference Centre overview and Advertisement category description. Public readback on 2026-10-15 at 13:47:31Z verified all three texts and Advertisement off by default. This release publishes the matching privacy notice and enables only Meta, using notice version `advertising-2026-10-15-v1`. Supported renewal follows the verified website deployment. Existing consent alone remains insufficient. Platform receipt is not established by intercepted tests.

The marker now removes expired entries on the next check, including excluded pages; the 180-day validity is not a claim that localStorage deletes itself while the browser is closed. Consent unit suite: 40 PASS, including the added expiry cleanup check. No advertising event was delivered during preparation.

### Rollback procedure

Disable the vendor switch, or `noticePublished` for both. Run `node scripts/version-assets.cjs` and `node scripts/version-assets.cjs --check`; publish new HTML/hash references. Never overwrite immutable assets. New loads receive the changed gate after HTML refresh; open pages and browser-cached HTML do not instantly change. Test withdrawal separately.

Frontend baseline: `9edce09136f573498c5a5204bee1e6eb2c81b259`. Preserve the analytics-failure and invitation-storage fixes when reverting copy selectively. Worker `341afb3f-3949-41e1-b423-156bdb0c4e81` and Apps Script v7 are unchanged. Never restore unprotected receivers or retired unsubscribe/delete-row behavior as a frontend rollback.

## References checked 2026-10-15

- [Hosted prior consent](https://www.cookieyes.com/documentation/implement-prior-consent-using-cookieyes/), [getCkyConsent](https://www.cookieyes.com/documentation/retrieving-consent-data-using-api-getckyconsent/), [renewal](https://www.cookieyes.com/documentation/renew-user-consent/).
- [CookieYes Meta SDK reference](https://developers.cookieyes.com/docs/core/integrations/meta-pixel); reference only, no CMP migration.
- [LinkedIn tag management](https://www.linkedin.com/help/lms/answer/a412986), [Website Actions](https://www.linkedin.com/help/lms/answer/a1377941), [enhanced matching](https://www.linkedin.com/help/lms/answer/a6241147), [Independent Controller Addendum](https://www.linkedin.com/legal/l/linkedin-independent-controller-addendum), [cookie table](https://www.linkedin.com/legal/l/cookie-table).
- Meta developer consent/matching pages were not fully retrievable during preparation. Owner screenshots provide account evidence; subsequent actual SDK and hosted-CMP checks above establish the tested runtime behavior and its limits.

Related: [consent setup](../CONSENT_SETUP.md), [analytics](analytics.md), [cache/deployment](cloudflare-cache/RUNBOOK.md).
