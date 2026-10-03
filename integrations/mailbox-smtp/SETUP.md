# TournStack — direct mailbox.org email

**Alternative implementation:** The selected deployment now uses [Cloudflare Workers Free](../cloudflare-mailbox/SETUP.md), because no server is available. This Node version is retained for a future server deployment. Shared email templates are in `../email/`.

## What runs where

The website remains static on GitHub Pages. Its existing form posts to the Google Apps Script web app. Apps Script saves **Timestamp, Name, Email, Inquiry** to **Contacts → WEB Contacts**, then posts to a private HTTPS relay. The relay sends through **smtp.mailbox.org**, using the real **info@tournstack.com** mailbox or an authorized alias. Both messages have **From: TournStack <info@tournstack.com>**. No transactional email provider is required.

The relay is a small Node.js 24 application. GitHub Pages cannot run it; it needs an always-on server/container with a persistent volume, HTTPS ingress and outbound TCP port 465 permitted. A VPS or existing application server is suitable. Run **one instance** against its SQLite queue. Ephemeral serverless functions are not suitable for this worker and local queue.

The prepared code is not deployed yet. The currently deployed Apps Script Version 1 still uses its previous Google sender until its code and manifest are replaced and a new deployment version is published.

## 1. Prepare mailbox.org credentials

Confirm **info@tournstack.com** exists as a mailbox or registered sending alias. `SMTP_USER` is the mailbox's **main login address**, which can differ from the From address when info is an alias. Mailbox.org must authorize that login to send as info.

Use mailbox.org **All settings → Security → Application passwords** to create a dedicated SMTP application password when available; with 2FA an application password is required. Enter credentials only in the relay server's private environment settings. Never paste them into chat, Apps Script client code, website files or GitHub.

| Setting | Value |
| --- | --- |
| SMTP server | `smtp.mailbox.org` |
| Port | `465` |
| Encryption | TLS from connection start; certificate verification enabled |
| Login | Main mailbox address |
| Password | Mailbox.org SMTP application password |
| Sender | `TournStack <info@tournstack.com>` (fixed in code) |

The code uses port 465. Mailbox.org also supports port 587 with STARTTLS, but switching requires changing transport settings; do not simply change the port.

## 2. Run the relay

From `integrations/mailbox-smtp/`:

```bash
npm ci --omit=dev --ignore-scripts
cp .env.example .env
```

Set `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_RELAY_TOKEN` privately. Generate a separate random relay token of at least 32 characters, for example with `openssl rand -hex 32`. Keep it out of logs. This token is not the mailbox password.

Use an absolute persistent `QUEUE_PATH` on the host. Protect the directory and backups: the queue temporarily contains contact details. Run with a process manager, restarting on failure. `npm start` loads the local `.env`; when the host injects environment variables instead, run `node server.mjs`.

The supplied Dockerfile is an alternative. Build from the parent **integrations** directory with `docker build -f mailbox-smtp/Dockerfile -t tournstack-mailbox .` so shared email templates are included. Inject credentials via the hosting service's secret settings, and mount a persistent volume at `/data`, writable by the container's `node` user (UID 1000). Bind a published port to loopback when using a same-host reverse proxy. Do not expose the unencrypted relay port to the Internet.

Place the relay behind a reverse proxy with a valid HTTPS certificate. Expose **POST /contact-email** and **GET /health** on your selected relay domain; both require `Authorization: Bearer <MAIL_RELAY_TOKEN>`. The static website never receives this secret. `/health` checks relay reachability/authentication only, not SMTP delivery. No CORS is needed because Apps Script calls the relay server-to-server.

For example, a private endpoint could be `https://mail-relay.tournstack.com/contact-email`, but this hostname has **not** been created or configured. Use the host and DNS you actually provision.

## 3. Update Google Apps Script

1. Replace **Code.gs** with the updated file in `../google-apps-script/`. It already uses the Gmail-owned Contacts spreadsheet ID.
2. Replace the project's **appsscript.json** with the updated supplied manifest. The scopes are now **spreadsheets** and **script.external_request**; Google mail sending is no longer used.
3. In **Project Settings → Script Properties**, add:

| Property | Private value |
| --- | --- |
| `MAIL_RELAY_URL` | Your HTTPS relay URL ending in `/contact-email` |
| `MAIL_RELAY_TOKEN` | The exact same random token configured on the relay |

