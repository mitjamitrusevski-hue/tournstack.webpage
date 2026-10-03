import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { buildMessage } from './messages.mjs';

function httpError(status) { return Object.assign(new Error('Request rejected.'), { status }); }
export function validateContact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw httpError(400);
  const keys = ['SubmissionId','Name','Email','Inquiry'];
  if (Object.keys(value).some(k => !keys.includes(k)) || keys.some(k => typeof value[k] !== 'string')) throw httpError(400);
  const c = Object.fromEntries(keys.map(k => [k, value[k].trim()]));
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(c.SubmissionId) || !c.Name || c.Name.length > 100 || /[\r\n\x00]/.test(c.Name) ||
    c.Email.length > 254 || !/^[^\s@<>\x00]+@[^\s@<>\x00]+\.[^\s@<>\x00]+$/.test(c.Email) ||
    !c.Inquiry || c.Inquiry.length > 5000 || c.Inquiry.includes('\x00')) throw httpError(400);
  return c;
}

export function openQueue(path, { now = Date.now, maxContacts = 100, maxConfirmations = 3 } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, hash TEXT NOT NULL, email TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, due INTEGER NOT NULL,
      PRIMARY KEY (id,kind));
    CREATE INDEX IF NOT EXISTS contacts_created ON contacts(created);
    CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,due);`);
  let busy = false;
  return {
    db,
    enqueue(value) {
      const c = validateContact(value), time = now();
      const hash = createHash('sha256').update(JSON.stringify(c)).digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const old = db.prepare('SELECT hash FROM contacts WHERE id=?').get(c.SubmissionId);
        if (old) { if (old.hash !== hash) throw httpError(409); db.exec('COMMIT'); return; }
        if (db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE created>?').get(time-86400000).n >= maxContacts) throw httpError(429);
        const count = db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE email=? AND created>?').get(c.Email.toLowerCase(),time-86400000).n;
        db.prepare('INSERT INTO contacts VALUES (?,?,?,?)').run(c.SubmissionId,hash,c.Email.toLowerCase(),time);
        const insert = db.prepare('INSERT INTO jobs (id,kind,payload,due) VALUES (?,?,?,?)');
        insert.run(c.SubmissionId,'notification',JSON.stringify(c),time);
        if (count < maxConfirmations) insert.run(c.SubmissionId,'confirmation',JSON.stringify(c),time);
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async drain(transport, log = console) {
      if (busy) return;
      busy = true;
      try {
        const jobs = db.prepare("SELECT * FROM jobs WHERE state='pending' AND due<=? ORDER BY due LIMIT 10").all(now());
        for (const job of jobs) {
          try {
            const message = buildMessage(job.kind, JSON.parse(job.payload));
            message.messageId = `<${job.id}.${job.kind}@tournstack.com>`;
            const result = await transport.sendMail(message);
            if (!result.accepted?.length) throw new Error('Recipient not accepted.');
            // Remove personal content once SMTP accepts the message; keep only deduplication metadata.
            db.prepare("UPDATE jobs SET state='sent',payload='',attempts=attempts+1 WHERE id=? AND kind=?").run(job.id,job.kind);
          } catch (e) {
            const attempts = job.attempts + 1;
            const permanent = Number(e.responseCode) >= 500;
            const state = permanent || attempts >= 5 ? 'failed' : 'pending';
            db.prepare('UPDATE jobs SET state=?,attempts=?,due=? WHERE id=? AND kind=?')
              .run(state,attempts,now()+Math.min(3600000,30000*2**(attempts-1)),job.id,job.kind);
            log.error(JSON.stringify({ event:'smtp-job-failed',kind:job.kind,state,attempts }));
          }
        }
        // Thirty-day deduplication window and retention for failed job payloads.
        db.prepare('DELETE FROM jobs WHERE id IN (SELECT id FROM contacts WHERE created<?)').run(now()-30*86400000);
        db.prepare('DELETE FROM contacts WHERE created<?').run(now()-30*86400000);
      } finally { busy = false; }
    }
  };
}

export function createHandler({ token, queue }) {
  if (!token || token.length < 32) throw new Error('MAIL_RELAY_TOKEN must contain at least 32 characters.');
  const hash = value => createHash('sha256').update(value).digest();
  const expected = hash(`Bearer ${token}`);
  return async (req, res) => {
    const reply = status => { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify({ok:status===202 || status===200})); };
    try {
      if (!timingSafeEqual(expected,hash(String(req.headers.authorization || '')))) return reply(401);
      if (req.method === 'GET' && req.url === '/health') return reply(200);
      if (req.method !== 'POST' || req.url !== '/contact-email') return reply(404);
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(415);
      const parts = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 32768) throw httpError(413); parts.push(chunk); }
      let value; try { value = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw httpError(400); }
      queue.enqueue(value);
      reply(202); // Durable queue acceptance, not a claim of inbox delivery.
    } catch (e) { reply(e.status || 500); }
  };
}
