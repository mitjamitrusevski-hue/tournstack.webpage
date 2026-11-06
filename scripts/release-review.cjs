'use strict';
// Public-safe attestation only. Private evidence and publication authority stay
// outside Git. Both the local gate and trusted CI controls use this validator.
const fs = require('node:fs');
const DIGEST = /^[a-f0-9]{64}$/;
const CHECKS = Object.freeze(['content_brand', 'source_parity', 'accessibility_visual',
  'external_destinations', 'live_service_scope', 'recovery_package']);
const ROLES = new Set(['website-maintainer', 'editorial-reviewer', 'project-owner']);
const RESULTS = new Set(['PASS', 'FAIL', 'NOT_TESTED', 'NOT_APPLICABLE']);
const NA = Object.freeze({external_destinations: 'no-external-link-changes',
  live_service_scope: 'no-live-service-changes'});

function exactKeys(value, keys, location) {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw Error('Unexpected or missing public review fields: ' + location);
  }
}

function validID(value) {
  if (typeof value !== 'string') return false;
  const match = /^TS-REVIEW-(\d{4})(\d{2})(\d{2})-[a-f0-9]{8}$/.exec(value || '');
  if (!match) return false;
  const [, year, month, day] = match;
  return +year >= 2000 && +month >= 1 && +month <= 12 && +day >= 1 &&
    +day <= new Date(Date.UTC(+year, +month, 0)).getUTCDate();
}

function validateReview(review, publicDigest, {requireComplete = true} = {}) {
  exactKeys(review, ['schema_version', 'review_id', 'reviewer_role', 'public_digest', 'checks'], 'record');
  if (review.schema_version !== 2) throw Error('Public review schema version 2 is required.');
  if (!validID(review.review_id)) throw Error('A valid opaque public review ID is required.');
  if (!ROLES.has(review.reviewer_role)) throw Error('An allowed reviewer role is required.');
  if (typeof review.public_digest !== 'string' || typeof publicDigest !== 'string' ||
      !DIGEST.test(review.public_digest) || !DIGEST.test(publicDigest) || review.public_digest !== publicDigest) {
    throw Error('Review does not match the exact public digest.');
  }
  exactKeys(review.checks, CHECKS, 'checks');
  for (const key of CHECKS) {
    const row = review.checks[key];
    exactKeys(row, ['result', 'evidence_sha256', 'reason_code'], key);
    if (!RESULTS.has(row.result)) throw Error('Invalid review result: ' + key);
    if (row.result === 'NOT_TESTED') {
      if (row.evidence_sha256 !== '' || row.reason_code !== '') throw Error('Untested review must not claim evidence: ' + key);
    } else {
      if (typeof row.evidence_sha256 !== 'string' || !DIGEST.test(row.evidence_sha256)) throw Error('Private evidence digest required: ' + key);
      if (row.result === 'NOT_APPLICABLE') {
        if (!Object.hasOwn(NA, key) || row.reason_code !== NA[key]) throw Error('Invalid scope exclusion: ' + key);
      } else if (row.reason_code !== '') throw Error('Only scope exclusions may have a reason code: ' + key);
    }
    if (requireComplete && row.result !== 'PASS' && row.result !== 'NOT_APPLICABLE') {
      throw Error('Required staging review is failed or untested: ' + key);
    }
  }
  return review;
}

function readReview(filename, publicDigest, options) {
  let review;
  try {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16384) throw Error();
    const raw = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
    review = JSON.parse(raw);
    // Enforce one unambiguous representation; duplicate keys and hidden values
    // must not disappear during parsing and then enter public Git history.
    if (raw !== JSON.stringify(review, null, 2) + '\n') throw Error();
  } catch { throw Error('Public review is missing, invalid, or not canonical two-space JSON.'); }
  return validateReview(review, publicDigest, options);
}

module.exports = {CHECKS, NA, validateReview, readReview};
if (require.main === module) {
  const [filename, publicDigest, mode] = process.argv.slice(2);
  try {
    if (!filename || !publicDigest || (mode && mode !== '--draft')) throw Error('Usage: release-review.cjs <record> <public-digest> [--draft]');
    const review = readReview(filename, publicDigest, {requireComplete: mode !== '--draft'});
    console.log(JSON.stringify({result: 'PASS', review}));
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
