import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker, {handle} from './worker.mjs';

const now = 1793934000;
const identity = 'a'.repeat(43);
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const run = statement => ({results: statement.query.all(...statement.values).map(row => ({...row}))});
  const calls = [];
  const env = {
    PUBLISHED_ARTICLE_IDS: 'TS-BLOG-0001',
    LIKES_DB: {
      prepare(sql) {return {query: sqlite.prepare(sql), values: [], bind(...values) {this.values = values; return this;}, async run() {return run(this);}};},
      async batch(statements) {
        sqlite.exec('BEGIN');
        try {const result = statements.map(run); sqlite.exec('COMMIT'); return result;}
        catch (error) {sqlite.exec('ROLLBACK'); throw error;}
      }
    },
    READ_LIMIT: {async limit(value) {calls.push(value); return {success: true};}},
    WRITE_LIMIT: {async limit(value) {calls.push(value); return {success: true};}},
    TOKEN_LIMIT: {async limit(value) {calls.push(value); return {success: true};}}
  };
  return {env, sqlite, calls};
}
function req(method = 'GET', {token, liked = true, body, path = 'TS-BLOG-0001', headers = {}} = {}) {
  return new Request(`https://tournstack.com/api/blog-likes/${path}`, {method,
    headers: {'CF-Connecting-IP': '192.0.2.1', 'Sec-Fetch-Site': 'same-origin',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(method === 'PUT' ? {'Origin': 'https://tournstack.com', 'Content-Type': 'application/json'} : {}), ...headers},
    ...(method === 'PUT' ? {body: body === undefined ? JSON.stringify({liked}) : body} : {})});
}
async function json(request, env, time = now) {const r = await handle(request, env, time); assert.equal(r.status, 200); return r.json();}

test('real SQLite triggers make replayed like/unlike atomic and non-negative', async () => {
  const {env, sqlite} = fixture();
  assert.equal((await json(req(), env)).count, 0);
  const votes = await Promise.all(Array.from({length: 20}, () => json(req('PUT', {token: identity}), env)));
  assert(votes.every(v => v.count === 1 && v.liked));
  const unlikes = await Promise.all(Array.from({length: 20}, () => json(req('PUT', {token: identity, liked: false}), env)));
  assert(unlikes.every(v => v.count === 0 && !v.liked));
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM article_votes').get().n, 1);
});
test('distinct readers increment once; state is per article and secret token is hashed', async () => {
  const {env, sqlite, calls} = fixture();
  await Promise.all(['a', 'b', 'c'].map(c => json(req('PUT', {token: c.repeat(43)}), env)));
  assert.equal((await json(req(), env)).count, 3);
  assert.equal((await json(req('GET', {token: identity}), env)).liked, true);
  const row = sqlite.prepare('SELECT * FROM article_votes LIMIT 1').get();
  assert.equal(row.token_hash.length, 64);
  assert.equal(JSON.stringify(row).includes(identity), false);
  assert(calls.every(call => /^[a-f0-9]{64}$/.test(call.key)));
});
test('unknown and unpublished IDs are rejected; a missing database registration cannot create one', async () => {
  const {env, sqlite} = fixture();
  assert.equal((await handle(req('PUT', {token: identity, path: 'TS-BLOG-9999'}), env, now)).status, 404);
  env.PUBLISHED_ARTICLE_IDS += ',TS-BLOG-0002';
  assert.equal((await handle(req('PUT', {token: identity, path: 'TS-BLOG-0002'}), env, now)).status, 404);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM article_votes').get().n, 0);
});
test('origin, method, payload and token checks fail closed', async () => {
  const {env} = fixture();
  const cases = [
    [req('PUT', {token: identity, headers: {Origin: 'https://evil.example'}}), 403],
    [req('PUT', {token: identity, headers: {Origin: ''}}), 403],
    [req('GET', {headers: {'Sec-Fetch-Site': 'cross-site'}}), 403],
    [req('POST'), 405],
    [req('PUT'), 400],
    [req('PUT', {token: 'x'}), 400],
    [req('PUT', {token: identity, body: '{"liked":true,"count":9000}'}), 400],
    [req('PUT', {token: identity, body: '{}'}), 400],
    [req('PUT', {token: identity, body: '{"liked":"true"}'}), 400],
    [req('PUT', {token: identity, body: 'x'.repeat(257)}), 413],
    [req('PUT', {token: identity, headers: {'Content-Type': 'text/plain'}}), 415],
    [req('GET', {path: 'TS-BLOG-0001?token=secret'}), 404]
  ];
  for (const [request, status] of cases) assert.equal((await handle(request, env, now)).status, status);
});
test('rate limit returns retry without database changes or identity disclosure', async () => {
  const {env, sqlite} = fixture();
  env.WRITE_LIMIT = {limit: async () => ({success: false})};
  const result = await handle(req('PUT', {token: identity}), env, now);
  assert.equal(result.status, 429); assert.equal(result.headers.get('Retry-After'), '60');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(sqlite.prepare('SELECT likes FROM article_counts').get().likes, 0);
});
test('database failure is honest 503, never fabricated zero or successful save', async () => {
  const {env} = fixture(); env.LIKES_DB.batch = async () => {throw new Error('private detail');};
  const result = await worker.fetch(req(), env);
  assert.equal(result.status, 503); assert.deepEqual(await result.json(), {error: 'temporarily_unavailable'});
});
test('expiry removes tokens but retains historical public totals', async () => {
  const {env, sqlite} = fixture();
  const vote = await json(req('PUT', {token: identity}), env);
  const expiry = now + 180 * 86400; assert.equal(vote.expires_at, expiry);
  await json(req('PUT', {token: identity}), env, now + 1000);
  assert.equal(sqlite.prepare('SELECT expires_at FROM article_votes').get().expires_at, expiry);
  assert.equal((await json(req('GET', {token: identity}), env, expiry)).liked, false);
  sqlite.prepare('DELETE FROM article_votes WHERE expires_at <= ?').run(expiry);
  assert.equal((await json(req(), env, expiry)).count, 1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM article_votes').get().n, 0);
});
test('transaction failure rolls back counters and token rows together', async () => {
  const {env, sqlite} = fixture();
  sqlite.exec("CREATE TRIGGER abort_vote BEFORE INSERT ON article_votes BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  const result = await worker.fetch(req('PUT', {token: identity}), env);
  assert.equal(result.status, 503);
  assert.equal(sqlite.prepare('SELECT likes FROM article_counts').get().likes, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM article_votes').get().n, 0);
});
