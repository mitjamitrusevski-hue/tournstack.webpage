const ORIGIN = 'https://tournstack.com';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const RETENTION_SECONDS = 180 * 24 * 60 * 60;
const MAX_BODY_BYTES = 256;

const response = (status, value, extra = {}) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra}
});
const failure = (status, error) => response(status, {error}, status === 429 ? {'Retry-After': '60'} : {});
async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
async function bodyJSON(request) {
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {await reader.cancel(); throw new RangeError();}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
}

export async function handle(request, env, now = Math.floor(Date.now() / 1000)) {
  const url = new URL(request.url);
  const match = /^\/api\/blog-likes\/(TS-BLOG-\d{4,})$/.exec(url.pathname);
  const allowed = new Set((env.PUBLISHED_ARTICLE_IDS || '').split(',').filter(Boolean));
  if (url.origin !== ORIGIN || !match || !allowed.has(match[1]) || url.search) return failure(404, 'not_found');
  const article = match[1];
  if (!['GET', 'PUT'].includes(request.method)) return response(405, {error: 'method_not_allowed'}, {Allow: 'GET, PUT'});
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== ORIGIN) || (site && !['same-origin', 'none'].includes(site))) return failure(403, 'origin_not_allowed');
  if (request.method === 'PUT' && origin !== ORIGIN) return failure(403, 'origin_required');
  const auth = request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if ((auth && (!token || !TOKEN.test(token))) || (request.method === 'PUT' && !token)) return failure(400, 'invalid_token');
  if (!env.LIKES_DB || !env.READ_LIMIT || !env.WRITE_LIMIT || !env.TOKEN_LIMIT) return failure(503, 'temporarily_unavailable');
  // The provider's short-lived rate-limit counters receive a daily-changing hash,
  // never a raw address. No request headers or browser identifiers are logged.
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return failure(503, 'temporarily_unavailable');
  const rateKey = await sha256(`${Math.floor(now / 86400)}|${ip}`);
  const limit = request.method === 'PUT' ? env.WRITE_LIMIT : env.READ_LIMIT;
  if (!(await limit.limit({key: rateKey})).success) return failure(429, 'try_again_later');
  const tokenHash = token ? await sha256(`${article}|${token}`) : '';
  if (request.method === 'PUT' && !(await env.TOKEN_LIMIT.limit({key: tokenHash})).success) return failure(429, 'try_again_later');
  if (request.method === 'GET') {
    const result = await env.LIKES_DB.batch([
      env.LIKES_DB.prepare('SELECT likes FROM article_counts WHERE article_id = ?').bind(article),
      env.LIKES_DB.prepare('SELECT liked, expires_at FROM article_votes WHERE article_id = ? AND token_hash = ? AND expires_at > ?').bind(article, tokenHash, now)
    ]);
    if (!result[0].results[0]) return failure(404, 'not_found');
    return response(200, {article_id: article, count: result[0].results[0].likes,
      liked: Boolean(result[1].results[0]?.liked), expires_at: result[1].results[0]?.expires_at || null});
  }
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '')) return failure(415, 'json_required');
  let input;
  try {input = await bodyJSON(request);} catch (error) {return failure(error instanceof RangeError ? 413 : 400, 'invalid_body');}
  if (!input || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.liked !== 'boolean') return failure(400, 'invalid_body');
  // The upsert, trigger aggregate change and readback are one D1 transaction.
  // Replaying the same target state cannot increment or decrement twice.
  const expires = now + RETENTION_SECONDS;
  const result = await env.LIKES_DB.batch([
    env.LIKES_DB.prepare('DELETE FROM article_votes WHERE article_id = ? AND token_hash = ? AND expires_at <= ?').bind(article, tokenHash, now),
    env.LIKES_DB.prepare('INSERT INTO article_votes(article_id, token_hash, liked, expires_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM article_counts WHERE article_id = ?) ON CONFLICT(article_id, token_hash) DO UPDATE SET liked = excluded.liked').bind(article, tokenHash, Number(input.liked), expires, article),
    env.LIKES_DB.prepare('SELECT likes FROM article_counts WHERE article_id = ?').bind(article),
    env.LIKES_DB.prepare('SELECT liked, expires_at FROM article_votes WHERE article_id = ? AND token_hash = ?').bind(article, tokenHash)
  ]);
  if (!result[2].results[0]) return failure(404, 'not_found');
  return response(200, {article_id: article, count: result[2].results[0].likes,
    liked: Boolean(result[3].results[0].liked), expires_at: result[3].results[0].expires_at});
}

export default {
  async fetch(request, env) {
    try {return await handle(request, env);} catch {return failure(503, 'temporarily_unavailable');}
  },
  async scheduled(_event, env) {
    // Remove expired control tokens, preserving anonymous aggregate totals.
    await env.LIKES_DB.prepare('DELETE FROM article_votes WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  }
};