4. Run **setupContacts** as **mitja.mitrusevski@gmail.com** and authorize the new external-request permission. No test email is sent by setup. Missing properties cause a configuration error. The Apps Script **verifyMailRelay** helper targets the selected Cloudflare Worker's `/smtp-check`; it is not implemented by this optional Node relay. Test Node SMTP delivery through a controlled real submission instead.
5. Use **Deploy → Manage deployments → Edit → New version → Deploy**. Keep **Execute as: Me** and **Who has access: Anyone**. Updating the existing deployment preserves its `/exec` URL, so the website configuration stays valid.

You do **not** put SMTP credentials in Apps Script. Apps Script only holds the relay URL and its private token.

## 4. Verify the live flow

After publishing the configured website, submit a genuine inquiry using an address you control. Confirm:

- **Contacts → WEB Contacts** contains the timestamped row.
- **info@tournstack.com** receives **New Contact**, with exactly Name, Email and Inquiry. Reply-To is the visitor's email.
- The visitor receives **Thanks for contacting TournStack** from **TournStack <info@tournstack.com>**, with Reply-To **info@tournstack.com**.
- The inline official logo displays and links to the landing page with the agreed confirmation-email UTMs.
- Inspect received headers for SPF/DKIM/DMARC results under mailbox.org's existing domain setup. Configure missing mailbox.org authentication using its domain instructions; no incoming MX changes are required for this relay.

SMTP acceptance does not guarantee inbox delivery. A Sent folder copy is not created automatically by SMTP; the recipient copies and mailbox/host logs provide verification. No real contact or email was created during local checks.

## Delivery, duplicates and operations

Contacts are saved before relay submission. If relay submission fails, the contact remains saved, but those messages **are not automatically resubmitted by Apps Script**. The browser's success means the inquiry was saved. Review Apps Script **Executions** and follow up from the Contacts sheet when required; changing a sender must never lose an inquiry.

Once the relay returns **202**, the two messages are persisted independently in SQLite. The worker retries transient SMTP failures up to five attempts, with increasing delays, and does not intentionally resend the other message after it succeeds. Permanent SMTP rejections become `failed`. Logs contain message kind, retry count and state, never passwords or inquiry content. Monitor failed/pending job counts on the host; `/health` alone does not monitor delivery.

Matching submission IDs and payloads are deduplicated for 30 days; an ID reused with different content is rejected. SMTP cannot promise exactly-once delivery: an interrupted connection after server acceptance or a process crash before marking success can produce a duplicate. Stable Message-ID values help identify it but do not guarantee mailbox deduplication.

The default limits are 100 new contacts per rolling day and three confirmation emails per recipient per rolling day. Further inquiries from the same address still receive internal notifications within the global cap. These are operational limits, **not mailbox.org quotas**. If the cap is reached, Sheets still preserves the contact while the relay rejects the enqueue; monitor and follow up. Add a server-verified challenge to the public form if abuse appears; a honeypot is only basic protection.

Sent message payloads are cleared after SMTP acceptance. Deduplication metadata and failed payloads are removed after 30 days while the worker runs. Google Sheets remains the long-term contact record. Set retention/access rules for that record separately. Do not reuse this confirmation flow for newsletter subscriptions: the receipt confirms an inquiry only.

## Email appearance and assets

The confirmation uses Montserrat with Arial fallback, Deep Slate `#0F172A`, Soft White `#F8FAFC`, slate text and blue links. HTML uses presentation tables, inline styles and a plain-text alternative. An email-compatible PNG export of the existing official reversed SVG logo is attached inline with a CID; the website continues to use its SVG originals. Font availability and image rendering depend on the email client.

The logo destination is:

```text
https://tournstack.com/?utm_source=tournstack&utm_medium=email&utm_campaign=contact-confirmation&utm_content=confirmation-email-en&utm_term=logo
```

## References

- [Mailbox.org configuration and application passwords](https://kb.mailbox.org/en/business/e-mail/e-mail-configuration/)
- [Mailbox.org sending limits](https://kb.mailbox.org/en/business/e-mail/is-there-a-limit-on-the-amount-of-e-mails-that-i-can-send-from-my-account/)
- [Nodemailer SMTP transport](https://nodemailer.com/smtp)
- [Nodemailer embedded images](https://nodemailer.com/message/embedded-images)
- [Google Apps Script URL Fetch](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app)
