# Newsletter signup and contact receipt — 2026-10-14

Owner-authorised addition to the website. The newsletter is being prepared; this implements optional signup and confirmation, not a newsletter campaign or mailing schedule.

## Single workbook

[TournStack — Website Inquiries & Newsletter](https://docs.google.com/spreadsheets/d/1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM/edit) stays in the owner's [DataBase folder](https://drive.google.com/drive/folders/1NHpl_PAAUloPblus2diGxL20vyKxkE91).

- **WEB Contacts:** existing Name/Email/Inquiry records and timestamps; unchanged schema.
- **Newsletter:** separate email, pending/confirmed status, request/confirmation dates, consent version/text, source, hashed tokens, verification expiry, mail queue time and job ID. Column K's SubmissionId is the server-generated mail job ID. Hidden G:I contain token hashes and expiry, not raw tokens.

The existing workbook ID and owner remain; renaming its title changes no integration. Do not import inquiry addresses into Newsletter. Only `confirmed` rows are eligible for this optional programme, within their retention period. Do not edit pending rows to confirmed manually or rewrite the service-owned headers. The footer uses `newsletter-2026-10-14` and the recorded consent wording: “Email me TournStack news. Unsubscribe anytime.” Change the version and stored wording together if the programme changes.

## Flow

1. A visitor enters an email and completes the existing site's Turnstile widget with action `newsletter`; it loads on footer focus. Contact uses its separate `contact` action.
2. Apps Script validates origin, fields, honeypot, consent version and Cloudflare Siteverify before any newsletter write or mail request.
3. A pending row is saved, then the authenticated Cloudflare relay queues one verification email. Generic receipts do not reveal membership. A queued request suppresses another email to the same address for 24 hours; shared Worker caps remain 100 requests/day and three confirmations/address/day.
4. The verification link contains random opaque material plus a purpose-bound HMAC. The Worker rejects forged or wrong-purpose tokens locally. Raw tokens contain no email address and are not stored in the workbook; the mail queue necessarily holds the links until SMTP acceptance and then clears their payload.
5. GET opens a branded confirmation page without subscribing. A final POST confirms. The Worker signs the action/token/timestamp to Apps Script with the existing relay secret; Apps Script accepts a five-minute timestamp window, verifies the HMAC and changes only the matching pending row. Confirmation expires after 24 hours and is single use.
6. The separate unsubscribe link also requires a final POST and deletes the matching newsletter row. It does not remove contact inquiries. Links remain on the existing Worker origin; there is no new DNS service or analytics on token-bearing pages. Responses are private/no-store, noindex and no-referrer.
7. The Durable Object enables daily authenticated cleanup after the first accepted newsletter request. Pending rows older than seven days and confirmed rows older than 730 days are removed. Failed cleanup retries in one hour. Existing queue records retain their 30-day purge and SMTP retry policy.

Private SMTP/relay credentials are unchanged. `NEWSLETTER_BACKEND_URL` is a non-secret Worker variable pointing to the existing Apps Script `/exec` URL. Apps Script now needs both Code.gs and Newsletter.gs; the manifest's existing spreadsheet/external-request scopes suffice.

## Contact conversion and thank-you page

The backend-confirmed contact receipt creates a one-use, ten-minute session marker containing an opaque submission ID, expiry and same-origin return URL, with no form fields. `/inquiry-received.html` consumes it, opens a native thank-you dialog and sends `Contact Inquiry Submitted` to the existing Plausible integration. The owner created this custom event goal with display name **Contact inquiry received**. Existing automatic `Form: Submission` remains separate: it measures a submission attempt, not a persistent save.

The thank-you page is noindex and absent from the sitemap. Direct visits or refresh after marker consumption return to Contact without loading analytics or sending the saved-inquiry event. OK/Escape returns to the original Contact URL. If session storage is blocked, the original Contact page shows its accessible dialog and emits the event once for the confirmed request; URL, query and fragment are restored on close. Future GA4 integration should use the verified event/guarded success route and follow consent rules; GA4 is not installed by this change.

## Email logo

The existing reversed PNG logo is retained byte-for-byte. Email image Content-IDs now use globally unique, domain-qualified values matching their HTML cid URLs, and multipart/related declares its multipart/alternative root type. This corrects MIME standard defects; an actual fresh Gmail message is still needed to verify rendering. Previously received emails do not change retroactively. See RFC 2392 and RFC 2387.

## Checks and rollback

Run the existing contact gate test, `newsletter.test.cjs`, the eight Worker tests and Wrangler's dry run. Website checks cover modal focus/dismissal, one-use conversion markers, incoming attribution, desktop/mobile layout and isolated contact/newsletter transports. Actual delivery, token confirmation and unsubscribe require a separately authorised controlled test; never use a production bypass or a fake passing Turnstile key.

Keep deployment IDs/versions and the previous Worker version in the Operations release record. To pause signup, disable the footer entry while retaining confirmation/unsubscribe processing and the workbook. Do not roll back to an unprotected contact version or strand confirmed subscribers without an unsubscribe route. A website rollback does not roll back Apps Script or Worker deployments.
