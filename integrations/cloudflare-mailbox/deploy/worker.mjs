var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.mjs
import { DurableObject } from "cloudflare:workers";
import { connect } from "cloudflare:sockets";

// queue.mjs
var retention = 30 * 864e5;
function reject(status) {
  return Object.assign(new Error("Request rejected."), { status });
}
__name(reject, "reject");
function validateContact(value) {
  const keys = ["SubmissionId", "Name", "Email", "Inquiry"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !keys.includes(k)) || keys.some((k) => typeof value[k] !== "string")) throw reject(400);
  const c = Object.fromEntries(keys.map((k) => [k, value[k].trim()]));
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(c.SubmissionId) || !c.Name || c.Name.length > 100 || /[\r\n\x00]/.test(c.Name) || c.Email.length > 254 || !/^[\x21-\x7e]+$/.test(c.Email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.Email) || !c.Inquiry || c.Inquiry.length > 5e3 || c.Inquiry.includes("\0")) throw reject(400);
  return c;
}
__name(validateContact, "validateContact");
function queueStore(sql, transaction, { now = Date.now, maxContacts = 100, maxConfirmations = 3 } = {}) {
  const run = /* @__PURE__ */ __name((q, ...args) => sql.exec(q, ...args).toArray(), "run");
  run("CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY,hash TEXT NOT NULL,email TEXT NOT NULL,created INTEGER NOT NULL)");
  run("CREATE TABLE IF NOT EXISTS jobs(id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL,PRIMARY KEY(id,kind))");
  run("CREATE INDEX IF NOT EXISTS contacts_created ON contacts(created)");
  run("CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,due)");
  return {
    enqueue(contact, hash) {
      return transaction(() => {
        const time = now(), old = run("SELECT hash FROM contacts WHERE id=?", contact.SubmissionId)[0];
        if (old) {
          if (old.hash !== hash) throw reject(409);
          return;
        }
        if (run("SELECT COUNT(*) AS n FROM contacts WHERE created>?", time - 864e5)[0].n >= maxContacts) throw reject(429);
        const count = run("SELECT COUNT(*) AS n FROM contacts WHERE email=? AND created>?", contact.Email.toLowerCase(), time - 864e5)[0].n;
        run("INSERT INTO contacts VALUES(?,?,?,?)", contact.SubmissionId, hash, contact.Email.toLowerCase(), time);
        run("INSERT INTO jobs(id,kind,payload,due) VALUES(?,?,?,?)", contact.SubmissionId, "notification", JSON.stringify(contact), time);
        if (count < maxConfirmations) run("INSERT INTO jobs(id,kind,payload,due) VALUES(?,?,?,?)", contact.SubmissionId, "confirmation", JSON.stringify(contact), time);
      });
    },
    enqueueNewsletter(message, hash) {
      return transaction(() => {
        const time = now(), old = run("SELECT hash FROM contacts WHERE id=?", message.SubmissionId)[0];
        if (old) {
          if (old.hash !== hash) throw reject(409);
          return;
        }
        if (run("SELECT COUNT(*) AS n FROM contacts WHERE created>?", time - 864e5)[0].n >= maxContacts) throw reject(429);
        if (run("SELECT COUNT(*) AS n FROM contacts WHERE email=? AND created>?", message.Email.toLowerCase(), time - 864e5)[0].n >= maxConfirmations) throw reject(429);
        run("INSERT INTO contacts VALUES(?,?,?,?)", message.SubmissionId, hash, message.Email.toLowerCase(), time);
        run("INSERT INTO jobs(id,kind,payload,due) VALUES(?,?,?,?)", message.SubmissionId, "newsletter-verification", JSON.stringify(message), time);
      });
    },
    claim() {
      return transaction(() => {
        const job = run("SELECT * FROM jobs WHERE state IN ('pending','sending') AND due<=? ORDER BY due LIMIT 1", now())[0];
        if (!job) return null;
        run("UPDATE jobs SET state='sending',attempts=attempts+1,due=? WHERE id=? AND kind=?", now() + 45e3, job.id, job.kind);
        return { ...job, attempts: job.attempts + 1 };
      });
    },
    success(job) {
      run("UPDATE jobs SET state='sent',payload='' WHERE id=? AND kind=?", job.id, job.kind);
    },
    failure(job, error) {
      const state = Number(error.responseCode) >= 500 || job.attempts >= 5 ? "failed" : "pending";
      run("UPDATE jobs SET state=?,due=? WHERE id=? AND kind=?", state, now() + Math.min(36e5, 3e4 * 2 ** (job.attempts - 1)), job.id, job.kind);
      return state;
    },
    nextAlarm() {
      const next = run("SELECT MIN(due) AS due FROM jobs WHERE state IN ('pending','sending')")[0].due;
      const expires = run("SELECT MIN(created) AS created FROM contacts")[0].created;
      const choices = [next, expires === null ? null : expires + retention + 1].filter((v) => v !== null);
      return choices.length ? Math.max(now() + 1e3, Math.min(...choices)) : null;
    },
    purge() {
      transaction(() => {
        run("DELETE FROM jobs WHERE id IN(SELECT id FROM contacts WHERE created<?)", now() - retention);
        run("DELETE FROM contacts WHERE created<?", now() - retention);
      });
    },
    stats() {
      return Object.fromEntries(run("SELECT state,COUNT(*) AS n FROM jobs GROUP BY state").map((r) => [r.state, r.n]));
    }
  };
}
__name(queueStore, "queueStore");

