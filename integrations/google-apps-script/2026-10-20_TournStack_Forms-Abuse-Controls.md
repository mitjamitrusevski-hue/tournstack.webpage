---
project: TournStack
doc_type: Website form security implementation and deployment handoff
date: "2026-10-20"
updated: "2026-10-20"
version: "0.1.0"
status: Local candidate; not deployed
language: en
timezone: Europe/Ljubljana
owner_role: Website maintainer
---

# Public form abuse controls

The owner authorised local security fixes and verification. These changes are prepared in source only. They do not change live services, secrets, account permissions, subscriber/contact retention, mail schedules or public chatbot activation.

## Application allowances

These are application defaults, not provider quotas or a promise that shared free-tier allowances cannot be exhausted.

| Boundary | Allowance | State and reset |
|---|---|---|
| Public contact, newsletter signup and email-only unsubscribe request: verification attempts | 120 per UTC minute; 3,000 per UTC day | One fixed-size numeric Script Properties record, updated under ScriptLock |
| Successfully verified public form intakes | 200 per UTC day across those forms | Same numeric record; independent of mail acceptance |
| Newsletter confirmation actions | 60 per UTC minute; 1,000 per UTC day | Existing mail Durable Object; independent from unsubscribe |
| Newsletter unsubscribe actions | 60 per UTC minute; 1,000 per UTC day | Existing mail Durable Object; independent from confirmation |
| One signed newsletter token | Five backend actions per UTC minute | SHA-256 token digest only; no raw token or address persisted |
| Existing mail queue | Unchanged: 100 requests per rolling day; three confirmations per address per rolling day | Existing queue and retention |

Malformed fields, missing/oversized proof tokens and reported request bodies larger than 65,536 bytes are rejected before external verification. This allows URL-encoded Unicode within the existing 5,000-character inquiry limit. The authenticated JSON mail relay retains its separate 32,768-byte bound. Google has already parsed an Apps Script web-app event before invoking `doPost`; the body check cannot prevent that platform work.

The intake allowance protects URL-fetch and Sheet work. A mail cap or relay outage still does not discard an already accepted contact record. A denied intake returns the existing failure receipt; it never reports a saved inquiry. The website's existing failure handling keeps entered text available for retry. The origin field and client IP are not used as trusted identities for these shared counters.

Properties, lock or counter corruption failures reject verification. The counter is created automatically on the first request by the candidate; no new secret or manual property setup is needed. Its name is `PUBLIC_FORM_ALLOWANCE_V1`. Do not delete it to reset an active limit.

## Newsletter replay and retry handling

The Worker still validates token format and purpose-bound HMAC before invoking its Durable Object. A forged link cannot reach Apps Script. GET remains read-only.

Concurrent requests for the same token share one in-flight backend operation. Confirmation success and terminal invalid/expired results are cached for 60 seconds. A cached or concurrent repeat cannot produce another successful-confirmation analytics event. A transport/storage failure is not treated as a terminal invalid link, and retries remain possible within the allowances.

Completed unsubscribe responses are never cached: another request checks actual subscription state, within the separate unsubscribe limits. The existing signed-link authentication, hashed Sheet tokens, single-use confirmation and subscriber status changes remain unchanged.

The guard stores at most 256 token-digest entries in one bounded record, alongside numeric counters. Expired entries are pruned during requests. They are logically inactive at expiry; physical pruning waits for the next request. No cleanup alarm or schedule is added. This abuse metadata is separate from the existing subscriber and mail-payload retention.

Limit responses are HTTP 429 with `Retry-After`; the page tells the visitor to reuse the same link after the stated minute/day pause. Backend/control failures return 503 with retry and contact guidance. There is no direct unguarded fallback to Apps Script.

## What these controls cannot guarantee

Anonymous requests still invoke the Google web app before these checks run. An attacker can consume Apps Script execution quota or deliberately use a shared allowance, temporarily delaying legitimate forms. Protecting that entry point more completely would require a separately reviewed architecture change; moving Niko's knowledge to MongoDB would not solve it.

The main website's Cloudflare rules do not cover direct requests to `script.google.com`. Mandatory Turnstile continues to protect accepted submissions, but bot detection is not an unlimited denial-of-service guarantee. Counter state is numeric; no new client-IP logging is introduced.

## Verification

Run from the website repository using Node 24 or newer:

```powershell
node --test integrations/cloudflare-mailbox/test/*.test.mjs integrations/google-apps-script/*.test.cjs integrations/mailbox-smtp/test/apps-script.test.mjs
```

The new cases cover invalid requests before external I/O, preverification and intake bounds, separate invocation state, lock contention, corruption/unavailable storage, UTC minute/day rollover, concurrent newsletter operations, idempotent analytics, replay caching, unsubscribe freshness, fail-closed retry pages and bounded metadata cleanup. Existing contact, newsletter, SMTP and queue tests remain part of the check.

These tests use in-memory fixtures. They do not submit a live form, send email, solve Turnstile or verify a deployed Google/Cloudflare version.

## Separate deployment requirements

1. Review the local diff and verification evidence. Deployment needs its own authorisation.
2. Package the canonical `integrations/cloudflare-mailbox` source with the reviewed Wrangler 4.151.2 toolchain and verify a dry run. The coordinating task owns the generated candidate bundle and its build evidence. Do not deploy the historical `Website/CloudflareMailWorker` recovery copy or an older generated bundle.
3. On authorised deployment, preserve the existing Worker name, binding, migration, secrets and queue. The additional public action method and HTTP caller must be promoted together.
4. Update both existing public Apps Script deployments to a reviewed new version containing the current `Code.gs` and `Newsletter.gs`. Preserve deployment URLs, manifest scopes, private settings and the existing Sheet.
5. Check deployed version/source identity and reject-path behaviour. Any positive submission/email test requires explicit test authority and a controlled address; source or offline-test success does not establish live delivery.
6. Preserve counters when rolling forward. Rollback must retain protected Turnstile/contact versions; never restore an old verification bypass. Subscriber status and retention are not reset.

The optional Node SMTP alternative runtime and separate historical `Website/CloudflareMailWorker` recovery copy remain unchanged. The coordinating security task rebuilt the canonical `integrations/cloudflare-mailbox/deploy` candidate; its exact hash and dry-run evidence are recorded in the combined security report. The alternative relay's shared Apps Script test fixture was updated for the same validation boundary.
