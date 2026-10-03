import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import nodemailer from 'nodemailer';
import { openQueue, createHandler } from './relay.mjs';

process.umask(0o077);
const { SMTP_USER, SMTP_PASSWORD, MAIL_RELAY_TOKEN } = process.env;
if (!SMTP_USER || !SMTP_PASSWORD) throw new Error('Set SMTP_USER and SMTP_PASSWORD in private environment settings.');
const queuePath = process.env.QUEUE_PATH || './data/mail.sqlite';
mkdirSync(dirname(queuePath), { recursive:true });
const positiveInt = (value, fallback) => {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid operational cap.');
  return n;
};
const queue = openQueue(queuePath, {
  maxContacts:positiveInt(process.env.MAX_CONTACTS_PER_DAY,100),
  maxConfirmations:positiveInt(process.env.MAX_CONFIRMATIONS_PER_ADDRESS_PER_DAY,3)
});
const transport = nodemailer.createTransport({
  host:'smtp.mailbox.org', port:465, secure:true,
  auth:{user:SMTP_USER,pass:SMTP_PASSWORD},
  tls:{minVersion:'TLSv1.2'}, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:20000,
  disableFileAccess:false, disableUrlAccess:true, logger:false, debug:false
});
const server = createServer({maxHeaderSize:8192}, createHandler({token:MAIL_RELAY_TOKEN,queue}));
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 3010),process.env.HOST || '127.0.0.1');
let currentDrain = Promise.resolve();
let draining = false;
const drain = () => {
  if (draining) return currentDrain;
  draining = true;
  currentDrain = queue.drain(transport)
    .catch(() => console.error('Mail queue unavailable.'))
    .finally(() => { draining = false; });
  return currentDrain;
};
const timer = setInterval(drain,5000);
void drain();
async function shutdown() {
  clearInterval(timer);
  server.close();
  // Finish in-flight jobs before closing the database; a forced stop leaves persisted jobs for restart.
  await currentDrain;
  transport.close(); queue.db.close(); process.exit(0);
}
process.once('SIGTERM',shutdown); process.once('SIGINT',shutdown);
