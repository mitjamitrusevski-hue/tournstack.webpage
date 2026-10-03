import { LOGO_BASE64 } from './logo.mjs';

export const SENDER = 'info@tournstack.com';
export const LOGO_LINK = 'https://tournstack.com/?utm_source=tournstack&utm_medium=email&utm_campaign=contact-confirmation&utm_content=confirmation-email-en&utm_term=logo';
const escapeHTML = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function buildMessage(kind, contact) {
  const from = { name: 'TournStack', address: SENDER };
  if (kind === 'notification') return {
    from, to: SENDER, replyTo: contact.Email, subject: 'New Contact',
    text: `Name: ${contact.Name}\nEmail: ${contact.Email}\nInquiry: ${contact.Inquiry}`
  };
  if (kind !== 'confirmation') throw new Error('Unknown message kind.');
  const name = escapeHTML(contact.Name);
  return {
    from, to: contact.Email, replyTo: SENDER, subject: 'Thanks for contacting TournStack',
    text: `Hi ${contact.Name},\n\nThank you for contacting TournStack. We’ve received your inquiry and will make sure it reaches the right person on our team. We’ll be in touch shortly after reviewing it.\n\nBest regards,\nThe TournStack team\n\n${LOGO_LINK}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#EEF2F7;color:#0F172A;font-family:Montserrat,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">We’ve received your inquiry and will be in touch shortly.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EEF2F7"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#F8FAFC">
<tr><td style="background:#0F172A;padding:28px 32px"><a href="${LOGO_LINK.replace(/&/g,'&amp;')}" title="Visit TournStack" style="text-decoration:none"><img src="cid:tournstack-logo" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></a></td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.65"><p style="margin:0 0 18px">Hi ${name},</p><p style="margin:0 0 18px">Thank you for contacting TournStack. We’ve received your inquiry and will make sure it reaches the right person on our team. We’ll be in touch shortly after reviewing it.</p><p style="margin:0">Best regards,<br><strong>The TournStack team</strong></p></td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;color:#475569"><a href="mailto:info@tournstack.com" style="color:#1855CC" title="Email TournStack">info@tournstack.com</a></td></tr>
</table></td></tr></table></body></html>`,
    attachments: [{ filename: 'tournstack-logo.png', content: LOGO_BASE64, encoding: 'base64', cid: 'tournstack-logo' }]
  };
}
