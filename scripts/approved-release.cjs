'use strict';
// Publication guard. Network operations are read-only; deployment remains the
// pinned GitHub Pages action. Private approval authority stays with the publisher.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const {readReview} = require('./release-review.cjs');
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const REPOSITORY = 'mitjamitrusevski-hue/tournstack.webpage';
const LIVE_IDENTITY = 'https://tournstack.com/release-identity.json';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sortKeys = value => Array.isArray(value) ? value.map(sortKeys) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])])) : value;
const canonical = value => JSON.stringify(sortKeys(value));

function deadline(value, now = Date.now()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value || '');
  if (!match) throw Error('Publication deadline must be an ISO datetime with an explicit timezone.');
  const [, year, month, day, hour, minute, second, offset] = match;
  if (+year < 2000 || +month < 1 || +month > 12 || +day < 1 || +day > new Date(Date.UTC(+year, +month, 0)).getUTCDate() || +hour > 23 || +minute > 59 || +second > 59 ||
      (offset !== 'Z' && (+offset.slice(1, 3) > 14 || +offset.slice(4) > 59 || (+offset.slice(1, 3) === 14 && +offset.slice(4) !== 0)))) throw Error('Invalid calendar deadline.');
  const result = Date.parse(value);
  if (!Number.isFinite(result) || result <= now) throw Error('Approved publication window has expired.');
  return result;
}

function inputs(env = process.env, now = Date.now()) {
  const value = {release_id: env.RELEASE_ID, candidate_sha: env.RELEASE_CANDIDATE_SHA,
    candidate_ref: env.RELEASE_CANDIDATE_REF, expected_base_sha: env.RELEASE_EXPECTED_BASE_SHA,
    public_digest: env.RELEASE_PUBLIC_DIGEST, approval_digest: env.RELEASE_APPROVAL_DIGEST,
    not_after: env.RELEASE_NOT_AFTER};
  if (!ID.test(value.release_id || '') || value.release_id.includes('..')) throw Error('Invalid release identity.');
  if (!SHA.test(value.candidate_sha || '') || !SHA.test(value.expected_base_sha || '')) throw Error('Full lowercase commit identities are required.');
  if (!DIGEST.test(value.public_digest || '') || !DIGEST.test(value.approval_digest || '')) throw Error('Public and private approval receipt digests are required.');
  if (value.candidate_ref !== 'release/' + value.release_id) throw Error('Candidate must use its immutable release branch.');
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REPOSITORY !== REPOSITORY) throw Error('Approved publication must be dispatched from main in the intended repository.');
  deadline(value.not_after, now);
  return value;
}

function manifest(root) {
  root = path.resolve(root);
  if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw Error('Artifact must be a real directory.');
  const entries = [];
  const visit = directory => {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, item.name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error('Artifact links are forbidden.');
      if (stat.isDirectory()) { visit(file); continue; }
      if (!stat.isFile()) throw Error('Artifact must contain regular files.');
      const name = path.relative(root, file).split(path.sep).join('/');
      if (name === 'release-identity.json') continue;
      if (path.posix.basename(name) === 'release-review.json') throw Error('Release attestation must not be exported as website content.');
      const data = fs.readFileSync(file);
      entries.push({path: name, size_bytes: data.length, sha256: hash(data)});
    }
  };
  visit(root);
  entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!entries.length) throw Error('Public artifact is empty.');
  return {entries, digest: hash(canonical(entries))};
}

function candidate(root, expected) {
  let sha, dirty;
  try {
    sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
    dirty = cp.execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], {cwd: root, encoding: 'utf8'}).trim();
  } catch { throw Error('Candidate checkout identity could not be read.'); }
  if (sha !== expected) throw Error('Candidate ref does not match the approved commit.');
  if (dirty) throw Error('Tracked candidate inputs changed after checkout.');
  try {
    cp.execFileSync('git', ['ls-files', '--error-unmatch', '--', 'scripts/approved-release.cjs', 'scripts/release-review.cjs', '.github/workflows/approved-release.yml', '.github/workflows/pages.yml'], {cwd: root, stdio: 'pipe'});
  } catch { throw Error('Candidate must track the approved publication controls.'); }
  verifyControls(root);
}

function verifyControls(candidateRoot, controlsRoot = path.resolve(__dirname, '..')) {
  for (const relative of ['scripts/approved-release.cjs', 'scripts/release-review.cjs', '.github/workflows/approved-release.yml', '.github/workflows/pages.yml']) {
    let candidateBytes, trustedBytes;
    try {
      const candidatePath = path.join(candidateRoot, relative), trustedPath = path.join(controlsRoot, relative);
      for (const filename of [candidatePath, trustedPath]) {
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) throw Error();
      }
      candidateBytes = fs.readFileSync(candidatePath); trustedBytes = fs.readFileSync(trustedPath);
    } catch { throw Error('Trusted publication controls are missing or invalid.'); }
    if (!candidateBytes.equals(trustedBytes)) throw Error('Trusted publication controls differ from the exact reviewed candidate: ' + relative);
  }
}

