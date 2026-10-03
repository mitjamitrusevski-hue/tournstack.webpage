# TournStack contact form — Google setup

The Contacts spreadsheet is already created in the requested DataBase folder:

[Open Contacts](https://docs.google.com/spreadsheets/d/1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM/edit?usp=drivesdk)

The **WEB Contacts** tab contains **A Timestamp, B Name, C Email, D Inquiry**. Do not publish the spreadsheet or enable public link access. Visitors submit to a separate endpoint; they never need access to the Sheet.

## Current account and project

The copied Contacts spreadsheet is now the integration target. Its ID is `1QxdXhDRPlZpUEjz28vgcRnAW17QeCl-7jqnIb8Aa8gM`. The user reports that **mitja.mitrusevski@gmail.com** owns it. The supplied `Code.gs` has been updated to this spreadsheet ID.

Use the user's [Apps Script project](https://script.google.com/u/0/home/projects/1Vol7BUmnv_jdAs_BRnorsQeW1CdT3EI8GNoM7agTTEqtY-PNEMGfLW4c/edit) while signed into that Gmail account. This editor link is not a deployed web app endpoint.

The user supplied an updated deployment on **2026-10-03**: [Web app endpoint](https://script.google.com/macros/s/AKfycbykm7hoGEXYxCJyNb0An2oWpt2BX5kbZunBu5FjEeW8yjn14ICtC8YMaVPt761YAN65/exec). This `/exec` URL is now present in the live website configuration. The handoff reports a successful `verifyMailRelay` run: mailbox.org TLS connection and SMTP authentication succeeded, with no email sent. The selected implementation calls the deployed Cloudflare Worker at `https://tournstack-mailbox.tournstack.workers.dev`; see [Cloudflare Free setup](../cloudflare-mailbox/SETUP.md). The published website still needs one real contact submission to verify Sheet storage, notification delivery and visitor confirmation. SMTP authentication alone does not verify inbox delivery.

### Where appsscript.json belongs

The downloaded `appsscript.json` is the Apps Script project's manifest. It does not need to be uploaded beside the spreadsheet or put in a Drive scripts folder, and there is no Drive-file link to set:

1. Open the Apps Script project above.
2. Click **Project Settings** (gear icon) and enable **Show "appsscript.json" manifest file in editor**.
3. Return to **Editor**, then click the existing **appsscript.json** file in the file list.
4. Open the downloaded JSON in a text editor, copy its full contents into the project's manifest and save. For this new contact integration, use the supplied manifest. If you have added other services or settings already, preserve their required configuration rather than removing it blindly.

Ownership itself needs no manifest change: the manifest contains no owner email. However, the new mailbox.org integration **does change the manifest**: use the latest supplied JSON, which replaces Google mail sending permission with **script.external_request**. Apps Script stays owned by Gmail but calls a private relay; the relay sends through mailbox.org as **TournStack <info@tournstack.com>**.

Keep the original spreadsheet available until the new setup has been tested. Copying a Sheet does not migrate a previous web app deployment automatically.

Google references: [bound script ownership and copying](https://developers.google.com/apps-script/guides/bound), [web app deployment and execution identity](https://developers.google.com/apps-script/guides/web), [manifest settings](https://developers.google.com/apps-script/concepts/manifests).

## One-time deployment

The Cloudflare Worker is deployed and its three secret names are configured. The handoff reports that **MAIL_RELAY_URL** and **MAIL_RELAY_TOKEN** are entered in **Project Settings → Script Properties**; confirm them there if relay calls fail. SMTP credentials stay in Cloudflare's secrets, not in Apps Script or the website. The Node SMTP relay remains an optional alternative if a server becomes available.

1. Open the Apps Script project linked above while signed into **mitja.mitrusevski@gmail.com**. Name the project **TournStack WEB Contacts**.
2. Replace the editor's default code with the complete contents of `Code.gs` in this folder. The new Contacts spreadsheet ID and email recipient are already included. If using another copy later, update `CONTACTS_SHEET_ID` to that copy's ID first.
3. In **Project Settings**, set the time zone to **Europe/Warsaw**. Enable **Show appsscript.json manifest file in editor** and replace that file with the latest supplied `appsscript.json` to declare spreadsheet and external-request permissions.
4. Select **setupContacts** and click **Run**. Google will ask the owning account to authorize spreadsheet access and external requests. Setup verifies the headers, formats timestamps and checks the private relay settings. Then run **verifyMailRelay** to check the live Worker and mailbox.org TLS/SMTP authentication without sending a test email. This verification is supported by the selected Cloudflare Worker.
5. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone** (including visitors without a Google account). Deploy. These permissions apply to the submission endpoint, not the spreadsheet. If your Workspace administrator prohibits anonymous web apps, use an approved hosted backend instead; do not make the Sheet public.
6. Copy the deployed URL ending in **/exec**. Put it into `contactEndpoint` in `assets/js/contact-config.js`, or send that URL back so it can be added to the website code. Use the deployment URL, not the editor URL or the test `/dev` URL.
7. Publish the configured website changes when ready. Submit one real test from **https://tournstack.com/contact.html**. Confirm the success message, a new Sheet row with a server timestamp, and the notification email.

No Google credentials, access tokens or secrets belong in the website repository. Until the endpoint URL is configured, the button remains disabled with a direct email alternative. This avoids showing a success message for data that was never saved.

## Submission behavior

The server validates Name, Email and Inquiry, appends a row under a concurrency lock, then submits the two email jobs to the authenticated relay. Column A is a real server-side date formatted `yyyy-mm-dd hh:mm:ss`, displayed in Europe/Warsaw time. Columns B–D store literal text; formula-like input is escaped. A retry with the same submission ID is deduplicated for up to six hours. A honeypot rejects basic automated form fills; it is not a substitute for monitoring a public endpoint.

The notification is plain text, sent to **info@tournstack.com** with the visitor's address as Reply-To:

```text
Subject: New Contact

Name: [Name]
Email: [Email]
Inquiry: [Inquiry]
```

The data remains in Contacts if relay submission or SMTP sending fails. Review **Apps Script → Executions** for relay submission failures and the relay host's queue for SMTP failures. A successful form receipt means the inquiry was saved; it does not guarantee inbox delivery. If the relay did not accept the jobs, Apps Script does not automatically retry them; follow up from the saved Sheet record. The relay retries transient SMTP failures after it has durably accepted jobs.

The visitor also receives the personalized branded confirmation from **TournStack <info@tournstack.com>**, with Reply-To **info@tournstack.com**. Its logo contains the agreed confirmation-email UTMs. See the Cloudflare setup for the template, operational caps and delivery verification.

The website uses a native POST into a hidden iframe. The Google receipt returns only success/failure and a random submission ID through `postMessage`. The browser checks the Google origin and the pending ID before acknowledging receipt. No visitor details or sheet contents appear in that receipt. If no receipt arrives within 45 seconds, the form preserves the input and explains that receipt could not be confirmed.

The allowed website origins are `https://tournstack.com` and `https://www.tournstack.com`. Local previews do not submit by default. To test another real domain, add its exact origin to `ALLOWED_ORIGINS`, deploy a new version and verify it there.

## Maintenance

After changing server code, use **Deploy → Manage deployments → Edit → New version → Deploy** to keep the same endpoint URL. Changing only website CSS or copy does not require a new Apps Script version. Keep the spreadsheet ID, WEB Contacts tab and headers stable. Timestamp storage and email delivery have been verified with local service mocks; live Google execution and inbox delivery require the deployment test above.

Primary documentation: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [URL Fetch](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [HtmlService iframe restrictions](https://developers.google.com/apps-script/guides/html/restrictions), [HtmlOutput framing](https://developers.google.com/apps-script/reference/html/html-output).
