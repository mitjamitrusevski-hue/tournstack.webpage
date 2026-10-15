# Website consent setup

## Current state — 2026-10-15

### Meta and LinkedIn release: published configuration and renewal

The owner published the three texts and four LinkedIn entries below. Readback on 2026-10-15 verified the text, lifetimes, `.linkedin.com` domains, `snap.licdn.com` Advertisement rule, default denial and no vendor loading before choice. Source uses partner `11117593` and notice `advertising-2026-10-15-v2` with both tags enabled behind consent. An earlier Meta-only v1 marker cannot enable the expanded scope. Publish the HTML policy and loader together; exact deployment/renewal status is kept in Operations/Releases/2026-10-15_TournStack_LinkedIn-Activation.md. The owner accepted the unsent-text warning and withdrawal reload.

Meta's earlier renewal, processed browser PageViews and withdrawal/no-new-events check are owner-confirmed complete; historical pending statements below are superseded.

#### Cookie Notice

> We use necessary storage to remember your choices and cookie-free analytics to understand site use. With your permission, Meta Pixel and LinkedIn Insight Tag measure visits, interactions and advertising performance. These providers may also use visit data for their own advertising and product purposes. You can accept, reject or customise optional cookies and change your choice at any time.

#### Preference Centre: Privacy overview

> Necessary storage remembers your privacy choices. Advertisement controls Meta Pixel and LinkedIn Insight Tag and is off until you choose it. LinkedIn also records page visits and button/form activity. Plausible provides separate cookie-free analytics. You can reject advertising or change your choice through Cookie settings. Turning advertising off may reload the page; finish or copy unsent text first. Read our Privacy Policy for details.

Make “Privacy Policy” a clickable link to `https://tournstack.com/privacy.html`. Keep the banner's policy URL field set to the same address; the display label alone is not the destination.

#### Cookie Manager: Advertisement description

> If you allow this category, Meta Pixel and LinkedIn Insight Tag send technical visit information to their providers to measure advertising. LinkedIn also automatically records visits and button/form activity, including public page titles and button labels. The providers may connect visit information with information they already hold and use it for their own advertising and product purposes. We do not send form-field email addresses, inquiry text or newsletter records to these tools. You can turn this category off at any time through Cookie settings.

#### Cookie Manager: four additional Advertisement entries

For all four: **domain `.linkedin.com`**, **Script URL Pattern `snap.licdn.com`**. Keep `_fbp` and its `connect.facebook.net` rule unchanged. Keep “Load cookies prior to consent” Off. These are cookies of the optional LinkedIn service, including its own security/preferences; do not move them into this site's always-active Necessary category.

| Cookie ID | Duration | Description |
|---|---|---|
| `bcookie` | 1 year | Used by LinkedIn to recognise browsers for diagnostics and abuse prevention when its optional Insight Tag loads. |
| `li_gc` | 180 days | Stores LinkedIn guest cookie preferences when its optional Insight Tag loads. This is separate from your TournStack consent choice. |
| `lidc` | 1 day | Helps LinkedIn select a data centre when its optional Insight Tag loads. |
| `__cf_bm` | 30 minutes | Cloudflare bot detection used by LinkedIn's service when its optional Insight Tag loads. |

