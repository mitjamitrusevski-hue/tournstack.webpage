# TournStack — Cloudflare Free + mailbox.org

## Current status

The user has created a Cloudflare account using **mitja@tournstack.com**. That address is suitable. It does not need to match **mitja.mitrusevski@gmail.com**, which continues to own Contacts and Apps Script. The sender remains **TournStack <info@tournstack.com>** through mailbox.org.

The Worker, persistent queue, branded confirmation and deployment configuration are prepared. Local protocol/queue checks and a Wrangler dry-run build pass. **Nothing has been deployed to Cloudflare yet.** Real mailbox.org authentication and inbox delivery need the live checks below. The existing Apps Script Version 1 continues to use its previous Google sender until updated.

## The setup

GitHub Pages hosts the website. Apps Script saves the contact in **Contacts → WEB Contacts**, then calls an authenticated Cloudflare Worker. A SQLite-backed Durable Object persists the email jobs and uses alarms to retry transient failures. The Worker connects directly to **smtp.mailbox.org:465** with TLS; no email API provider or rented server is used.

Use Cloudflare's provided **workers.dev** address for the relay. You do not need to add tournstack.com as a Cloudflare zone, move nameservers, change the website CNAME or change mailbox.org's incoming MX records. Cloudflare's email routing product is not needed.

## Why Free is suitable for the initial contact form

Verified against Cloudflare documentation on **2026-10-03**:

| Resource | Free allowance |
| --- | --- |
| Worker requests | 100,000 per day |
| Worker CPU | 10 ms per HTTP invocation; network waiting is not active CPU |
| SQLite Durable Object requests, including alarms | 100,000 per day |
| Durable Object duration | 13,000 GB-seconds per day |
| Durable Object SQL rows read | 5 million per day |
| Durable Object SQL rows written | 100,000 per day |
| Durable Object storage across the account | 5 GB; Free object storage has a per-object limit |

The code defaults to **100 contacts per rolling day** and **three confirmations per recipient per rolling day**. In normal operation, this is well below the request/storage allowances. As a conservative illustration, 200 messages taking 20 seconds each use roughly 500 GB-seconds for SMTP work at 128 MB, before minor queue overhead, versus 13,000 included. This is an estimate, not a guarantee: attacks, repeated failures or other Workers on the same account consume shared allowances. Free-plan operations fail when relevant limits are exceeded; do not enable Paid automatically.

This is a low-volume inquiry receipt system, not a newsletter sender. Mailbox.org's own policies, account permissions and sending limits also apply. Cloudflare permits TLS TCP sockets, but the real mailbox.org connection from Cloudflare must still pass authentication and delivery checks.

## 1. Download the two deployment files

Use **deploy/worker.mjs** and **deploy/wrangler.jsonc** in this folder. Save both, with those exact names, in one local folder such as **TournStack-Email-Worker**. The JavaScript is already bundled; the standalone pair does not need the full website repository. Neither file contains credentials.

Install **Node.js 24 LTS** if it is not already available. Open a terminal in the folder containing the two files. On Windows, File Explorer's **Open in Terminal** is suitable.

## 2. Log in and deploy

Run:

```bash
npx --yes wrangler@4.147.0 login
npx --yes wrangler@4.147.0 deploy
```

The first command opens a browser for Cloudflare authorization. Use the account registered as **mitja@tournstack.com**. The second creates the configured Worker and its SQLite Durable Object automatically. It should return the actual **workers.dev** URL. Save that returned URL; do not invent it from the account email or a guessed subdomain.

If asked to create a workers.dev subdomain, choose an available account subdomain. Stay on the **Workers Free** plan. Until secrets are configured, the Worker rejects requests and cannot send email.

## 3. Add three private secrets

In the Cloudflare dashboard, open **Workers & Pages → tournstack-mailbox → Settings → Variables and Secrets**. Add these as **Secret**, then deploy/save the changes:

| Secret name | Value |
| --- | --- |
| `SMTP_USER` | The mailbox.org main login address authorized to send as info@tournstack.com |
| `SMTP_PASSWORD` | A dedicated SMTP application password, where available; required with 2FA |
| `MAIL_RELAY_TOKEN` | A separate random value of at least 32 characters |

`SMTP_USER` is not the Cloudflare login email unless it is also the actual mailbox.org main login. If info is a registered alias, use the account that owns that alias. Mailbox.org must permit this account to send as **info@tournstack.com**.

Mailbox.org application-password settings are under **All settings → Security → Application passwords**. Ensure the password permits SMTP. Enter it only in Cloudflare's secret field, never in chat, the downloadable JavaScript, the website or GitHub.

Generate the separate relay token with a password manager, or locally with:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep that output private: the same value is entered in Cloudflare and Apps Script. It is not your mailbox password. The CLI alternative is `npx --yes wrangler@4.147.0 secret put SECRET_NAME` for each secret; its prompts keep secret values out of shell command history.

## 4. Update Apps Script

Open the existing project while signed into **mitja.mitrusevski@gmail.com**:

