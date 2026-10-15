# Newsletter signup and contact receipt — 2026-10-14

Owner-authorised addition to the website. The newsletter is being prepared; this implements optional signup and confirmation, not a newsletter campaign or mailing schedule.

## Single workbook

[TournStack — Website Inquiries & Newsletter](https://docs.google.com/spreadsheets/d/1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM/edit) stays in the owner's [DataBase folder](https://drive.google.com/drive/folders/1NHpl_PAAUloPblus2diGxL20vyKxkE91).

- **WEB Contacts:** existing Name/Email/Inquiry records and timestamps; unchanged schema.
- **Newsletter:** A:L preserve email, verification state, request/confirmation dates, consent version/text, source, hashed tokens, verification expiry, mail queue time and job ID. M is `SubscriptionStatus` (`active`, `inactive`, or blank for a never-confirmed pending request); N is `StatusChangedAt`. Column K's SubmissionId is the server-generated mail job ID. Hidden G:I contain token hashes and expiry, not raw tokens.

The existing workbook ID and owner remain; renaming its title changes no integration. Do not import inquiry addresses into Newsletter. Only rows with B=`confirmed` AND M=`active` are eligible for newsletters, within their retention period. Exclude inactive and pending rows from every export/send. Do not manually activate rows or rewrite service-owned headers/dates; reactivation requires fresh email confirmation. The footer uses `newsletter-2026-10-14` and the recorded consent wording: “Email me TournStack news. Unsubscribe anytime.” Change the version and stored wording together if the programme changes.

## Flow

1. A visitor enters an email and completes the existing site's Turnstile widget with action `newsletter`; it loads on footer focus. Contact uses its separate `contact` action.
2. Apps Script validates origin, fields, honeypot, consent version and Cloudflare Siteverify before any newsletter write or mail request.
3. A pending row is saved, then the authenticated Cloudflare relay queues one verification email. Generic receipts do not reveal membership. A queued request suppresses another email to the same address for 24 hours; shared Worker caps remain 100 requests/day and three confirmations/address/day.
4. The verification link contains random opaque material plus a purpose-bound HMAC. The Worker rejects forged or wrong-purpose tokens locally. Raw tokens contain no email address and are not stored in the workbook; the mail queue necessarily holds the links until SMTP acceptance and then clears their payload.
5. GET opens a branded confirmation page without subscribing. A final POST confirms. The Worker signs the action/token/timestamp to Apps Script with the existing relay secret; Apps Script accepts a five-minute timestamp window, verifies the HMAC and changes only the matching pending row. Confirmation expires after 24 hours and is single use.
6. The unsubscribe link requires a final POST and retains the matching row: B=`unsubscribed`, M=`inactive`, N=actual status-change time. It invalidates outstanding confirmation tokens. Repeated unsubscribe does not reset N. Confirmation sets B=`confirmed`, M=`active`, N=confirmation time. Previously inactive addresses stay inactive during a new pending signup and reactivate only after fresh confirmation. Contact inquiries are separate and untouched. Links remain on the existing Worker origin; responses are private/no-store, noindex and no-referrer.
7. The footer Unsubscribe link opens `/unsubscribe.html`. A human-verified email-only request sends a private branded unsubscribe email to an existing subscribed/pending address. Generic browser receipts hide membership; a request alone never changes status. Unknown/already inactive addresses receive no email. Requests are limited to one queued unsubscribe link/hour plus existing global/per-address caps. A new accepted request rotates the unsubscribe hash; use the latest email. The original verification email's unsubscribe link keeps working until a newer link or signup replaces it.
8. The Durable Object enables daily authenticated cleanup after the first accepted newsletter request. Never-confirmed pending rows expire after seven days; confirmed rows after 730 days from confirmation; inactive rows after 730 days from N. Failed cleanup retries in one hour. Queue records retain their 30-day purge and SMTP retry policy.

Private SMTP/relay credentials are unchanged. `NEWSLETTER_BACKEND_URL` is a non-secret Worker variable pointing to the existing Apps Script `/exec` URL. Apps Script now needs both Code.gs and Newsletter.gs; the manifest's existing spreadsheet/external-request scopes suffice.

## Contact conversion and thank-you page

The backend-confirmed contact receipt creates a one-use, ten-minute session marker containing an opaque submission ID, expiry and same-origin return URL, with no form fields. `/inquiry-received.html` consumes it, opens a native thank-you dialog and sends `Contact Inquiry Submitted` to the existing Plausible integration. The owner created this custom event goal with display name **Contact inquiry received**. Existing automatic `Form: Submission` remains separate: it measures a submission attempt, not a persistent save.

The thank-you page is noindex and absent from the sitemap. Direct visits or refresh after marker consumption return to Contact without loading analytics or sending the saved-inquiry event. OK/Escape returns to the original Contact URL. If session storage is blocked, the original Contact page shows its accessible dialog and emits the event once for the confirmed request; URL, query and fragment are restored on close. Future GA4 integration should use the verified event/guarded success route and follow consent rules; GA4 is not installed by this change.

## Email logo

The existing reversed PNG logo is retained byte-for-byte and published at `https://tournstack.com/assets/brand/TS_EmailLogo_Reversed_DarkBG_RGB.png`. Acknowledgement and newsletter emails reference that HTTPS asset and use multipart/alternative text and HTML. The earlier inline Content-ID correction did not resolve the owner's rendering failure. Fresh email rendering needs client verification; previously received messages retain their original markup. Recipients may need to enable remote images.

## Confirmation request origin

The page keeps `Referrer-Policy: no-referrer` to protect private tokens. Chrome consequently sends `Origin: null` for its native form POST. The Worker accepts this only with `Sec-Fetch-Site: same-origin`, alongside signed purpose-bound token checks. Explicit cross-origin requests and opaque origins with cross-site or absent Fetch Metadata are rejected. GET requests never subscribe or unsubscribe.

## Newsletter human check presentation

Use the standard 300 x 65 horizontal Managed widget below the email field, matching the contact form's dimensions. The footer contact column spans the mobile grid so the widget fits without cropping or scaling. Backend Siteverify remains mandatory before saving a signup.

## Checks and rollback

Run the existing contact gate test, `newsletter.test.cjs`, the eight Worker tests and Wrangler's dry run. Website checks cover modal focus/dismissal, one-use conversion markers, incoming attribution, desktop/mobile layout and isolated contact/newsletter transports. Actual delivery, token confirmation and unsubscribe require a separately authorised controlled test; never use a production bypass or a fake passing Turnstile key.

Keep deployment IDs/versions and the previous Worker version in the Operations release record. To pause signup, disable the footer entry while retaining confirmation/unsubscribe processing and the workbook. Do not roll back to an unprotected contact version or strand confirmed subscribers without an unsubscribe route. A website rollback does not roll back Apps Script or Worker deployments.

## Repeat signup by a confirmed subscriber

After the same human/consent checks, a confirmed subscriber receives a branded already-subscribed service notice rather than another verification link. Browser receipts remain generic and do not reveal list membership. The existing subscription, consent, confirmation time and unsubscribe token are preserved. Column J records the most recent queued email; column K uses `notice:<mail UUID>` for this notice. A notice can be queued at most once per rolling 24 hours; pending verification cooldown remains unchanged. Existing global and per-address mail caps still apply, so reaching a cap can suppress a notice. No past requests are emailed retroactively.