Observed in the single owner-authorised isolated live visit on 2026-10-15, 15:45:09–15:45:20 UTC. No form text or actions, emails, conversions or campaigns. Cookie names/domains/expiry were recorded, values excluded. No LinkedIn first-party cookie or additional local-storage item was observed in that context; do not invent inventory from a generic list. This is a bounded observation, not an exhaustive inventory for every signed-in/browser state. Purposes cross-checked against [LinkedIn's cookie table](https://www.linkedin.com/legal/l/cookie-table).

#### Coordinated activation sequence

1. Owner saves/publishes the three texts and four cookie entries above. Existing Free plan, GDPR/Worldwide, equal reject/preferences, off defaults and revisit stay in place. **Leave CookieYes's generic reload-on-consent-action setting Off**: the website handles only the necessary LinkedIn withdrawal reload.
2. Read the public CMP configuration back. Test it with both tags and actual libraries, all collectors blocked; confirm the new LinkedIn script pattern does not cause a second loader or prevent a consented load.
3. Enable `linkedInEnabled` for notice v2, regenerate immutable assets, run gates, commit/push/deploy the matching HTML and policy. Verify served source and archive according to the release procedure.
4. After deployment verification, owner uses Advanced Settings → Consent settings → Renew user consents → Renew now. The v2 marker already rejects old v1 consent; renewal makes the fresh choice visible to returning visitors.
5. Owner checks Campaign Manager receipt. A successful HTTP response alone does not establish reporting status. No automatic conversion suggestions or audiences are approved.

### Historical Meta release: wording and privacy links verified; renewal subsequently completed

The owner published all three final dashboard texts below. Public readback on 2026-10-15 at 13:47:31Z verified the banner, preference overview and Advertisement description; Advertisement was off and no vendor loaded. The matching website release enables only Meta behind a new-notice consent marker and publishes the full privacy notice. LinkedIn remains disabled. Both clickable privacy links were verified at 14:04:08Z. The following fields record the published configuration:

1. **Cookie Banner → Content → Cookie Notice:** replace the body with the final banner text below. Keep the privacy link to `https://tournstack.com/privacy.html`.
2. **Cookie Banner → Content → Preference Centre → Privacy overview:** use the overview below. Publish the banner changes.
3. **Cookie Manager → Advertisement → pencil → Description:** use the final category text below, Save draft and Publish changes. Leave Load cookies prior to consent Off and Hide category from banner Off.

**After the website deployment is verified:** Advanced Settings → Consent settings → Renew user consents → Renew now. Renewal has not yet been confirmed. Old consent alone does not satisfy the website marker gate. A separate bounded owner-authorised live check is still needed to establish receipt in Meta.

Final Cookie Notice body:

> We use necessary storage to remember your choices and cookie-free analytics to understand site use. With your permission, we use Meta Pixel to measure our advertising. Meta may also use visit data to personalise ads and improve its products. You can accept, reject or customise optional cookies and change your choice at any time.

Final Preference Centre privacy overview:

> Necessary storage remembers your privacy choices. The Advertisement category controls Meta Pixel; it is optional and off until you choose it. Plausible provides separate cookie-free analytics. You can reject optional advertising or change your choice at any time through Cookie settings. Read our Privacy Policy for details.

Link “Privacy Policy” in both fields to `https://tournstack.com/privacy.html`, or retain a clear clickable URL.

Final Advertisement category description:

> If you allow this category, Meta Pixel sends technical visit information to Meta to help us measure advertising. Meta may connect it with information it already holds and use it for personalised ads, content and product improvement. We do not send newsletter email addresses or inquiry text to Meta. You can turn this category off at any time through Cookie settings.

The previously published `_fbp` entry remains Advertisement / `.tournstack.com` / 3 months / `connect.facebook.net`. Do not add unobserved `_fbc` or LinkedIn cookies. The Necessary entry is unchanged. This sequence completes the notice; it does not create conversions, audiences or campaigns.

### Published baseline and earlier verification

**Current inventory:** Necessary `cookieyes-consent` and Advertisement `_fbp` are published. `_fbp` uses `.tournstack.com`, 3 months and `connect.facebook.net`. Advertisement is initially Off. Actual hosted CMP and captured Meta library checks cover grant, withdrawal and regrant with collectors blocked. Final wording above supersedes the earlier inactive-advertising text. See [evidence and remaining gates](integrations/advertising.md).

The sections below retain the sequence of owner screenshots and verification; references to drafts, missing toggles or pending save-button checks describe those earlier stages.

Historical preparation baseline: hosted CookieYes was installed while advertising code was prepared but disabled. The [advertising runbook](integrations/advertising.md) owns IDs, routes, consent/withdrawal contracts, tests and activation gates. All three switches were false at that stage; the current release enables only Meta.

Owner screenshots confirm Free, GDPR, Worldwide, active banner, 201/5,000 pageviews, and an Advertisement category alongside Necessary/Functional/Analytics/Performance. Each category shows zero scanned cookies; the scan is dated 2026-10-04 and does not establish current behavior.

Public browser inspection on 2026-10-15 confirmed `getCkyConsent()` and hosted CMP events. Initially action was incomplete and advertisement false. Reject all recorded completed action with advertisement false. `cookieyes-consent` was Secure, SameSite Strict, path `/`, domain `tournstack.com`, with approximately one-year expiry. Account consent-log retention is a separate, unverified fact. Consent IDs were redacted from inspection output.

Observed published banner:

> Your privacy choices
>
> We use a necessary cookie to remember your choice. Our analytics do not use cookies, and advertising tags are not active. You can change your choice anytime through Cookie settings. https://tournstack.com/privacy.html

Preferences, Reject All and Accept All are present. Public footer revisit buttons use `cky-banner-element`. Advanced Settings screenshots confirm banner display enabled, consent log on, subdomain sharing off, Google pre-consent firing off and debug off. Google consent-mode support, Microsoft UET support and Clarity consent integration are on; these compatibility settings do not prove those tracking libraries are installed. This release adds none of them.

### Banner editor evidence — 2026-10-15

Owner screenshots of Cookie Banner confirm the GDPR template, Worldwide selection, and the existing inactive-advertising notice with Preferences, Reject All and Accept All visible in the desktop preview. Content exposes Cookie Notice, Preference Centre, Cookie List, Revisit Consent Button and Blocked Content panels. General exposes Show advanced settings. The panels are collapsed; category default states, save controls, revisit configuration and any close/scroll consent behavior are not established by these screenshots. The preview also shows a close icon; closing must not grant optional consent and remains a behavior check. No new wording was published and no consent renewal was requested at this step. Next inspect Preference Centre and General's advanced options; preserve the current accurate inactive notice until activation scope is verified.

Subsequent expanded-panel screenshots confirm:

- Preference Centre title: Customise Consent Preferences; visible privacy overview is generic CookieYes text, with the full text not shown.
- Save My Preferences, Show more and Show less labels are configured. Show Google Privacy Policy is Off.
- General → advanced settings: **Consent expiration (days) = 365** and **Reload page on consent action = Off**.
- GDPR and Worldwide remain selected. No account change or publication was requested. Keep reload Off while preserving typed form input; this is not proof that loaded vendor scripts stop after withdrawal.
- The 365-day CMP choice lifetime is separate from consent-log retention and the candidate advertising marker's 180-day maximum. They are not interchangeable.

The subsequent visitor-dialog screenshots show Necessary as Always Active, all four optional category descriptions including Advertisement, and Reject All / Save My Preferences / Accept All. **No optional-category toggle is visible**, so these screenshots do not establish a usable granular advertising choice. They were supplied in response to the fresh-incognito instruction; session freshness was not independently inspected.

The previously observed zero-cookie inventory is a plausible cause: a [CookieYes Team support reply](https://wordpress.org/support/topic/default-cookie-category-preferences-to-on/) says empty categories have no toggle in its WordPress version. This is supporting evidence, not proof of identical hosted behavior. Next inspect Cookie Manager → Advertisement → pencil: Load cookie before consent and Hide category from banner should both be Off. This path is documented in [CookieYes banner customization](https://www.cookieyes.com/documentation/customize-cookie-banner/). Populate only verified cookie/storage inventory, then verify the visible category toggle and actual consent API before activation; do not add fictitious entries simply to expose a switch.

The owner subsequently opened Edit Category for Advertisement. Screenshot confirms **Load cookies prior to consent = Off**, **Hide category from banner = Off**, and **Sells or shares personal data = On**. No setting change was requested; leave the existing classification unchanged pending the final disclosure review. This classification switch does not itself establish that data is currently sent or sold. The account controls do not explain the missing visitor toggle; verified inventory and hosted behavior checks remain pending. The owner can Cancel the unchanged editor; no Save draft, publication or renewal is needed for this inspection.

Generic category descriptions also need alignment with actual use: the Necessary text currently claims no personally identifiable data and gives secure-login examples, while Analytics describes analytical cookies despite the site's cookie-free analytics. Neither generic text is evidence of actual storage or collection. No publication or renewal was requested at this step.

### Verified necessary-cookie entry — saved draft confirmed

Saved under Cookie Manager → Necessary → Add Cookie. The owner supplied a screenshot confirming Necessary (1 Cookie), the matching values below, and Publish changes available. Publication is not confirmed:

| Field | Prepared value |
|---|---|
| Cookie ID | `cookieyes-consent` |
| Domain | `tournstack.com` |
| Duration | `1 year` (365-day dashboard configuration) |
| Category | Necessary |
| Description | CookieYes stores your cookie consent choices and a consent identifier so the website can remember and apply your preferences on later visits. |
| Script URL Pattern | Leave blank; do not configure blocking of the consent manager itself. |

Evidence: retained public-browser inspection `alignment-cmp.json` from 2026-10-15 and owner screenshots of the 365-day setting, populated Add Cookie form, and saved Necessary entry. Blank Script URL Pattern appears as Not available in the saved listing. This is an inventory disclosure for an existing cookie, not a new tracking installation. This entry does not resolve the missing Advertisement toggle. Advertising inventory still requires isolated actual-vendor checks; no fictitious entry should be used to make the toggle appear. [CookieYes manual-entry instructions](https://www.cookieyes.com/documentation/manually-add-a-cookie-to-block/).

Necessary category-description correction: exact text confirmed in the owner's editor screenshot; the owner was instructed to Save draft and then asked for the next step. Independent saved/public readback is pending:

> Necessary cookies support essential website functions. We use CookieYes to store your consent choices and a consent identifier so the website can remember and apply your preferences. This cookie is not used for advertising.

This replaces the generic secure-login example and unsupported categorical claim that Necessary cookies store no personally identifiable data. Keep the category name Necessary and its existing controls unchanged.

### Bounded publication: existing Necessary disclosure

The owner published the two reviewed Necessary updates: the existing `cookieyes-consent` inventory entry and the corrected Necessary description above. This supersedes the earlier temporary hold for those two edits only. No Renew now action was requested for this disclosure correction. Advertising activation still requires the separate gates below.

**Live verified 2026-10-15 11:31:56 UTC (13:31:56 Slovenia):** fresh Chrome context opened the public site's Preferences and expanded Necessary without accepting, rejecting or saving consent. Correct category and cookie descriptions and 1-year duration were visible. `getCkyConsent()` reported action incomplete and all optional categories false. The inactive-advertising notice remained visible; no Meta/LinkedIn script or request attempt was observed. Advertising requests were intercepted defensively, with zero matching attempts. Only `cookieyes-consent` appeared in the cookie inventory; values and consent IDs were not retained. The optional categories still have no switches. Evidence: private `alignment-cmp-published.cjs` and `alignment-cmp-published.json`; all seven bounded checks passed. This verifies the disclosure publication and initial state, not advertising grant/withdrawal behavior. No further owner dashboard changes requested until advertising inventory is verified.

### Meta cookie inventory prepared after isolated library inspection

The actual Meta library set `_fbp` on `.tournstack.com` for approximately 90 days after synthetic consent in an intercepted test; it was absent before consent and deleted after withdrawal. See the [advertising runbook](integrations/advertising.md) for evidence and remaining traffic-verification limits. Prepare this **draft only**, not a claim of current production use:

| Field | Prepared value |
|---|---|
| Category | Advertisement |
| Cookie ID | `_fbp` |
| Domain | `.tournstack.com` |
| Duration | `3 months` |
| Script URL Pattern | `connect.facebook.net` |
| Description | When you allow advertising cookies, Meta uses this cookie to identify your browser for advertising measurement and to help deliver relevant ads. |

Owner screenshots confirm this entry is **saved as a draft**. The first saved entry lacked the Script URL Pattern and showed a warning; the subsequent screenshot confirms `connect.facebook.net` is now present and the warning has disappeared. All values match the table. The script pattern adds a CMP blocking rule for the Meta library; actual hosted-CMP interaction must be verified before activation. No additional advertising cookies are asserted from this bounded clean-URL test.

After the isolated actual-library grant/withdrawal/form-interaction checks passed, the owner **published this verified inventory entry**, with both production advertising integrations still disabled and the banner still stating that advertising is inactive. Live verification on 2026-10-15 at 11:56:34 UTC confirmed the Advertisement checkbox is present, enabled for user interaction and initially unchecked; the consent API reported Advertisement false and no completed action. Neither advertising vendor attempted to load. This supersedes the temporary inventory-publication hold; it does not establish advertising activation or consent renewal. Existing choices made during this preparation do not satisfy the new-notice marker gate.

The private `alignment-cmp-meta.cjs` experiment used the real published CMP engine with proposed category/provider data substituted in memory, but the published banner HTML still contained no optional checkboxes. It stopped before any consent action or Meta load. This is not proof of a defect in the saved draft: CookieYes publishes the checkbox markup separately in its banner configuration. The next test must use the actual newly generated public configuration rather than inventing markup. Every event/log endpoint was blocked in this experiment.

That preliminary experiment is now superseded by successful tests using **unmodified newly published CookieYes scripts/configuration** with captured actual Meta library/configuration. Only the local site's advertising feature flags changed in memory. At 1440 px (11:58:01–11:58:16 UTC) and 390 px (11:58:49–11:59:04 UTC), the actual Advertisement switch began Off; keyboard selection plus Save My Preferences created the current-notice marker and one intercepted PageView. Reopening Cookie settings and Reject All removed the marker and `_fbp` without another event. Reopening and Accept All created one new PageView without a second SDK load. Newsletter input survived all steps; no synthetic form value or user-data fields appeared in the captured requests. All vendor event and CMP logging endpoints were blocked, so no test consent logs or advertising events were delivered. Evidence: `alignment-cmp-meta-1440.json` and `alignment-cmp-meta-390.json`, both PASS. This is integration testing against the actual hosted engine; production flags and notices remain unchanged.

### Pending account sequence

1. Renewal is located in the actual account: **Advanced Settings → Consent settings → Renew user consents → Renew now**. Owner screenshot on 2026-10-15 shows the control on Free and “Last renewed: Not renewed yet.” The older standalone documentation's Site Settings path does not match this UI. Leave renewal until the new notice is ready; no renewal has been executed.
2. Prepare Advertisement wording and the policy against verified vendor behavior. Current generic category wording mentions customised advertising. Do not claim measurement-only collection without checking actual automatic events.
3. Retain advertising off initially, clear accept/reject/preferences, privacy link and accessible revisit. Actual save-preferences timing passed at desktop/mobile widths against the published CMP.
4. Publish the coordinated notice and renew the new scope when ready. Old consent alone cannot enable the new tags. Do not buy a plan/trial to complete this.
5. Bounded actual-Meta and hosted-CMP consented request/storage checks passed with collectors blocked. Complete remaining route/performance checks and record their scope; platform delivery remains a separate live test.

Candidate banner text, **not published**:

> We use necessary storage to remember your choices and cookie-free analytics to understand site use. With your permission, we use Meta Pixel to measure our advertising. Meta may also use visit data to personalise ads and improve its products. You can accept, reject or customise optional cookies and change your choice at any time.

Name only vendors actually ready to activate, and describe their actual scope. LinkedIn remains blocked on every eligible page because each has a newsletter form and supported withdrawal behavior has not been established.

Candidate Meta-only Advertisement category description, **not published**:

> If you allow this category, Meta Pixel sends technical visit information to Meta to help us measure advertising. Meta may connect that information with information it already holds and use it for personalised ads, content and product improvement. We do not use advanced matching or send newsletter email addresses or inquiry text to Meta. You can turn this category off at any time through Cookie settings. See our Privacy Policy for details.

Publish that no-form-data statement only with the tested route restrictions and confirmed account settings retained. The website notice must also disclose the consent marker, provider roles, Event Data retention and verified transfers. Inventory publication alone does not activate Meta or renew consent.

### Website storage

The optional invitation now keeps its timer/dismissal only in current-page memory; navigation starts a fresh timer. A saved contact still uses a one-use ten-minute session receipt, with an in-page fallback when storage is blocked. The candidate advertising marker is never written while `noticePublished:false`; its proposed 180-day limit is separate from vendor retention. Newsletter subscription, advertising choice and Plausible events remain separate.

## Historical original setup instructions (superseded by current state above)

At original setup, CookieYes was included and neither advertising integration had been prepared. The sequence below records that earlier plan; it is not evidence of current activation or a new instruction to publish old banner wording.

## Choice

The owner supplied the CookieYes installation code and selected it for TournStack. CookieYes lists a $0 Free plan with 5,000 pageviews per month. Its comparison table says **custom colours and custom CSS are unavailable on Free**, so the banner must use an available preset. Do not start or retain a paid trial for this setup.

## Brand settings

- Use a compact bottom banner, not a center popup. Check both desktop and mobile previews.
- Choose the least intrusive available light preset. Brand-specific colour controls require a paid plan.
- Show equally clear **Accept all**, **Reject all**, and **Preferences** actions. Keep advertising off by default.
- Link the banner to `https://tournstack.com/privacy.html` and leave a visible way to reopen preferences.
- Configure only categories that correspond to actual scripts. Plausible does not need to be put behind the advertising choice.

## Installation sequence

1. Load the supplied CookieYes installation code near the start of each page's `<head>`, before optional tracking scripts. This is implemented on the current public pages.
2. In CookieYes, finish the banner configuration for `tournstack.com`: choose a light Bottom Banner preset, show clear Accept all / Reject all / Customise actions, and link the privacy policy. The site footer provides a Cookie settings button using CookieYes's supported `cky-banner-element` class. Verify the account is on Free. Replace the default message about personalised ads with: “We use a necessary cookie to remember your choice. Our current analytics do not use cookies. Read more in our privacy policy.”
3. Add Meta Pixel and LinkedIn Insight Tag under the **Advertisement** category only after consent controls are active. Prefer consent-gated loading of the whole tag over allowing a tag to load and attempting to block only its cookies.
4. Update `privacy.html` with the actual tag purposes, providers, data categories, cookie names and retention periods before enabling them.
5. In a fresh browser profile, confirm neither advertising script nor its network requests/cookies run before consent or after **Reject all**. Confirm they run after advertising consent, stop after withdrawal, and that preferences can be reopened. Check all public pages and the contact form.
6. Recheck the Free plan's pageview limit and published features as traffic grows.

Sources: [CookieYes pricing](https://www.cookieyes.com/pricing/), [banner colour controls](https://www.cookieyes.com/documentation/customize-cookie-banner/), [HTML installation](https://www.cookieyes.com/documentation/cookie-banner-on-an-html-website/), and [prior-consent script blocking](https://www.cookieyes.com/documentation/implement-prior-consent-using-cookieyes/).