// newsletter.mjs
var NEWSLETTER_ORIGIN = "https://tournstack-mailbox.tournstack.workers.dev";
function validateNewsletter(value) {
  const keys = ["SubmissionId", "Email", "VerificationURL", "UnsubscribeURL"];
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !keys.includes(k)) || keys.some((k) => typeof value[k] !== "string")) throw reject(400);
  const m = Object.fromEntries(keys.map((k) => [k, value[k].trim()]));
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(m.SubmissionId) || m.Email.length > 254 || !/^[\x21-\x7e]+$/.test(m.Email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.Email)) throw reject(400);
  for (const [key, pathname] of [["VerificationURL", "/newsletter/confirm"], ["UnsubscribeURL", "/newsletter/unsubscribe"]]) {
    let u;
    try {
      u = new URL(m[key]);
    } catch {
      throw reject(400);
    }
    if (u.origin !== NEWSLETTER_ORIGIN || u.pathname !== pathname || u.searchParams.size !== 1 || !/^[a-f0-9]{128}$/.test(u.searchParams.get("token") || "") || u.hash || u.username || u.password) throw reject(400);
  }
  return m;
}
__name(validateNewsletter, "validateNewsletter");
async function validPublicToken(token, purpose, secret) {
  if (!/^[a-f0-9]{128}$/.test(token) || !secret || secret.length < 32) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(purpose + ":" + token.slice(0, 64))));
  const actual = Uint8Array.from(token.slice(64).match(/../g), (hex) => parseInt(hex, 16));
  let difference = 0;
  for (let i = 0; i < bytes.length; i++) difference |= bytes[i] ^ actual[i];
  return difference === 0;
}
__name(validPublicToken, "validPublicToken");
async function newsletterBackend(env, action, token = "") {
  const endpoint = env.NEWSLETTER_BACKEND_URL;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint || "")) throw Error("Newsletter backend unavailable.");
  const timestamp = String(Date.now()), data = [action, token, timestamp].join("\n");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.MAIL_RELAY_TOKEN), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const r = await fetch(endpoint, { method: "POST", body: new URLSearchParams({ Action: action, Token: token, Timestamp: timestamp, Signature: signature }), signal: AbortSignal.timeout(25e3) });
  if (!r.ok) throw Error("Newsletter backend request failed.");
  const result = await r.json();
  if (typeof result.ok !== "boolean") throw Error("Newsletter backend response invalid.");
  return result;
}
__name(newsletterBackend, "newsletterBackend");
function page(title, text, { token = "", action = "", button = "" } = {}) {
  const form = token ? `<form method="post" action="${action}"><input type="hidden" name="token" value="${token}"><button type="submit">${button}</button></form>` : "";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title} \u2014 TournStack</title><style>body{margin:0;background:#EEF2F7;color:#0F172A;font:17px/1.65 Arial,sans-serif}main{max-width:560px;margin:8vh auto;padding:32px;background:#F8FAFC;border-radius:16px}h1{font-size:28px;line-height:1.25}button{font:inherit;background:#1855CC;color:#F8FAFC;border:0;border-radius:8px;padding:14px 20px;cursor:pointer}a{color:#1855CC}button:focus-visible,a:focus-visible{outline:3px solid #1855CC;outline-offset:4px}@media(max-width:620px){main{margin:24px 16px;padding:24px}}</style></head><body><main><p><strong>TournStack</strong></p><h1>${title}</h1><p>${text}</p>${form}<p><a href="https://tournstack.com/">Back to TournStack</a> \xB7 <a href="https://tournstack.com/privacy.html#newsletter">Privacy</a></p></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}
__name(page, "page");
async function newsletterPublic(request, env) {
  const url = new URL(request.url), confirm = url.pathname === "/newsletter/confirm";
  if (!confirm && url.pathname !== "/newsletter/unsubscribe") return null;
  if (request.method === "GET") {
    const token2 = url.searchParams.get("token") || "";
    if (!await validPublicToken(token2, confirm ? "confirm" : "unsubscribe", env.MAIL_RELAY_TOKEN)) return page("This link is incomplete or invalid.", "Please use the full link in your email.");
    return page(confirm ? "Ready for a little TournStack news?" : "Unsubscribe from TournStack news?", confirm ? "Confirm that you\u2019d like TournStack news when our newsletter launches. You can unsubscribe anytime." : "Confirm below to cancel your signup or unsubscribe.", { token: token2, action: url.pathname, button: confirm ? "Confirm subscription" : "Unsubscribe" });
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST", "Cache-Control": "no-store" } });
  const origin = request.headers.get("Origin");
  const sameOriginOpaque = origin === "null" && request.headers.get("Sec-Fetch-Site") === "same-origin";
  if (origin && origin !== url.origin && !sameOriginOpaque) return new Response("Request rejected.", { status: 403 });
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get("Content-Type") || "")) return new Response("Request rejected.", { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Request rejected.", { status: 400 });
  let raw = "", length = 0;
  const decoder = new TextDecoder();
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 256) {
      await reader.cancel();
      return new Response("Request too large.", { status: 413 });
    }
    raw += decoder.decode(part.value, { stream: true });
  }
  raw += decoder.decode();
  const token = new URLSearchParams(raw).get("token") || "";
  if (!await validPublicToken(token, confirm ? "confirm" : "unsubscribe", env.MAIL_RELAY_TOKEN)) return page("This link is incomplete or invalid.", "Please use the full link in your email.");
  try {
    const result = await newsletterBackend(env, confirm ? "newsletter-confirm" : "newsletter-unsubscribe", token);
    if (!result.ok) return page("This link has expired or was already used.", "You can request a fresh signup link from the TournStack website.");
    return page(confirm ? "You\u2019re on the list." : "You\u2019re unsubscribed.", confirm ? "Thanks for joining us. We\u2019ll email you when our newsletter is ready." : "Your newsletter signup has been removed. You won\u2019t receive our newsletter.");
  } catch {
    return page("Please try again shortly.", "We couldn\u2019t confirm that update. Please try this link again or email info@tournstack.com.");
  }
}
__name(newsletterPublic, "newsletterPublic");

