'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guard = require('./approved-release.cjs');
const reviewContract = require('./release-review.cjs');
const NOW = Date.parse('2030-01-01T09:00:00Z');
const CANDIDATE = 'a'.repeat(40), BASE = 'b'.repeat(40), PUBLIC = 'c'.repeat(64);
const REPO = 'mitjamitrusevski-hue/tournstack.webpage';
const env = (overrides = {}) => ({RELEASE_ID: 'release-20300101T090000Z-0123abcd',
  RELEASE_CANDIDATE_SHA: CANDIDATE, RELEASE_CANDIDATE_REF: 'release/release-20300101T090000Z-0123abcd',
  RELEASE_EXPECTED_BASE_SHA: BASE, RELEASE_PUBLIC_DIGEST: PUBLIC, RELEASE_APPROVAL_DIGEST: 'd'.repeat(64),
  RELEASE_NOT_AFTER: '2030-01-02T10:00:00+01:00', GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: REPO, GITHUB_TOKEN: 'fixture-token',
  GITHUB_RUN_ID: '123', ...overrides});
const response = (status, value) => ({status, text: async () => typeof value === 'string' ? value : JSON.stringify(value)});
const live = (sha = BASE) => async url => {
  if (url.startsWith('https://tournstack.com/release-identity.json?release_check=')) return response(200, {release_id: 'previous', candidate_sha: sha, public_digest: PUBLIC});
  if (url.includes('/deployments?')) return response(200, [{id: 8, environment: 'github-pages', created_at: '2030-01-01T07:00:00Z', sha: BASE}]);
  if (url.includes('/deployments/8/statuses')) return response(200, [{state: 'success'}]);
  throw Error('Unexpected baseline request');
};
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(__dirname, '.approved-release-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Approved</h1>');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'a.txt'), 'image');
  return dir;
}
function reviewed(t, publicDigest) {
  const dir = fs.mkdtempSync(path.join(__dirname, '.approved-review-test-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const checks = Object.fromEntries(['content_brand', 'source_parity', 'accessibility_visual', 'recovery_package',
    'external_destinations', 'live_service_scope'].map(key => [key, {result: 'PASS', evidence_sha256: 'f'.repeat(64), reason_code: ''}]));
  fs.writeFileSync(path.join(dir, 'release-review.json'), JSON.stringify({schema_version: 2,
    review_id: 'TS-REVIEW-20300101-1234abcd', reviewer_role: 'website-maintainer', public_digest: publicDigest, checks}, null, 2) + '\n');
  return dir;
}

test('requires complete input identity and main workflow dispatch', () => {
  assert.equal(guard.inputs(env(), NOW).candidate_sha, CANDIDATE);
  for (const values of [{RELEASE_APPROVAL_DIGEST: ''}, {RELEASE_PUBLIC_DIGEST: 'short'},
    {RELEASE_ID: '../escape'}, {RELEASE_CANDIDATE_REF: 'main'}, {GITHUB_REF: 'refs/heads/other'},
    {GITHUB_EVENT_NAME: 'push'}, {GITHUB_REPOSITORY: 'different/repo'}, {RELEASE_CANDIDATE_SHA: 'abc'}]) {
    assert.throws(() => guard.inputs(env(values), NOW));
  }
});

test('deadline enforces real calendar, explicit timezone and future time', () => {
  assert.equal(guard.deadline('2030-01-01T10:01:00+01:00', NOW), NOW + 60000);
  for (const value of ['2030-02-30T12:00:00Z', '2030-01-01T09:00:00',
    '2030-01-01T09:00:00Z', '2030-01-02T24:00:00Z', '2030-01-02T10:00:00+15:00']) {
    assert.throws(() => guard.deadline(value, NOW));
  }
});

