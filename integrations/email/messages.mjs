export const LOGO_URL = 'https://tournstack.com/assets/brand/TS_EmailLogo_Reversed_DarkBG_RGB.png';

export const SENDER = 'info@tournstack.com';
export const LOGO_LINK = 'https://tournstack.com/?utm_source=tournstack&utm_medium=email&utm_campaign=contact-confirmation&utm_content=confirmation-email-en&utm_term=logo';
const escapeHTML = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function buildMessage(kind, contact) {
  const from = { name: 'TournStack', address: SENDER };
  if (kind === 'notification') return {
    from, to: SENDER, replyTo: contact.Email, subject: 'New Contact',
    text: `Name: ${contact.Name}\nEmail: ${contact.Email}\nInquiry: ${contact.Inquiry}`
  };
  if (kind === 'newsletter-already-subscribed') return {
    from, to: contact.Email, replyTo: SENDER, subject: "Whoops! You're already on the TournStack list",
    text: `Whoops! You’re already on the list!\n\nLooks like you’re one step ahead. Your subscription is confirmed, so there’s nothing else to do. We’ll email you when our newsletter is ready.\n\nTo unsubscribe, use the link in your original signup email or email info@tournstack.com.\n\nThe TournStack Marketing Team`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#EEF2F7;color:#0F172A;font-family:Montserrat,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#F8FAFC"><tr><td style="background:#0F172A;padding:28px 32px"><img src="${LOGO_URL}" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></td></tr><tr><td style="padding:32px;font-size:16px;line-height:1.65"><h1 style="font-size:24px">Whoops! You’re already on the list!</h1><p>Looks like you’re one step ahead. Your subscription is confirmed, so there’s nothing else to do.</p><p>We’ll email you when our newsletter is ready.</p><p>The TournStack Marketing Team</p><p style="font-size:13px">To unsubscribe, use the link in your original signup email or <a href="mailto:info@tournstack.com">email us</a>. <a href="https://tournstack.com/privacy.html#newsletter">Privacy</a></p></td></tr></table></td></tr></table></body></html>`
  };
  if (kind === 'newsletter-verification') {
    const url = escapeHTML(contact.VerificationURL);
    return {
      from, to: contact.Email, replyTo: SENDER, subject: 'Confirm your TournStack newsletter signup',
      text: `Please confirm that you want TournStack news when our newsletter launches.\n\nOpen this link and choose Confirm subscription:\n${contact.VerificationURL}\n\nThis link expires in 24 hours. If you did not request this, ignore this email; you will not be subscribed.\n\nTo cancel your signup or unsubscribe:\n${contact.UnsubscribeURL}\n\nThe TournStack Marketing Team`,
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;background:#EEF2F7;color:#0F172A;font-family:Montserrat,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#F8FAFC"><tr><td style="background:#0F172A;padding:28px 32px"><img src="${LOGO_URL}" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></td></tr><tr><td style="padding:32px;font-size:16px;line-height:1.65"><h1 style="font-size:24px">A little news, when it’s ready.</h1><p>Confirm that you’d like TournStack news when our newsletter launches.</p><p><a href="${url}" style="display:inline-block;background:#1855CC;color:#F8FAFC;padding:14px 18px;border-radius:8px;text-decoration:none">Confirm subscription</a></p><p style="font-size:14px">The link expires in 24 hours. Didn’t request this? Ignore this email and you won’t be subscribed.</p><p>The TournStack Marketing Team</p><p style="font-size:13px"><a href="${escapeHTML(contact.UnsubscribeURL)}">Cancel signup or unsubscribe</a> · <a href="https://tournstack.com/privacy.html#newsletter">Privacy</a></p></td></tr></table></td></tr></table></body></html>`
    };
  }
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
<tr><td style="background:#0F172A;padding:28px 32px"><a href="${LOGO_LINK.replace(/&/g,'&amp;')}" title="Visit TournStack" style="text-decoration:none"><img src="${LOGO_URL}" alt="TournStack" width="256" height="41" style="display:block;border:0;width:256px;max-width:100%;height:auto"></a></td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.65"><p style="margin:0 0 18px">Hi ${name},</p><p style="margin:0 0 18px">Thank you for contacting TournStack. We’ve received your inquiry and will make sure it reaches the right person on our team. We’ll be in touch shortly after reviewing it.</p><p style="margin:0">Best regards,<br><strong>The TournStack team</strong></p></td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;color:#475569"><a href="mailto:info@tournstack.com" style="color:#1855CC" title="Email TournStack">info@tournstack.com</a></td></tr>
</table></td></tr></table></body></html>`
  };
}