// http.mjs
var json = /* @__PURE__ */ __name((status, value = {}) => Response.json({ ok: status >= 200 && status < 300, ...value }, { status, headers: { "Cache-Control": "no-store" } }), "json");
async function handleRequest(request, env) {
  const publicPath = new URL(request.url).pathname;
  if (publicPath === "/newsletter/confirm" || publicPath === "/newsletter/unsubscribe") return newsletterPublic(request, env);
  const token = env.MAIL_RELAY_TOKEN || "";
  if (token.length < 32) return json(503);
  const digest = /* @__PURE__ */ __name(async (v) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))), "digest");
  const [expected, actual] = await Promise.all([digest(`Bearer ${token}`), digest(request.headers.get("Authorization") || "")]);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  if (diff) return json(401);
  if (!env.CONTACT_QUEUE || !env.SMTP_USER || !env.SMTP_PASSWORD) return json(503);
  const queue = env.CONTACT_QUEUE.get(env.CONTACT_QUEUE.idFromName("tournstack-contact-mail-v1"));
  const path = new URL(request.url).pathname;
  try {
    if (request.method === "GET" && path === "/health") return json(200, { queue: await queue.stats() });
    if (request.method === "POST" && path === "/smtp-check") {
      await queue.verifySMTP();
      return json(200);
    }
    if (request.method !== "POST" || !["/contact-email", "/newsletter-request"].includes(path)) return json(404);
    if (!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type") || "")) return json(415);
    if (Number(request.headers.get("Content-Length") || 0) > 32768) return json(413);
    const reader = request.body?.getReader();
    if (!reader) return json(400);
    const chunks = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 32768) {
        await reader.cancel();
        return json(413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    let value;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json(400);
    }
    const result = path === "/contact-email" ? await queue.enqueue(value) : await queue.enqueueNewsletter(value);
    return json(result.status);
  } catch {
    return json(503);
  }
}
__name(handleRequest, "handleRequest");