test('trusted main controls must equal all frozen publication control files byte for byte', t => {
  const root = fixture(t), trusted = path.resolve(__dirname, '..');
  const controls = ['scripts/approved-release.cjs', 'scripts/release-review.cjs', '.github/workflows/approved-release.yml', '.github/workflows/pages.yml'];
  for (const relative of controls) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(trusted, relative), destination);
  }
  guard.verifyControls(root, trusted);
  for (const relative of controls) {
    const filename = path.join(root, relative), original = fs.readFileSync(filename);
    fs.appendFileSync(filename, '\n# changed control\n');
    assert.throws(() => guard.verifyControls(root, trusted), /differ from the exact reviewed candidate/);
    fs.writeFileSync(filename, original);
  }
  fs.unlinkSync(path.join(root, controls[0]));
  assert.throws(() => guard.verifyControls(root, trusted), /missing or invalid/);
});

test('canonical artifact digest matches compact sorted-key JSON and excludes generated identity', t => {
  const root = fixture(t), result = guard.manifest(root);
  const expected = result.entries.map(item => ({path: item.path, sha256: item.sha256, size_bytes: item.size_bytes}));
  assert.equal(result.digest, guard.hash(JSON.stringify(expected)));
  assert.deepEqual(result.entries.map(item => item.path), ['assets/a.txt', 'index.html']);
  fs.writeFileSync(path.join(root, 'release-identity.json'), '{}');
  assert.equal(guard.manifest(root).digest, result.digest);
  fs.writeFileSync(path.join(root, 'assets', 'a.txt'), 'changed');
  assert.notEqual(guard.manifest(root).digest, result.digest);
});

test('live identity remains authoritative after checking for unresolved Pages deployments', async () => {
  const result = await guard.currentBaseline({fetcher: live(), token: 'fixture-token', now: NOW});
  assert.equal(result.sha, BASE);
  assert.equal(result.basis, 'public-release-identity');
});

test('malformed identity, denied access or timeout never fall back to legacy deployment', async () => {
  for (const fetcher of [async () => response(403, {}), async () => response(200, '<html>oops</html>'),
    async () => response(200, {candidate_sha: BASE}), async () => {throw Error('fixture failure');}]) {
    await assert.rejects(guard.currentBaseline({fetcher, token: 'fixture-token', now: NOW}));
  }
});

test('first bootstrap selects actual successful Pages deployment, not a validation run', async () => {
  const urls = [];
  const fetcher = async url => {
    urls.push(url);
    if (url.startsWith('https://tournstack.com')) return response(404, {});
    if (url.includes('/deployments?')) return response(200, [
      {id: 9, environment: 'github-pages', created_at: '2030-01-01T08:00:00Z', sha: CANDIDATE},
      {id: 8, environment: 'github-pages', created_at: '2030-01-01T07:00:00Z', sha: BASE}
    ]);
    if (url.includes('/deployments/9/statuses')) return response(200, [{state: 'failure'}]);
    if (url.includes('/deployments/8/statuses')) return response(200, [{state: 'success'}]);
    throw Error('Unexpected request');
  };
  const result = await guard.currentBaseline({fetcher, token: 'fixture-token', now: NOW});
  assert.equal(result.sha, BASE);
  assert.equal(result.deployment_id, 8);
  assert(urls.every(url => !url.includes('/actions/')));
});

test('bootstrap and an existing live marker both hold another pending deployment, allowing only this verified run', async () => {
  const fetcher = (run, hasMarker) => async url => {
    if (url.startsWith('https://tournstack.com')) return hasMarker ? response(200, {release_id: 'previous', candidate_sha: BASE, public_digest: PUBLIC}) : response(404, {});
    if (url.includes('/deployments?')) return response(200, [
      {id: 9, environment: 'github-pages', created_at: '2030-01-01T08:00:00Z', sha: CANDIDATE},
      {id: 8, environment: 'github-pages', created_at: '2030-01-01T07:00:00Z', sha: BASE}
    ]);
    if (url.includes('/deployments/9/statuses')) return response(200, [{state: 'in_progress', log_url: `https://github.com/${REPO}/actions/runs/${run}/job/1`}]);
    return response(200, [{state: 'success'}]);
  };
  for (const hasMarker of [false, true]) {
    await assert.rejects(guard.currentBaseline({fetcher: fetcher('999', hasMarker), token: 'fixture-token', now: NOW, runID: '123'}), /unresolved/);
    const result = await guard.currentBaseline({fetcher: fetcher('123', hasMarker), token: 'fixture-token', now: NOW, runID: '123'});
    assert.equal(result.sha, BASE);
    assert.equal(result.basis, hasMarker ? 'public-release-identity' : 'successful-pages-deployment');
  }
});

