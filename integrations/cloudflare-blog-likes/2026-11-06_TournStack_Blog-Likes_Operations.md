---
project: TournStack
doc_type: Blog likes operations
date: "2026-11-06"
updated: "2026-11-06"
version: "0.1.1"
status: Implemented; deployment verified separately
language: en
timezone: Europe/Ljubljana
owner_role: Website maintainer
---

# Shared Blog likes

The owner requested a shared public count without sign-in. This isolated Worker
serves only `https://tournstack.com/api/blog-likes/<content_id>` and uses its own D1
database. It does not change Niko, contact forms, email or analytics. The static
article remains readable when likes are unavailable; no fabricated zero is shown.

## Verified service deployment ? 2026-11-06

Worker version `e0922c25-2a27-45b5-a010-d48e4a70e531` is deployed on the isolated first-party route. D1 `8c332061-f90f-4fca-9554-dc0ff1411e6b` was created with EU jurisdiction and the schema applied. Live GET, repeated Like/unlike, foreign-origin and unknown-article checks passed; the controlled test restored the initial zero count. Website exposure is verified separately in the website release record.

## State and privacy

The frontend creates a random 256-bit reference only after a reader deliberately
uses Like. It stores the reference in first-party localStorage under
`ts-blog-like:<content_id>` for 180 days; it is specific to one article. D1 stores
only the SHA-256 of the article/reference pair, article ID, liked state and expiry.
The reference lets the browser undo its like and makes repeat requests idempotent.
Expiry is fixed at the first request and does not extend on each visit. A daily
cleanup removes expired references while preserving the aggregate count. Aggregate
totals have no reader identifiers and remain for the article's lifetime. Backups
follow the separately configured Cloudflare D1 recovery retention.

No reference is created merely to read a count. No advertising cookie, cross-site
tracker, fingerprint, raw address or user agent is saved in this application's
database or logs. The Worker hashes the platform-provided address with the UTC day
solely for transient rate limiting. Request/invocation logging is disabled.
Cloudflare still handles normal network traffic according to its platform policy.
When localStorage is unavailable, the current tab retains the reference in memory.

Counts are not verified unique people: another browser, deleted storage, expired
references or a determined client can submit another like. The service does not
claim otherwise. Clearing localStorage removes the ability to undo the earlier
like. After 180 days, the aggregate remains but the expired reference can no longer
remove it. No names, email addresses or comments are requested by this feature. Treat the stored references as pseudonymous operational records.

Publish the relevant disclosure in the site's privacy/storage explanation. The
functional reference serves the reader's explicit Like action; do not repurpose it
for marketing, profiling or attribution. Any broader use needs a separate review
of purpose, consent and retention.

## Integrity and abuse controls

Only identities in `PUBLISHED_ARTICLE_IDS` and `article_counts` are accepted. Both
the allowlist and registration are required. PUT takes only `{ "liked": true }`
or `{ "liked": false }`; a browser cannot supply a count. A transaction containing
the unique-key upsert and aggregate triggers changes a count exactly once per
state transition. Retries retain their original intent if a response is lost.

PUT requires the exact production Origin, same-origin fetch context when present,
JSON, a well-formed token and a body no larger than 256 bytes. No CORS grants are
issued. GET is read-only and returns public count plus the requesting token's
state. Responses are no-store. Missing bindings or database failures return 503,
never a successful save or made-up count.

Workers rate-limit bindings apply separate read, mutation and token limits. The
address-level safety limit can affect readers sharing a network; the limits are
intentionally tolerant and the UI invites retry. These counters are approximate
and per Cloudflare location, not a global hard budget or proof against automated
voting. Monitor actual use and adjust narrowly if needed.

## Deployment and maintenance

1. Verify the account and existing routes. Create the isolated
   `tournstack-blog-likes` D1 database; replace the configuration's database-ID
   placeholder with its actual ID. Confirm rate-limit namespaces 600601–600603
   do not conflict with another account feature.
2. Apply `schema.sql` to that database. It is repeatable and registers only the
   first approved content ID. Never apply it to a chatbot or contact database.
3. Deploy this Worker and exact first-party route through the normal approved
   release. `workers_dev` and observability are disabled. The expiry cron is
   isolated from the indexer and website publication scheduler.
4. Verify readback, count, origin denial and unknown-ID rejection. If a controlled
   write test is authorized, use one random test token, then remove its like with
   the same token and confirm the original count. Do not manipulate real votes.
5. Record the Worker version and database identity with the website release.
   The webpage's initial HTML contains no invented count. Counts load after the
   page load event and only when the button is near the viewport; changes require
   a click. Staging disables this service before making requests.

For a future published article, insert its immutable `content_id` in
`article_counts` and add it to the Worker allowlist as part of that article's
approved release. Removing an ID from the allowlist stops access; it does not
delete its aggregate/history. Do not reuse an ID for another article. A rollback
must preserve the database and its votes; redeploy a verified compatible Worker
version rather than resetting counts.

## Verification

```text
node --test integrations/cloudflare-blog-likes/worker.test.mjs
py integrations/cloudflare-blog-likes/browser.test.py
```

The Worker suite uses real SQLite triggers and tests concurrent duplicate likes,
unlikes, distinct readers, unknown IDs, origin/body/token limits, unavailable
storage, rollback and expiry without lost totals. The browser suite fulfills every
request locally and tests lazy loading, no pre-interaction identifier, synchronized
states, unlike, disconnected staging, unavailable-count feedback and lost-response
retry. It never submits a production vote. The browser test needs the project's
existing Playwright/Chrome installation; SQLite tests use Node's built-in SQLite.

Implementation references checked on 6 November 2026:
[D1 batch operations](https://developers.cloudflare.com/d1/worker-api/d1-database/)
and [Workers rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