async function responseJSON(url, {token, fetcher = fetch, limit = 2 * 1024 * 1024} = {}) {
  const headers = {'Accept': 'application/json', 'Cache-Control': 'no-cache', 'User-Agent': 'TournStack-ApprovedRelease'};
  if (token) Object.assign(headers, {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'});
  let response;
  try { response = await fetcher(url, {headers, redirect: 'error', signal: AbortSignal.timeout(25000)}); }
  catch { throw Error('Baseline verification request failed.'); }
  if (response.status === 404) return {missing: true};
  if (response.status !== 200) throw Error('Baseline verification returned HTTP ' + response.status + '.');
  const raw = await response.text();
  if (Buffer.byteLength(raw) > limit) throw Error('Baseline response exceeded its bound.');
  try { return {value: JSON.parse(raw)}; } catch { throw Error('Baseline response was not valid JSON.'); }
}

function thisRun(status, runID) {
  if (!/^\d+$/.test(runID || '')) return false;
  try {
    const url = new URL(status.log_url);
    return url.origin === 'https://github.com' &&
      (url.pathname === '/' + REPOSITORY + '/actions/runs/' + runID || url.pathname.startsWith('/' + REPOSITORY + '/actions/runs/' + runID + '/'));
  } catch { return false; }
}

async function currentBaseline({token, fetcher = fetch, now = Date.now(), runID} = {}) {
  const identity = await responseJSON(LIVE_IDENTITY + '?release_check=' + now, {fetcher, limit: 8192});
  let marker;
  if (!identity.missing) {
    const value = identity.value;
    if (!value || !SHA.test(value.candidate_sha || '') || !DIGEST.test(value.public_digest || '') || !ID.test(value.release_id || '')) throw Error('Live release identity is invalid.');
    marker = {sha: value.candidate_sha, basis: 'public-release-identity'};
  }
  // A served marker may still describe the previous release while another
  // Pages job is pending. Check activity before accepting either baseline.
  if (!token) throw Error('Baseline verification requires a GitHub deployments-read credential.');
  // First release bootstrap only. A successful validation workflow says nothing
  // about the deployed site; use actual github-pages deployments and statuses.
  const api = 'https://api.github.com/repos/' + REPOSITORY;
  const response = await responseJSON(api + '/deployments?environment=github-pages&per_page=100', {token, fetcher});
  if (response.missing || !Array.isArray(response.value)) throw Error('No verified Pages deployment baseline is available.');
  const deployments = response.value.filter(item => item.environment === 'github-pages' && item.transient_environment !== true)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  for (const deployment of deployments) {
    if (!Number.isSafeInteger(deployment.id) || !SHA.test(deployment.sha || '')) throw Error('Invalid Pages deployment identity.');
    const state = await responseJSON(api + '/deployments/' + deployment.id + '/statuses?per_page=10', {token, fetcher});
    if (state.missing || !Array.isArray(state.value) || !state.value.length) throw Error('Pages deployment status is unresolved.');
    const latest = state.value[0].state;
    if (['queued', 'pending', 'in_progress'].includes(latest)) {
      // An environment may register this very job before the Pages action. It is
      // not the previous live release. Never ignore a pending record by SHA alone.
      if (thisRun(state.value[0], runID)) continue;
      throw Error('Another Pages deployment is unresolved.');
    }
    if (latest === 'success') return marker || {sha: deployment.sha, basis: 'successful-pages-deployment', deployment_id: deployment.id};
    if (!['failure', 'error', 'inactive'].includes(latest)) throw Error('Unexpected Pages deployment status.');
  }
  throw Error('No successful Pages deployment baseline found in the bounded result.');
}

function identityFor(value) {
  return {release_id: value.release_id, candidate_sha: value.candidate_sha, public_digest: value.public_digest};
}

function verifyReview(root, publicDigest) {
  return readReview(path.join(root, 'release-review.json'), publicDigest);
}

function verifyArtifact(root, value, mode) {
  if (manifest(root).digest !== value.public_digest) throw Error('Public artifact does not match the approved digest.');
  const filename = path.join(root, 'release-identity.json'), expected = canonical(identityFor(value)) + '\n';
  if (mode === 'validate') fs.writeFileSync(filename, expected, {flag: 'wx'});
  else if (fs.readFileSync(filename, 'utf8') !== expected) throw Error('Public release identity changed.');
}

async function check(mode, candidateRoot, publicRoot, {env = process.env, fetcher = fetch, now = Date.now(), checkCandidate = candidate} = {}) {
  if (!['preflight', 'validate', 'recheck'].includes(mode)) throw Error('Unknown publication gate mode.');
  const value = inputs(env, now);
  checkCandidate(candidateRoot, value.candidate_sha);
  const baseline = await currentBaseline({token: env.GITHUB_TOKEN, fetcher, now, runID: env.GITHUB_RUN_ID});
  if (baseline.sha !== value.expected_base_sha) throw Error('Production advanced or differs from the approved base. Reconcile the candidate.');
  verifyReview(candidateRoot, value.public_digest);
  if (mode !== 'preflight') verifyArtifact(publicRoot, value, mode);
  // Network/build duration cannot silently consume the approved window.
  deadline(value.not_after, Math.max(now, Date.now()));
  return {release_id: value.release_id, candidate_sha: value.candidate_sha, public_digest: value.public_digest,
    approval_digest: value.approval_digest, baseline_basis: baseline.basis, result: 'pass', mode};
}

module.exports = {canonical, hash, deadline, inputs, manifest, candidate, verifyControls, currentBaseline, identityFor, verifyReview, verifyArtifact, check};
if (require.main === module) {
  const [mode, candidateRoot, publicRoot] = process.argv.slice(2);
  if (!mode || !candidateRoot || !publicRoot) { console.error('Usage: approved-release.cjs preflight|validate|recheck <candidate-root> <public-artifact>'); process.exitCode = 1; }
  else check(mode, path.resolve(candidateRoot), path.resolve(publicRoot)).then(result => console.log(JSON.stringify(result)), error => {
    // No token, response body or subprocess output is logged.
    console.error('Release held: ' + error.message); process.exitCode = 1;
  });
}