test('baseline mismatch blocks before writing release identity', async t => {
  const root = fixture(t);
  await assert.rejects(guard.check('validate', root, root, {env: env(), now: NOW,
    fetcher: live('e'.repeat(40)), checkCandidate() {}}), /Production advanced/);
  assert(!fs.existsSync(path.join(root, 'release-identity.json')));
});

test('artifact mismatch blocks even with matching source and baseline', async t => {
  const root = fixture(t), candidate = reviewed(t, PUBLIC);
  await assert.rejects(guard.check('validate', candidate, root, {env: env(), now: NOW,
    fetcher: live(), checkCandidate() {}}), /approved digest/);
  assert(!fs.existsSync(path.join(root, 'release-identity.json')));
});

test('validation emits only deterministic public identity and recheck catches drift', async t => {
  const root = fixture(t), publicDigest = guard.manifest(root).digest, candidate = reviewed(t, publicDigest);
  const options = {env: env({RELEASE_PUBLIC_DIGEST: publicDigest}), now: NOW, fetcher: live(), checkCandidate() {}};
  assert.equal((await guard.check('validate', candidate, root, options)).result, 'pass');
  const identity = JSON.parse(fs.readFileSync(path.join(root, 'release-identity.json'), 'utf8'));
  assert.deepEqual(Object.keys(identity).sort(), ['candidate_sha', 'public_digest', 'release_id']);
  assert.equal((await guard.check('recheck', candidate, root, options)).result, 'pass');
  await assert.rejects(guard.check('recheck', candidate, root, {...options, fetcher: live('f'.repeat(40))}), /Production advanced/);
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>Unreviewed</h1>');
  await assert.rejects(guard.check('recheck', candidate, root, options), /approved digest/);
});

test('human review binds the public digest and every required factual and operational check', t => {
  const root = reviewed(t, PUBLIC), filename = path.join(root, 'release-review.json');
  const original = JSON.parse(fs.readFileSync(filename, 'utf8'));
  guard.verifyReview(root, PUBLIC);
  const mutations = [value => {value.public_digest = 'e'.repeat(64);}, value => {value.reviewer_role = '';},
    value => {delete value.checks.recovery_package;}, value => {value.checks.source_parity.result = 'NOT_APPLICABLE';},
    value => {value.checks.accessibility_visual.result = 'FAIL';}, value => {value.checks.content_brand.evidence_sha256 = ' ';},
    value => {value.schema_version = 1;}, value => {value.review_id = 'TS-REVIEW-20300230-1234abcd';},
    value => {value.review_id = [value.review_id];}, value => {value.checks.content_brand.evidence_sha256 = ['f'.repeat(64)];}];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
    assert.throws(() => guard.verifyReview(root, PUBLIC));
  }
  const scoped = structuredClone(original);
  for (const key of ['external_destinations', 'live_service_scope']) {
    scoped.checks[key].result = 'NOT_APPLICABLE';
    scoped.checks[key].reason_code = reviewContract.NA[key];
  }
  fs.writeFileSync(filename, JSON.stringify(scoped, null, 2) + '\n');
  guard.verifyReview(root, PUBLIC);
  fs.unlinkSync(filename);
  assert.throws(() => guard.verifyReview(root, PUBLIC), /missing, invalid/);
});