// ../email/messages.mjs
var LOGO_URL = "https://tournstack.com/assets/brand/TS_EmailLogo_Reversed_DarkBG_RGB.png";
var SENDER = "info@tournstack.com";
var LOGO_LINK = "https://tournstack.com/?utm_source=tournstack&utm_medium=email&utm_campaign=contact-confirmation&utm_content=confirmation-email-en&utm_term=logo";
var escapeHTML = /* @__PURE__ */ __name((value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "escapeHTML");
function buildMessage(kind, contact) {
  const from = { name: "TournStack", address: SENDER };
  if (kind === "notification") return {
    from,
    to: SENDER,
    replyTo: contact.Email,
    subject: "New Contact",
    text: `Name: ${contact.Name}
Email: ${contact.Email}
Inquiry: ${contact.Inquiry}`
  };
  if (kind === "newsletter-verification") {
    const url = escapeHTML(contact.VerificationURL);
    return {
      from,
      to: contact.Email,
      replyTo: SENDER,
      subject: "Confirm your TournStack newsletter signup",
      text: `Please confirm that you want TournStack news when our newsletter launches.

Open this link and choose Confirm subscription:
${contact.VerificationURL}

This link expires in 24 hours. If you did not request this, ignore this email; you will not be subscribed.

To cancel your signup or unsubscribe:
${contact.UnsubscribeURL}

The TournStack Marketing Team`,
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#EEF2F7;color:#0F172A;font-family:Montserrat,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#F8FAFC"><tr><td style="background:#0F172A;padding:28px 32px"><img src="${LOGO_URL}" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></td></tr><tr><td style="padding:32px;font-size:16px;line-height:1.65"><h1 style="font-size:24px">A little news, when it\u2019s ready.</h1><p>Confirm that you\u2019d like TournStack news when our newsletter launches.</p><p><a href="${url}" style="display:inline-block;background:#1855CC;color:#F8FAFC;padding:14px 18px;border-radius:8px;text-decoration:none">Confirm subscription</a></p><p style="font-size:14px">The link expires in 24 hours. Didn\u2019t request this? Ignore this email and you won\u2019t be subscribed.</p><p>The TournStack Marketing Team</p><p style="font-size:13px"><a href="${escapeHTML(contact.UnsubscribeURL)}">Cancel signup or unsubscribe</a> \xB7 <a href="https://tournstack.com/privacy.html#newsletter">Privacy</a></p></td></tr></table></td></tr></table></body></html>`
    };
  }
  if (kind !== "confirmation") throw new Error("Unknown message kind.");
  const name = escapeHTML(contact.Name);
  return {
    from,
    to: contact.Email,
    replyTo: SENDER,
    subject: "Thanks for contacting TournStack",
    text: `Hi ${contact.Name},

Thank you for contacting TournStack. We\u2019ve received your inquiry and will make sure it reaches the right person on our team. We\u2019ll be in touch shortly after reviewing it.

Best regards,
The TournStack team

${LOGO_LINK}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#EEF2F7;color:#0F172A;font-family:Montserrat,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">We\u2019ve received your inquiry and will be in touch shortly.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EEF2F7"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#F8FAFC">
<tr><td style="background:#0F172A;padding:28px 32px"><a href="${LOGO_LINK.replace(/&/g, "&amp;")}" title="Visit TournStack" style="text-decoration:none"><img src="${LOGO_URL}" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></a></td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.65"><p style="margin:0 0 18px">Hi ${name},</p><p style="margin:0 0 18px">Thank you for contacting TournStack. We\u2019ve received your inquiry and will make sure it reaches the right person on our team. We\u2019ll be in touch shortly after reviewing it.</p><p style="margin:0">Best regards,<br><strong>The TournStack team</strong></p></td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;color:#475569"><a href="mailto:info@tournstack.com" style="color:#1855CC" title="Email TournStack">info@tournstack.com</a></td></tr>
</table></td></tr></table></body></html>`
  };
}
__name(buildMessage, "buildMessage");

// mime.mjs
function base64UTF8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 4096) binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return btoa(binary);
}
__name(base64UTF8, "base64UTF8");
var wrapped = /* @__PURE__ */ __name((value) => value.match(/.{1,76}/g)?.join("\r\n") || "", "wrapped");
function makeMIME(kind, contact) {
  const m = buildMessage(kind, contact);
  const alt = `ts-alt-${crypto.randomUUID()}`;
  const headers = [
    `From: TournStack <${SENDER}>`,
    `To: ${m.to}`,
    `Reply-To: ${m.replyTo}`,
    `Subject: ${m.subject}`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
    `Message-ID: <${contact.SubmissionId}.${kind}@tournstack.com>`,
    "MIME-Version: 1.0"
  ];
  const part = /* @__PURE__ */ __name((type, value) => `Content-Type: ${type}; charset=utf-8\r
Content-Transfer-Encoding: base64\r
\r
${wrapped(base64UTF8(value))}\r
`, "part");
  let body;
  if (m.html) {
    headers.push(`Content-Type: multipart/alternative; boundary="${alt}"`);
    body = `--${alt}\r
${part("text/plain", m.text)}--${alt}\r
${part("text/html", m.html)}--${alt}--\r
`;
  } else {
    headers.push("Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64");
    body = wrapped(base64UTF8(m.text)) + "\r\n";
  }
  return { to: m.to, from: SENDER, raw: headers.join("\r\n") + "\r\n\r\n" + body };
}
__name(makeMIME, "makeMIME");

