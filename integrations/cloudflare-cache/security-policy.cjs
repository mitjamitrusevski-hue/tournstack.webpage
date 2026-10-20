// Generates reviewed Cloudflare response-header configuration, never calls a cloud API.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT_FILES} = require('../../scripts/public-artifact.cjs');
const BASELINE_REF = 'tournstack_browser_security_baseline';
const CANDIDATE_REF = 'tournstack_strict_csp_observation';
const GOOGLE_FORMS = 'https://script.google.com https://script.googleusercontent.com https://*.googleusercontent.com';
function inlineHashes(root) {
  const hashes = new Set();
  for (const name of ROOT_FILES.filter(x => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n?/g, '\n');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (/\bsrc\s*=/i.test(match[1])) continue;
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1]?.toLowerCase();
      if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) continue;
      if (match[2].trim()) hashes.add("'sha256-" + crypto.createHash('sha256').update(match[2]).digest('base64') + "'");
    }
  }
  return [...hashes].sort();
}
function policy(root) {
  // Enforced baseline is deliberately independent of script-provider compatibility.
  const baseline = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' " + GOOGLE_FORMS;
  const candidate = [
    "default-src 'self'",
    "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "script-src 'self' " + inlineHashes(root).join(' ') + ' https://cdn-cookieyes.com https://plausible.io https://challenges.cloudflare.com https://connect.facebook.net https://snap.licdn.com',
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://cdn-cookieyes.com",
    "font-src 'self'",
    "img-src 'self' data: https://cdn-cookieyes.com https://www.facebook.com https://www.linkedin.com https://px.ads.linkedin.com https://px4.ads.linkedin.com https://p.adsymptotic.com",
    "connect-src 'self' https://plausible.io https://*.cookieyes.com https://cdn-cookieyes.com https://www.facebook.com https://www.linkedin.com https://px.ads.linkedin.com https://px4.ads.linkedin.com https://challenges.cloudflare.com",
    "frame-src " + GOOGLE_FORMS + ' https://challenges.cloudflare.com https://www.facebook.com https://www.linkedin.com https://tournstack-public-chat.tournstack.workers.dev',
    "form-action 'self' " + GOOGLE_FORMS,
    "worker-src 'none'"
  ].join('; ');
  return {baseline, candidate};
}
function securityRules(root) {
  const {baseline, candidate} = policy(root);
  const expression = '(http.host in {"tournstack.com" "www.tournstack.com"} and ssl)';
  const set = value => ({operation: 'set', value});
  return [{
    ref: BASELINE_REF,
    description: 'Website browser protections; local prepared configuration, activate separately after review',
    expression,
    action: 'rewrite',
    action_parameters: {headers: {
      'content-security-policy': set(baseline),
      'strict-transport-security': set('max-age=86400'),
      'x-content-type-options': set('nosniff'),
      'x-frame-options': set('DENY'),
      'referrer-policy': set('strict-origin-when-cross-origin'),
      'permissions-policy': set('camera=(), microphone=(), geolocation=(), usb=(), payment=()')
    }},
    enabled: true
  }, {
    ref: CANDIDATE_REF,
    description: 'Strict CSP candidate, observation only until real vendor and nested form checks pass',
    expression: expression.slice(0, -1) + ' and (http.request.uri.path eq "/" or ends_with(http.request.uri.path, ".html")))',
    action: 'rewrite',
    action_parameters: {headers: {'content-security-policy-report-only': set(candidate)}},
    enabled: true
  }];
}
function updateRules(existing, root) {
  const untouched = existing.rules.filter(rule => ![BASELINE_REF, CANDIDATE_REF].includes(rule.ref));
  return {...existing, rules: [...untouched, ...securityRules(root)]};
}
function browserHeaders(root, strict = false) {
  const rules = securityRules(root);
  const headers = Object.fromEntries(Object.entries(rules[0].action_parameters.headers).map(([name, value]) => [name, value.value]));
  if (strict) headers['content-security-policy'] = policy(root).candidate;
  else headers['content-security-policy-report-only'] = policy(root).candidate;
  return headers;
}
module.exports = {inlineHashes, policy, securityRules, updateRules, browserHeaders};
if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  const filename = path.join(__dirname, 'response-header-rules.json');
  const before = fs.readFileSync(filename, 'utf8');
  const after = JSON.stringify(updateRules(JSON.parse(before), root), null, 2) + '\n';
  if (process.argv[2] === '--check') {
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(JSON.parse(after))) throw Error('Security header configuration is stale. Review changed inline code, then run security-policy.cjs --write.');
    console.log('Security header policy matches current inline scripts; strict CSP remains report-only.');
  } else if (process.argv[2] === '--write') {
    fs.writeFileSync(filename, after);
    console.log('Prepared local Cloudflare rules; no remote changes made.');
  } else throw Error('Usage: node integrations/cloudflare-cache/security-policy.cjs --check | --write');
}
