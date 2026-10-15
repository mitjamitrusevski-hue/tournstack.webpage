# Cloudflare website caching

Updated 2026-10-15: website proxy and cache/header rules are active and HTTP-verified. GitHub Pages remains origin; GoDaddy remains registrar. Cloudflare authoritative nameservers are aitana.ns.cloudflare.com and tim.ns.cloudflare.com. Apex/www are proxied; demo, indexer and other service/mail records remain DNS-only.

## Developer documentation

The [developer runbook](RUNBOOK.md) is the current maintenance entry point. It records:

- Canonical assets, content hashing, manifest generation and GitHub Actions publishing.
- Exact deployed cache and response-header rules, ordering and policy boundaries.
- Complete DNS migration sequence, TLS activation and automatic certificate renewal.
- Verification evidence, unresolved measurement limits and troubleshooting.
- Access requirements, rollback and references to dated project history.

[cache-rules.json](cache-rules.json) and [response-header-rules.json](response-header-rules.json) are configuration templates, not an automatic deployment integration. The dashboard settings were applied manually. Merge carefully into existing phases and preserve unrelated rules; template refs are not verified remote rule IDs.

The former preparation-only instructions on this page are superseded by the runbook. Historical preparation evidence remains in Marketing/WebPublishing/Operations/Releases; completed activation evidence is in Operations/DNS.
