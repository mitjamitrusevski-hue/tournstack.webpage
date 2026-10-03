# Website consent setup

Status: planned. No consent manager, Meta Pixel or LinkedIn Insight Tag is installed on the published site yet.

## Choice

CookieYes still offers a $0 Free plan for one domain with 5,000 pageviews per month, covering the expected ~1,000 monthly views. Its current comparison table says **custom colours are unavailable on Free**, as are custom CSS and removal of CookieYes branding. Therefore, do not choose it for TournStack if brand colours are required. A small, self-hosted consent manager such as [Klaro!](https://klaro.org/) is the preferred no-fee route; assess its Meta and LinkedIn blocking in a browser before enabling either tag. CookieYes Free remains an option only if its preset appearance is acceptable. Never start a paid trial to use the Free plan.

## Brand settings

- Use a compact bottom banner, not a center popup. Check both desktop and mobile previews.
- Use Deep Slate `#0F172A` or Soft White `#F8FAFC` for the banner surface, with matching text from the brand palette.
- Use Court Blue `#6EA0FF` with Deep Slate text on dark surfaces, or Action Blue `#1855CC` with Soft White text on light surfaces, for actions.
- Show equally clear **Accept all**, **Reject all**, and **Preferences** actions. Keep advertising off by default.
- Link the banner to `https://tournstack.com/privacy.html` and leave a visible way to reopen preferences.
- Configure only categories that correspond to actual scripts. Plausible does not need to be put behind the advertising choice.

## Installation sequence

1. Choose the consent manager before adding advertising tags. For branded, no-fee styling, implement and configure Klaro! locally for `tournstack.com`.
2. Load the consent manager near the start of each page's `<head>`, before any optional tracking script.
3. Add Meta Pixel and LinkedIn Insight Tag under the **Advertisement** category only after consent controls are active. Prefer consent-gated loading of the whole tag over allowing a tag to load and attempting to block only its cookies.
4. Update `privacy.html` with the actual tag purposes, providers, data categories, cookie names and retention periods before enabling them.
5. In a fresh browser profile, confirm neither advertising script nor its network requests/cookies run before consent or after **Reject all**. Confirm they run after advertising consent, stop after withdrawal, and that preferences can be reopened. Check all public pages and the contact form.
6. If using CookieYes Free instead, recheck its pageview limit and published pricing/features as traffic grows.

Sources: [CookieYes pricing](https://www.cookieyes.com/pricing/), [banner colour controls](https://www.cookieyes.com/documentation/customize-cookie-banner/), [HTML installation](https://www.cookieyes.com/documentation/cookie-banner-on-an-html-website/), and [prior-consent script blocking](https://www.cookieyes.com/documentation/implement-prior-consent-using-cookieyes/).
