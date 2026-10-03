import { buildMessage, SENDER } from '../email/messages.mjs';

export function base64UTF8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i=0; i<bytes.length; i+=4096) binary += String.fromCharCode(...bytes.subarray(i,i+4096));
  return btoa(binary);
}
const wrapped = value => value.match(/.{1,76}/g)?.join('\r\n') || '';

export function makeMIME(kind, contact) {
  const m=buildMessage(kind,contact);
  const boundary=`ts-related-${crypto.randomUUID()}`, alt=`ts-alt-${crypto.randomUUID()}`;
  const headers=[`From: TournStack <${SENDER}>`,`To: ${m.to}`,`Reply-To: ${m.replyTo}`,
    `Subject: ${m.subject}`,`Date: ${new Date().toUTCString()}`,
    `Message-ID: <${contact.SubmissionId}.${kind}@tournstack.com>`,'MIME-Version: 1.0'];
  const part=(type,value)=>`Content-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapped(base64UTF8(value))}\r\n`;
  let body;
  if (m.html) {
    headers.push(`Content-Type: multipart/related; boundary="${boundary}"`);
    const image=m.attachments[0];
    body=`--${boundary}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n`+
      `--${alt}\r\n${part('text/plain',m.text)}--${alt}\r\n${part('text/html',m.html)}--${alt}--\r\n`+
      `--${boundary}\r\nContent-Type: image/png; name="tournstack-logo.png"\r\nContent-Transfer-Encoding: base64\r\n`+
      `Content-ID: <${image.cid}>\r\nContent-Disposition: inline; filename="tournstack-logo.png"\r\n\r\n${wrapped(image.content)}\r\n--${boundary}--\r\n`;
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64');
    body=wrapped(base64UTF8(m.text))+'\r\n';
  }
  return {to:m.to,from:SENDER,raw:headers.join('\r\n')+'\r\n\r\n'+body};
}
