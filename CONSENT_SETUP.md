# Website consent setup

Status: CookieYes installation code is included on all public HTML pages. Meta Pixel and LinkedIn Insight Tag are not installed.

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
2. In CookieYes, finish the banner configuration for `tournstack.com`: choose a light preset, show clear Accept all / Reject all / Preferences actions, link the privacy policy, and enable a visible revisit control. Verify the account is on Free.
3. Add Meta Pixel and LinkedIn Insight Tag under the **Advertisement** category only after consent controls are active. Prefer consent-gated loading of the whole tag over allowing a tag to load and attempting to block only its cookies.
4. Update `privacy.html` with the actual tag purposes, providers, data categories, cookie names and retention periods before enabling them.
5. In a fresh browser profile, confirm neither advertising script nor its network requests/cookies run before consent or after **Reject all**. Confirm they run after advertising consent, stop after withdrawal, and that preferences can be reopened. Check all public pages and the contact form.
6. Recheck the Free plan's pageview limit and published features as traffic grows.

Sources: [CookieYes pricing](https://www.cookieyes.com/pricing/), [banner colour controls](https://www.cookieyes.com/documentation/customize-cookie-banner/), [HTML installation](https://www.cookieyes.com/documentation/cookie-banner-on-an-html-website/), and [prior-consent script blocking](https://www.cookieyes.com/documentation/implement-prior-consent-using-cookieyes/).
