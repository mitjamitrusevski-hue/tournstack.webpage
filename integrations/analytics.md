# Website conversion and interaction tracking

Updated: 2026-10-15

Plausible site: `tournstack.com`. Create Custom event goals with these exact names:

| Event | Trigger | Optional breakdown properties |
| --- | --- | --- |
| Newsletter Signup Requested | Browser accepts a valid newsletter form submission with a completed human check; includes repeat requests, and does not prove backend success | none |
| Newsletter Subscription Confirmed | Backend saves a new confirmation through the one-use email confirmation POST | none |
| Email Link Click | Visitor activates a mailto link; does not prove an email was sent | placement |
| FAQ Answer Opened | Visitor activates a closed FAQ summary, including keyboard activation; reopening counts again | question, question_id |
| Contact Link Click | Visitor activates an internal contact-page link | placement |

Contact placements are `header`, `hero`, `footer`, `contact-section`, `invitation` and `body`. Hero includes the FAQ forum card. Existing Contact Inquiry Submitted and automatic goals remain separate. Do not add these totals together as if they represented distinct people.

In Plausible Settings → Goals, use Custom event and the exact name above. Display names are optional. Enable `question` and `placement` custom properties where supported by the account plan. Properties contain public UI labels, never a visitor's name, email, message or private link. Custom-property reporting may require Plausible Business; verify the account plan before declaring the breakdown usable. Dashboard goal creation must be confirmed by the owner; publishing JavaScript does not create goals.

Confirmation uses the Events API with a fixed virtual URL, `https://tournstack.com/newsletter-confirmed`. It is an analytics label, not a public success-page route. The actual confirmation link remains private. Only a successful backend transition emits the event: GET, invalid/expired/used tokens and unsubscribe do not. Repeated signup by an already confirmed address does not create another confirmation. An address that unsubscribes and later confirms a fresh subscription can generate another confirmation.

The Worker forwards the actual browser User-Agent and trusted Cloudflare CF-Connecting-IP as the Events API requires. Neither is included as a custom property. Do Not Track or Global Privacy Control disables this server-side count. Missing visitor headers, filtering or an analytics outage can undercount; Sheets remains the subscription source of truth. No synthetic visitor IP or user agent is supplied. Analytics errors never undo a successful subscription. Failed/dropped event logging contains only a fixed diagnostic string.

Browser code: assets/js/interaction-analytics.js and assets/js/newsletter.js. Confirmation code: integrations/cloudflare-mailbox/newsletter.mjs. Update HTML cache versions when changing scripts. Automated checks must mock analytics, email and signup transports; do not generate fake production conversions. For final owner verification, use a fresh owned email alias and check Requested then Confirmed separately, plus FAQ and placement property reports after dashboard setup.

References: https://plausible.io/docs/custom-event-goals, https://plausible.io/docs/custom-props/introduction, https://plausible.io/docs/events-api.