// smtp.mjs
async function mailboxSMTP(connect2, credentials, message = null, timeoutMs = 2e4) {
  if (!credentials.user || !credentials.password || /[\r\n\x00]/.test(credentials.user + credentials.password)) throw new Error("SMTP credentials missing or invalid.");
  const socket = connect2({ hostname: "smtp.mailbox.org", port: 465 }, { secureTransport: "on" });
  socket.closed.catch(() => {
  });
  const reader = socket.readable.getReader(), writer = socket.writable.getWriter();
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  let buffer = "", timer, accepted = false;
  const write = /* @__PURE__ */ __name((value) => writer.write(encoder.encode(value + "\r\n")), "write");
  async function reply() {
    const lines = [];
    let length = 0, code;
    while (true) {
      let end;
      while ((end = buffer.indexOf("\r\n")) < 0) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("SMTP connection closed.");
        buffer += decoder.decode(chunk.value, { stream: true });
        if (buffer.length > 16384) throw new Error("SMTP reply too large.");
      }
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      length += line.length;
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!match || length > 16384 || code && code !== Number(match[1])) throw new Error("Invalid SMTP reply.");
      code = Number(match[1]);
      lines.push(match[3]);
      if (match[2] === " ") return { code, lines };
    }
  }
  __name(reply, "reply");
  async function expect(codes) {
    const result = await reply();
    if (!codes.includes(result.code)) throw Object.assign(new Error("SMTP command rejected."), { responseCode: result.code });
    return result;
  }
  __name(expect, "expect");
  async function command(value, codes) {
    await write(value);
    return expect(codes);
  }
  __name(command, "command");
  const run = /* @__PURE__ */ __name(async () => {
    await socket.opened;
    await expect([220]);
    const hello = await command("EHLO tournstack.com", [250]);
    const auth = hello.lines.filter((line) => /^AUTH(?:\s|=)/i.test(line)).join(" ");
    if (/\bPLAIN\b/i.test(auth)) {
      const value = base64UTF8("\0" + credentials.user + "\0" + credentials.password);
      const result = await command("AUTH PLAIN " + value, [235, 334]);
      if (result.code === 334) await command(value, [235]);
    } else if (/\bLOGIN\b/i.test(auth)) {
      await command("AUTH LOGIN", [334]);
      await command(base64UTF8(credentials.user), [334]);
      await command(base64UTF8(credentials.password), [235]);
    } else throw Object.assign(new Error("SMTP server has no supported authentication method."), { responseCode: 502 });
    if (message) {
      if (message.from !== "info@tournstack.com" || /[\r\n<>\x00]/.test(message.to)) throw new Error("Invalid SMTP envelope.");
      await command(`MAIL FROM:<${message.from}>`, [250]);
      await command(`RCPT TO:<${message.to}>`, [250, 251]);
      await command("DATA", [354]);
      await writer.write(encoder.encode(message.raw.replace(/(^|\r\n)\./g, "$1..") + ".\r\n"));
      await expect([250]);
      accepted = true;
    }
    try {
      await command("QUIT", [221]);
    } catch {
    }
    return { accepted: true };
  }, "run");
  try {
    return await Promise.race([run(), new Promise((resolve, reject2) => {
      timer = setTimeout(() => accepted ? resolve({ accepted: true }) : reject2(new Error("SMTP timeout.")), timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
    await socket.close().catch(() => {
    });
    try {
      reader.releaseLock();
      writer.releaseLock();
    } catch {
    }
  }
}
__name(mailboxSMTP, "mailboxSMTP");

// worker.mjs
var worker_default = { fetch: handleRequest };
var ContactMailQueue = class extends DurableObject {
  static {
    __name(this, "ContactMailQueue");
  }
  constructor(ctx, env) {
    super(ctx, env);
    const cap = /* @__PURE__ */ __name((v, n) => {
      const i = Number(v ?? n);
      if (!Number.isSafeInteger(i) || i < 1) throw Error("Invalid operational cap.");
      return i;
    }, "cap");
    this.queue = queueStore(ctx.storage.sql, (fn) => ctx.storage.transactionSync(fn), {
      maxContacts: cap(env.MAX_CONTACTS_PER_DAY, 100),
      maxConfirmations: cap(env.MAX_CONFIRMATIONS_PER_ADDRESS_PER_DAY, 3)
    });
  }
  async enqueue(value) {
    try {
      this.queue.purge();
      const contact = validateContact(value);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(contact))))).map((b) => b.toString(16).padStart(2, "0")).join("");
      this.queue.enqueue(contact, hash);
      const next = this.queue.nextAlarm(), current = await this.ctx.storage.getAlarm();
      if (next !== null && (current === null || current > next)) await this.ctx.storage.setAlarm(next);
      return { status: 202 };
    } catch (e) {
      return { status: e.status || 503 };
    }
  }
  async stats() {
    return this.queue.stats();
  }
  async enqueueNewsletter(value) {
    try {
      this.queue.purge();
      const message = validateNewsletter(value);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(message))))).map((b) => b.toString(16).padStart(2, "0")).join("");
      this.queue.enqueueNewsletter(message, hash);
      if (!await this.ctx.storage.get("newsletter-cleanup-next")) await this.ctx.storage.put("newsletter-cleanup-next", Date.now() + 864e5);
      const next = this.queue.nextAlarm(), current = await this.ctx.storage.getAlarm();
      if (next !== null && (current === null || current > next)) await this.ctx.storage.setAlarm(next);
      return { status: 202 };
    } catch (e) {
      return { status: e.status || 503 };
    }
  }
  async verifySMTP() {
    await mailboxSMTP(connect, { user: this.env.SMTP_USER, password: this.env.SMTP_PASSWORD });
  }
  async alarm() {
    this.queue.purge();
    let cleanup = await this.ctx.storage.get("newsletter-cleanup-next");
    if (cleanup && cleanup <= Date.now()) {
      try {
        const result = await newsletterBackend(this.env, "newsletter-cleanup");
        if (!result.ok) throw Error("Cleanup rejected");
        cleanup = Date.now() + 864e5;
      } catch {
        cleanup = Date.now() + 36e5;
        console.error(JSON.stringify({ event: "newsletter-cleanup-retry" }));
      }
      await this.ctx.storage.put("newsletter-cleanup-next", cleanup);
    }
    for (let i = 0; i < 2; i++) {
      const job = this.queue.claim();
      if (!job) break;
      await this.ctx.storage.setAlarm(Date.now() + 45e3);
      try {
        await mailboxSMTP(connect, { user: this.env.SMTP_USER, password: this.env.SMTP_PASSWORD }, makeMIME(job.kind, JSON.parse(job.payload)));
        this.queue.success(job);
      } catch (e) {
        const state = this.queue.failure(job, e);
        console.error(JSON.stringify({ event: "smtp-job-failed", kind: job.kind, state, attempts: job.attempts }));
      }
    }
    const next = [this.queue.nextAlarm(), cleanup || null].filter((v) => v !== null).sort((a, b) => a - b)[0] ?? null;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
  }
};
export {
  ContactMailQueue,
  worker_default as default
};