[TournStack Apps Script](https://script.google.com/u/0/home/projects/1Vol7BUmnv_jdAs_BRnorsQeW1CdT3EI8GNoM7agTTEqtY-PNEMGfLW4c/edit)

1. Replace **Code.gs** with the updated file from `../google-apps-script/`.
2. Replace the project manifest with the latest **appsscript.json** in that folder. It declares spreadsheets and **script.external_request**, replacing Google email-sending permission.
3. Under **Project Settings → Script Properties**, enter:

| Property | Value |
| --- | --- |
| `MAIL_RELAY_URL` | The actual deployed Worker URL, with `/contact-email` appended |
| `MAIL_RELAY_TOKEN` | The exact same private token configured in Cloudflare |

4. Run **setupContacts**, then **verifyMailRelay**, authorizing the new external-request scope when Google asks. The SMTP verification connects and authenticates to mailbox.org without sending an email. The execution log should state that the TLS connection and SMTP authentication succeeded.
5. Update the existing deployment using **Deploy → Manage deployments → Edit → New version → Deploy**, keeping **Execute as: Me** and **Who has access: Anyone**. Reusing the existing deployment preserves its `/exec` URL already configured in the website.

The SMTP password belongs only in Cloudflare. Apps Script needs the separate relay token, not SMTP credentials. Keep the current deployment intact until the Worker and private settings are ready.

## 5. Verify the real form and both emails

When the updated website is published, submit an inquiry from an email address you control. Check the saved timestamped row, the notification in info@tournstack.com and the visitor's confirmation.

| Message | From | To | Reply-To |
| --- | --- | --- | --- |
| **New Contact** | TournStack <info@tournstack.com> | info@tournstack.com | Visitor's email |
| **Thanks for contacting TournStack** | TournStack <info@tournstack.com> | Visitor's email | info@tournstack.com |

The internal notification contains exactly:

```text
Name: [Name]
Email: [Email]
Inquiry: [Inquiry]
```

The confirmation contains the personalized friendly text already drafted, Deep Slate and Soft White styling, Montserrat with Arial fallback, HTML/plain-text alternatives and an inline PNG export of the official logo. Its logo links to:

```text
https://tournstack.com/?utm_source=tournstack&utm_medium=email&utm_campaign=contact-confirmation&utm_content=confirmation-email-en&utm_term=logo
```

Check the received email's authentication headers for mailbox.org SPF/DKIM/DMARC. SMTP acceptance is not proof of inbox placement. SMTP does not automatically put a copy in mailbox.org's Sent folder. No real contact or email was created during local tests.

## Delivery and monitoring

The Worker returns **202** after persisting jobs; the browser's receipt means the Sheet row was saved. Those are separate from inbox delivery. Notification and confirmation retry independently, up to five attempts for transient SMTP failures. Permanent rejections become failed jobs. The endpoint accepts only the defined contact fields and fixed templates, so callers cannot choose an arbitrary sender or add arbitrary recipients.

Submission ID/payload pairs are deduplicated for 30 days. SMTP still cannot promise exactly-once delivery: a connection failure after remote acceptance or a crash before marking success can produce a duplicate. Stable Message-ID values identify related retries. Lost QUIT responses after a confirmed DATA acceptance do not trigger a resend.

If Apps Script cannot enqueue to Cloudflare, the Sheet row remains saved, but that failure is not automatically re-enqueued. Review **Apps Script → Executions** and follow up from the contact record. Rate-limit rejections also preserve the Sheet record. Contact email addresses are not verified by the form; the confirmation caps reduce basic abuse but a server-verified challenge can be added if abuse occurs.

**GET /health** requires the relay token and returns only aggregate queue counts, never personal contact data. **POST /smtp-check** requires the same token and checks TLS/SMTP authentication only. Both return generic errors. SMTP failure logs contain message kind, attempt count and state, not credentials or inquiry text. Use Cloudflare's Worker logs and health counts to monitor pending/failed jobs. A basic health response is not a delivery guarantee.

Sent message payloads are cleared after SMTP acceptance. Deduplication metadata and failed payloads are purged after 30 days using a persisted cleanup alarm; cleanup can be delayed by outages or exhausted quotas. The private Google Sheet remains the long-term record. Access and retention rules for that Sheet and Cloudflare are separate. This receipt does not subscribe visitors to newsletters.

## Developer maintenance

Source files are in `integrations/cloudflare-mailbox/`; shared transport-independent email templates and the embedded logo are in `integrations/email/`. The previous Node SMTP relay is retained as an alternative, but the selected deployment is Cloudflare. The bundled `deploy/worker.mjs` is generated: edit source, not that bundle.

From the source folder, run `npm ci --ignore-scripts`, `npm test` and `npm run package` to rebuild the two standalone deployment files. `npm run check` builds without deployment. Commit code only; SMTP secrets, `.dev.vars`, build caches and local environment files are ignored. After source changes, deploy the Worker again and update Apps Script only if its code or manifest changed. Do not remove/rename the Durable Object migration or binding to reset a live queue.

## Primary references

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects Free plan and pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Object limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [TLS TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Mailbox.org SMTP and application passwords](https://kb.mailbox.org/en/business/e-mail/e-mail-configuration/)