test('public review rejects private free text and unknown fields without logging their values', t => {
  const root = reviewed(t, PUBLIC), filename = path.join(root, 'release-review.json');
  const original = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const privateValue = 'private.person@example.test C:\\private\\owner-approval.txt';
  const mutations = [value => {value.reviewer = privateValue;}, value => {value.review_reference = privateValue;},
    value => {value.reviewer_role = privateValue;}, value => {value.checks.content_brand.evidence = privateValue;},
    value => {value.checks.content_brand.evidence_sha256 = privateValue;},
    value => {value.checks.content_brand.reason_code = privateValue;}, value => {value.checks.private_note = privateValue;}];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');
    assert.throws(() => guard.verifyReview(root, PUBLIC), error => !error.message.includes(privateValue));
  }
  fs.writeFileSync(filename, JSON.stringify(original, null, 2).replace('"schema_version": 2,', '"schema_version": "private",\n  "schema_version": 2,') + '\n');
  assert.throws(() => guard.verifyReview(root, PUBLIC), /canonical/);
});

test('draft status is storable but blocks publication and scope reasons cannot transfer between checks', t => {
  const root = reviewed(t, PUBLIC), filename = path.join(root, 'release-review.json');
  const draft = JSON.parse(fs.readFileSync(filename, 'utf8'));
  for (const row of Object.values(draft.checks)) Object.assign(row, {result: 'NOT_TESTED', evidence_sha256: '', reason_code: ''});
  fs.writeFileSync(filename, JSON.stringify(draft, null, 2) + '\n');
  assert.equal(reviewContract.readReview(filename, PUBLIC, {requireComplete: false}).review_id, draft.review_id);
  assert.throws(() => guard.verifyReview(root, PUBLIC), /untested/);
  draft.checks.external_destinations = {result: 'NOT_APPLICABLE', evidence_sha256: 'a'.repeat(64), reason_code: 'no-live-service-changes'};
  assert.throws(() => reviewContract.validateReview(draft, PUBLIC, {requireComplete: false}), /Invalid scope exclusion/);
  draft.checks.external_destinations.reason_code = 'no-external-link-changes';
  draft.checks.source_parity = {...draft.checks.external_destinations};
  assert.throws(() => reviewContract.validateReview(draft, PUBLIC, {requireComplete: false}), /Invalid scope exclusion/);
});

test('public-safe review attestation stays outside website output and accidental export is blocked', t => {
  assert.equal(require('./public-artifact.cjs').allowed('release-review.json'), false);
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'release-review.json'), '{"private":"review"}');
  assert.throws(() => guard.manifest(root), /must not be exported/);
});

test('fresh release window and candidate SHA are rechecked at activation', async t => {
  const root = fixture(t), publicDigest = guard.manifest(root).digest;
  const options = {env: env({RELEASE_PUBLIC_DIGEST: publicDigest}), now: NOW, fetcher: live(), checkCandidate() {throw Error('Wrong exact candidate');}};
  await assert.rejects(guard.check('preflight', root, root, options), /Wrong exact candidate/);
  await assert.rejects(guard.check('recheck', root, root, {...options, checkCandidate() {}, now: Date.parse('2030-01-03T00:00:00Z')}), /expired/);
});

test('ordinary workflow cannot deploy; release workflow uses pinned actions and serialized recheck', () => {
  const workflows = path.resolve(__dirname, '../.github/workflows');
  const ordinary = fs.readFileSync(path.join(workflows, 'pages.yml'), 'utf8');
  const approved = fs.readFileSync(path.join(workflows, 'approved-release.yml'), 'utf8');
  assert(!ordinary.includes('deploy-pages@'));
  assert(!ordinary.includes('pages: write'));
  assert.match(approved, /run-name: Approved release \$\{\{ inputs\.release_id \}\}/);
  assert.match(approved, /group: website-pages\s+cancel-in-progress: false/);
  assert(approved.indexOf('approved-release.cjs recheck') < approved.indexOf('uses: actions/deploy-pages@'));
  assert(approved.includes('node scripts/public-artifact.cjs _site'));
  assert(!approved.includes('public-artifact.cjs --preview'));
  for (const line of approved.split('\n').filter(line => line.includes('uses: actions/'))) assert.match(line, /@[a-f0-9]{40}\b/);
});
