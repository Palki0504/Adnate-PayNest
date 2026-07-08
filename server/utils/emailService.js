const nodemailer = require('nodemailer');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { getDisplayName } = require('./nameFormat');

const BANK_LOGO_PATH = path.join(__dirname, '..', 'assets', 'adnate-paynest-logo.png');
const BANK_LOGO_CID = 'adnate-paynest-logo';
const EMAIL_GREETING_TEXT = 'Hey PayNester Elite 🌟,';
const EMAIL_SIGNATURE_TEXT = 'Thank you for using Adnate PayNest.\n\nRegards,\nAdnate PayNest Team 🤝🏻';
const EMAIL_LOGO_HTML = `
  <div data-paynest-header="true" style="text-align:center;margin:0 0 18px;">
    <img src="cid:${BANK_LOGO_CID}" alt="Adnate PayNest Bank Logo" width="88" style="display:block;width:88px;max-width:36%;height:auto;margin:0 auto;border:0;border-radius:10px;background:#ffffff;" />
    <div style="margin-top:8px;color:#0f2d5e;font-size:21px;font-weight:800;letter-spacing:.2px;">Adnate PayNest</div>
  </div>`;
const EMAIL_GREETING_HTML = '<p data-paynest-greeting="true" style="margin:0 0 14px;color:#0f172a;font-size:16px;font-weight:700;">Hey PayNester Elite &#127775;,</p>';
const getClientUrl = () => {
  const configuredUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CLIENT_URL is required in production to generate customer login links.');
  }

  return 'https://adnate-paynest.netlify.app';
};
const buildEmailClosingHtml = (messageKey) => `
  <table role="presentation" data-paynest-closing="${messageKey}" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:16px 0 0;">
    <tr>
      <td style="padding:0;color:#334155;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.55;">
        <p style="margin:0 0 10px;">Thank you for using Adnate PayNest.</p>
        <p style="margin:0;">Regards,<br><strong>Adnate PayNest Team &#129309;&#127995;</strong></p>
      </td>
    </tr>
  </table>`;

const stripContainerStyles = (html) => html.replace(
  /<(div|table|tbody|thead|tfoot|tr|td|section|header|footer)([^>]*?)style=(['"])(.*?)\3([^>]*)>/gi,
  (match, tag, before, quote, style, after) => {
    if (/data-paynest-(?:credentials|card)/i.test(`${before} ${after}`)) return match;
    const flattenedStyle = style
      .replace(/(?:^|;)\s*(?:background(?:-color|-image)?|border(?:-[^:;]+)?|border-radius|box-shadow|overflow)\s*:[^;]*/gi, '')
      .replace(/;;+/g, ';')
      .replace(/^\s*;|;\s*$/g, '')
      .trim();
    return `<${tag}${before}${flattenedStyle ? `style=${quote}${flattenedStyle}${quote}` : ''}${after}>`;
  }
);

const normalizeCallToActionStyles = (html) => html.replace(
  /<a([^>]*?)style=(['"])(.*?)\2([^>]*)>/gi,
  (match, before, quote, style, after) => {
    if (!/background(?:-color|-image)?\s*:/i.test(style)) return match;
    const buttonStyle = /(?:^|;)\s*color\s*:/i.test(style)
      ? style.replace(/(^|;)\s*color\s*:\s*[^;]+/i, '$1color:#ffffff !important')
      : `${style.replace(/;?\s*$/, ';')}color:#ffffff !important;`;
    return `<a${before}style=${quote}${buttonStyle}${quote}${after}>`;
  }
);

const removeEmptyLayoutElements = (html) => {
  let compacted = html;
  let previous;
  do {
    previous = compacted;
    compacted = compacted
      .replace(/<(?:div|p|td|tr|tbody|thead|tfoot|table)[^>]*>\s*(?:&nbsp;|<br\s*\/?\s*>)*\s*<\/(?:div|p|td|tr|tbody|thead|tfoot|table)>/gi, '')
      .replace(/(?:<br\s*\/?\s*>\s*){2,}/gi, '<br>');
  } while (compacted !== previous);
  return compacted;
};

const compactLargeSpacing = (html) => html
  .replace(/padding\s*:\s*[^;"']+/gi, (declaration) =>
    /(?:2[4-9]|[3-9][0-9])px/i.test(declaration) ? 'padding:14px' : declaration)
  .replace(/padding-(?:top|bottom)\s*:\s*(?:2[4-9]|[3-9][0-9])px/gi, (declaration) =>
    declaration.replace(/\d+px/i, '14px'))
  .replace(/margin\s*:\s*[^;"']+/gi, (declaration) =>
    /(?:2[4-9]|[3-9][0-9])px/i.test(declaration) ? 'margin:0 0 16px' : declaration)
  .replace(/margin-(?:top|bottom)\s*:\s*(?:2[4-9]|[3-9][0-9])px/gi, (declaration) =>
    declaration.replace(/\d+px/i, '16px'))
  .replace(/(?:height|min-height)\s*:\s*\d+px/gi, 'height:auto');

const normalizeUnifiedEmailHtml = (html, messageKey) => {
  let content = String(html || '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?blockquote[^>]*>/gi, '')
    .replace(/\sclass=(['"])[^'"]*(?:gmail_quote|gmail_signature)[^'"]*\1/gi, '')
    .replace(/<img[^>]+src=(['"])cid:adnate-paynest-logo\1[^>]*>/gi, '')
    .replace(/<div[^>]*data-paynest-header=['"]true['"][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<div[^>]*data-paynest-signature=['"]true['"][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<(?:h1|h2|p|div)[^>]*>\s*(?:🏦\s*)?Adnate PayNest(?: Bank)?\s*<\/(?:h1|h2|p|div)>/gi, '')
    .replace(/<p[^>]*>\s*(?:Hey PayNest(?:er)? Elite[^<]*|Dear (?:Customer|User|<strong>[\s\S]*?<\/strong>)[^<]*|Hello[\s\S]*?)\s*<\/p>/gi, '')
    .replace(/<p[^>]*>[\s\S]*?(?:Best regards,|Adnate PayNest Support Team|Secure Corporate Banking Notification)[\s\S]*?<\/p>/gi, '')
    .replace(/<p[^>]*>\s*Thank you for (?:banking with|using) Adnate PayNest(?: Bank)?\.[\s\S]*?<\/p>/gi, '')
    .replace(/<p[^>]*>\s*Regards,?[\s\S]*?Adnate PayNest (?:Support )?Team[\s\S]*?<\/p>/gi, '')
    .replace(/<[^>]+>\s*(?:Notification Reference|Reference ID)\s*:[\s\S]*?<\/[^>]+>/gi, '')
    .replace(/\b(?:Notification Reference|Reference ID)\s*:\s*AP-[A-Z0-9-]+/gi, '')
    .replace(/\bAP-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gi, '')
    .replace(/<(?:p|div)[^>]*>[\s\S]*?Important:\s*If you did not submit this request or believe this approval was made in error, please contact our support team immediately\.[\s\S]*?<\/(?:p|div)>/gi, '')
    .replace(/<p[^>]*>\s*Thank you for banking with Adnate PayNest\.\s*<\/p>\s*<p[^>]*>\s*Regards,<br\s*\/?><strong[^>]*>Adnate PayNest Team[^<]*<\/strong><br\s*\/?\s*>Your Trust, Our Secure Technology\s*<\/p>/gi, '')
    .replace(/<div[^>]*>\s*<p[^>]*>\s*(?:🔒|&#128274;|ðŸ”’)[\s\S]*?Protected by 256-bit SSL[\s\S]*?<\/p>\s*<\/div>/gi, '')
    .replace(/<p[^>]*>\s*(?:🔒|&#128274;|ðŸ”’)[\s\S]*?Protected by 256-bit SSL[\s\S]*?<\/p>/gi, '')
    .trim();

  content = compactLargeSpacing(stripContainerStyles(content))
    .replace(/(^|[;"'])\s*color\s*:\s*(?!#(?:16a34a|22c55e|dc2626|ef4444|0a2e5c|0f2d5e)\b)[^;"']+/gi, '$1color:#334155')
    .trim();

  content = normalizeCallToActionStyles(removeEmptyLayoutElements(content));

  return `<!doctype html>
  <html>
    <body style="margin:0;padding:14px;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
      <div data-paynest-unified-card="true" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ee;border-radius:14px;padding:20px 22px;box-shadow:0 8px 22px rgba(15,45,94,0.10);color:#334155;box-sizing:border-box;">
        ${EMAIL_LOGO_HTML}
        ${EMAIL_GREETING_HTML}
        ${content}
        ${buildEmailClosingHtml(messageKey)}
      </div>
    </body>
  </html>`;
};

const decorateMailOptions = (mailOptions) => {
  const decorated = { ...mailOptions };
  const messageKey = randomUUID();

  if (decorated.html) {
    decorated.html = normalizeUnifiedEmailHtml(decorated.html, messageKey)
      .replace(/>\s+</g, '><')
      .trim();
  }

  if (decorated.text) {
    const cleanedText = decorated.text
      .replace(/^\s*(?:Hey PayNest(?:er)? Elite[^\n]*|Dear [^\n]+|Hello [^\n]+)\s*/i, '')
      .replace(/^.*(?:Notification Reference|Reference ID)\s*:.*$/gim, '')
      .replace(/\bAP-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/gi, '')
      .replace(/^Important: If you did not submit this request or believe this approval was made in error, please contact our support team immediately\.\s*$/gim, '')
      .replace(/\n*(?:Best regards,|Thank you for (?:banking with|using) Adnate PayNest\.)[\s\S]*$/i, '')
      .trim();
    decorated.text = `${EMAIL_GREETING_TEXT}\n\n${cleanedText}\n\n${EMAIL_SIGNATURE_TEXT}`;
  }

  decorated.headers = {
    ...(decorated.headers || {}),
    'X-Entity-Ref-ID': messageKey,
    'X-PayNest-Message-Key': messageKey,
  };
  delete decorated.headers['X-PayNest-Notification-ID'];
  delete decorated.inReplyTo;
  delete decorated.references;

  const attachments = Array.isArray(decorated.attachments) ? decorated.attachments : [];
  if (!attachments.some((attachment) => attachment.cid === BANK_LOGO_CID)) {
    decorated.attachments = [
      ...attachments,
      {
        filename: 'adnate-paynest-logo.png',
        path: BANK_LOGO_PATH,
        cid: BANK_LOGO_CID,
        contentType: 'image/png',
        contentDisposition: 'inline',
      },
    ];
  }

  return decorated;
};

const getEmailService = () => (process.env.EMAIL_SERVICE || 'smtp').trim().toLowerCase();

const getEmailCredentials = () => {
  const service = getEmailService();
  return {
    user: (process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.EMAIL_FROM)?.trim(),
    pass: service === 'gmail_api' || service === 'gmail-api'
      ? process.env.GMAIL_REFRESH_TOKEN?.trim()
      : service === 'gmail'
      ? process.env.EMAIL_PASS?.replace(/\s/g, '')
      : (process.env.BREVO_API_KEY || process.env.EMAIL_API_KEY || process.env.EMAIL_PASS)?.trim(),
  };
};

const hasGmailApiConfig = () =>
  Boolean(
    (process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.EMAIL_FROM)?.trim()
    && process.env.GMAIL_CLIENT_ID?.trim()
    && process.env.GMAIL_CLIENT_SECRET?.trim()
    && process.env.GMAIL_REFRESH_TOKEN?.trim()
  );

const isPlaceholderConfig = ({ user, pass }) =>
  !user ||
  !pass ||
  user.includes('your-email') ||
  pass.includes('your-app-password') ||
  user.includes('your_mailtrap') ||
  user.includes('replace-with') ||
  pass.includes('replace-with');

const getEmailAuthErrorMessage = () => {
  if (getEmailService() === 'gmail_api' || getEmailService() === 'gmail-api') {
    return 'Gmail API rejected the request. Verify GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and gmail.send scope.';
  }
  if (getEmailService() === 'gmail') {
    return 'Gmail rejected the login. Use a Google App Password for EMAIL_PASS, not your normal Gmail password.';
  }
  if (getEmailService() === 'brevo') {
    return 'Brevo rejected the email API request. Verify BREVO_API_KEY and EMAIL_USER environment variables.';
  }

  return 'Email provider rejected the login. Verify EMAIL_USER and EMAIL_PASS environment variables.';
};

const formatEmailError = (error) => [
  error.code && `code=${error.code}`,
  error.command && `command=${error.command}`,
  error.responseCode && `responseCode=${error.responseCode}`,
  error.response && `response=${error.response}`,
  error.message && `message=${error.message}`,
].filter(Boolean).join(' | ') || String(error);

const normalizeEmailList = (value) => {
  if (Array.isArray(value)) return value.flatMap(normalizeEmailList);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({ email: email.replace(/^.*<([^>]+)>.*$/, '$1').trim() }));
};

const createBrevoTransporter = (auth) => ({
  verify: async () => {
    if (!auth.user || !auth.pass) {
      throw new Error('Brevo email is not configured. Set EMAIL_USER and BREVO_API_KEY.');
    }
    return true;
  },
  sendMail: async (mailOptions) => {
    const preparedOptions = decorateMailOptions({
      from: getDefaultFromAddress(auth.user),
      ...mailOptions,
    });
    const to = normalizeEmailList(preparedOptions.to);
    if (!to.length) throw new Error('Email recipient is required.');

    const htmlContent = String(preparedOptions.html || '')
      .replace(/<img[^>]+src=(['"])cid:adnate-paynest-logo\1[^>]*>/gi, '');
    const payload = {
      sender: { email: auth.user, name: 'Adnate PayNest' },
      to,
      subject: preparedOptions.subject,
      ...(htmlContent ? { htmlContent } : {}),
      ...(preparedOptions.text ? { textContent: preparedOptions.text } : {}),
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': auth.pass,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Brevo API ${response.status}: ${body}`);
    }
    const result = body ? JSON.parse(body) : {};
    console.log(`[EMAIL SENT] to=${preparedOptions.to} subject="${preparedOptions.subject}" messageId=${result.messageId || 'n/a'}`);
    return result;
  },
});

const base64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const foldBase64 = (value) => value.match(/.{1,76}/g)?.join('\r\n') || '';

const escapeHeader = (value) => String(value || '').replace(/[\r\n]+/g, ' ').trim();

const encodeSubject = (value) => {
  const subject = escapeHeader(value);
  return /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
};

const buildMimeMessage = async (mailOptions) => {
  const headers = [
    `From: ${escapeHeader(mailOptions.from)}`,
    `To: ${escapeHeader(mailOptions.to)}`,
    mailOptions.cc && `Cc: ${escapeHeader(mailOptions.cc)}`,
    mailOptions.bcc && `Bcc: ${escapeHeader(mailOptions.bcc)}`,
    `Subject: ${encodeSubject(mailOptions.subject)}`,
    'MIME-Version: 1.0',
  ].filter(Boolean);

  const cleanedHtml = String(mailOptions.html || '')
    .replace(/<img[^>]+src=(['"])cid:adnate-paynest-logo\1[^>]*>/gi, '');
  const text = mailOptions.text || '';
  const attachments = (Array.isArray(mailOptions.attachments) ? mailOptions.attachments : [])
    .filter((attachment) => attachment.cid !== BANK_LOGO_CID);

  const alternativeBoundary = `alt_${randomUUID()}`;
  const alternativePart = [
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(text || cleanedHtml.replace(/<[^>]*>/g, ' '), 'utf8').toString('base64')),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(cleanedHtml || text, 'utf8').toString('base64')),
    `--${alternativeBoundary}--`,
  ].join('\r\n');

  if (!attachments.length) {
    return [
      ...headers,
      alternativePart,
    ].join('\r\n');
  }

  const mixedBoundary = `mixed_${randomUUID()}`;
  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    alternativePart,
  ];

  for (const attachment of attachments) {
    const content = attachment.content
      ? Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content)
      : await fs.readFile(attachment.path);
    const filename = escapeHeader(attachment.filename || path.basename(attachment.path || 'attachment'));
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType || 'application/octet-stream'}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      foldBase64(content.toString('base64'))
    );
  }

  parts.push(`--${mixedBoundary}--`);
  return parts.join('\r\n');
};

const getGmailApiAccessToken = async () => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID.trim(),
      client_secret: process.env.GMAIL_CLIENT_SECRET.trim(),
      refresh_token: process.env.GMAIL_REFRESH_TOKEN.trim(),
      grant_type: 'refresh_token',
    }).toString(),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Gmail token ${response.status}: ${body}`);
  return JSON.parse(body).access_token;
};

const createGmailApiTransporter = (auth) => ({
  verify: async () => {
    if (!hasGmailApiConfig()) {
      throw new Error('Gmail API is not configured. Set GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.');
    }
    await getGmailApiAccessToken();
    return true;
  },
  sendMail: async (mailOptions) => {
    const preparedOptions = decorateMailOptions({
      from: getDefaultFromAddress(auth.user),
      ...mailOptions,
    });
    const accessToken = await getGmailApiAccessToken();
    const raw = base64Url(await buildMimeMessage(preparedOptions));
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Gmail send ${response.status}: ${body}`);
    const result = body ? JSON.parse(body) : {};
    console.log(`[EMAIL SENT] to=${preparedOptions.to} subject="${preparedOptions.subject}" messageId=${result.id || 'n/a'}`);
    return result;
  },
});

const getDefaultFromAddress = (user) => `"Adnate PayNest" <${user}>`;

let cachedTransporter;

// ─── Create transporter (SMTP or Gmail service) ─────────────────────────────
const createTransporter = () => {
  const auth = getEmailCredentials();

  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (isPlaceholderConfig(auth)) {
    throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS environment variables.');
  }

  const service = getEmailService();
  const transporter = service === 'gmail_api' || service === 'gmail-api' || hasGmailApiConfig()
    ? createGmailApiTransporter(auth)
    : service === 'brevo'
    ? createBrevoTransporter(auth)
    : service === 'gmail'
    ? (() => {
      const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
      return nodemailer.createTransport({
        host: process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com',
        port,
        secure: port === 465,
        family: 4,
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000,
        auth: {
          user: auth.user,
          pass: auth.pass,
        },
      });
    })()
    : (() => {
      const host = process.env.EMAIL_HOST?.trim();
      const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
      if (!host) {
        throw new Error('EMAIL_HOST is required when EMAIL_SERVICE is smtp.');
      }
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: auth.user, pass: auth.pass },
      });
    })();

  const sendMail = transporter.sendMail.bind(transporter);
  transporter.sendMail = async (mailOptions) => {
    const preparedOptions = decorateMailOptions({
      from: getDefaultFromAddress(auth.user),
      ...mailOptions,
    });

    try {
      const info = await sendMail(preparedOptions);
      console.log(`[EMAIL SENT] to=${preparedOptions.to} subject="${preparedOptions.subject}" messageId=${info.messageId || 'n/a'}`);
      return info;
    } catch (error) {
      console.error(`[EMAIL ERROR] to=${preparedOptions.to} subject="${preparedOptions.subject}" ${formatEmailError(error)}`);
      throw error;
    }
  };

  cachedTransporter = transporter;
  return transporter;
};

const verifyEmailTransporter = async () => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    const message = 'Email is not configured. Set EMAIL_USER and EMAIL_PASS environment variables.';
    if (process.env.NODE_ENV === 'production') {
      console.error(`[EMAIL VERIFY FAILED] ${message}`);
    } else {
      console.warn(`[EMAIL VERIFY SKIPPED] ${message}`);
    }
    return false;
  }

  try {
    await createTransporter().verify();
    console.log(`[EMAIL VERIFY OK] service=${getEmailService()} user=${auth.user}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL VERIFY FAILED] ${getEmailAuthErrorMessage()} ${formatEmailError(error)}`);
    return false;
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatEmailDate = (value) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(value ? new Date(value) : new Date());

const buildPremiumBankingEmail = ({ heading, intro, details, message, notice }) => {
  const detailRows = details.map(({ label, value }) => `
    <tr>
      <td style="padding:10px 8px;color:#475569;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 8px;color:#071a3d;font-size:14px;font-weight:700;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`).join('');

  return `<!doctype html>
  <html><body style="margin:0;padding:20px;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;background:#071a3d;border:2px solid #ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(7,26,61,0.18);">
      <div style="padding:28px 30px 20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.22);">
        <img src="cid:${BANK_LOGO_CID}" alt="Adnate PayNest Bank Logo" width="112" style="display:block;width:112px;max-width:42%;height:auto;margin:0 auto;border:0;border-radius:12px;background:#ffffff;" />
        <div style="margin-top:10px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:.3px;">Adnate PayNest</div>
        <div style="margin-top:6px;color:#ffffff;font-size:15px;font-weight:700;">${escapeHtml(heading)}</div>
      </div>
      <div style="padding:28px 30px 30px;color:#ffffff;">
        <p style="margin:0 0 18px;color:#ffffff;font-size:17px;font-weight:700;">Hey PayNester Elite &#127775;,</p>
        <p style="margin:0 0 22px;color:#ffffff;font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>
        <div style="background:#ffffff;border:1px solid #d9e2ef;border-radius:14px;padding:16px 18px;margin:0 0 22px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">${detailRows}</table>
        </div>
        <p style="margin:0 0 18px;color:#ffffff;font-size:15px;line-height:1.7;">${escapeHtml(message)}</p>
        ${notice ? `<div style="margin:0 0 22px;padding:15px 17px;border:1px solid #ffffff;border-radius:12px;background:#0b2a5b;color:#ffffff;font-size:13px;line-height:1.6;"><strong>Important:</strong> ${escapeHtml(notice)}</div>` : ''}
        <p style="margin:0 0 20px;color:#ffffff;font-size:15px;line-height:1.7;">Thank you for using Adnate PayNest.</p>
        <p style="margin:0;color:#ffffff;font-size:14px;line-height:1.7;">Regards,<br><strong>Adnate PayNest Team &#129309;&#127995;</strong></p>
      </div>
    </div>
  </body></html>`;
};

const sendAutomaticBankingEmail = async ({ to, subject, text, html }) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.');
  }

  return createTransporter().sendMail({
    from: `"Adnate PayNest" <${auth.user}>`,
    to,
    subject,
    text,
    html,
  });
};

const sendTransferLimitApprovedEmail = async (toEmail, data) => {
  const requestType = data.limitType === 'monthly' ? 'Monthly Limit' : 'Daily Limit';
  const accountType = `${data.accountType || 'Selected'} Account`.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const approvalDate = formatEmailDate(data.approvalDate);
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: 'Transfer Limit Increase Request Approved',
    text: `Hey PayNest Elite 🌟,\n\nYour transfer limit increase request has been approved.\n\nAccount Type: ${accountType}\nRequest Type: ${requestType}\nPrevious Limit: ${formatCurrency(data.previousLimit)}\nApproved Limit: ${formatCurrency(data.approvedLimit)}\nApproval Date: ${approvalDate}\n\nYour updated transfer limit is now active and can be used immediately.\n\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Transfer Limit Increase Request Approved',
      intro: 'We are pleased to inform you that your transfer limit increase request has been reviewed and approved by our Manager.',
      details: [
        { label: 'Account Type', value: accountType },
        { label: 'Request Type', value: requestType },
        { label: 'Previous Limit', value: formatCurrency(data.previousLimit) },
        { label: 'Approved Limit', value: formatCurrency(data.approvedLimit) },
        { label: 'Approval Date', value: approvalDate },
      ],
      message: 'Your updated transfer limit is now active and can be used immediately for transactions through your PayNest account.',
    }),
  });
};

const sendAccountTypeApprovedEmail = async (toEmail, data) => {
  const approvalDate = formatEmailDate(data.approvalDate);
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: 'Account Type Change Request Approved',
    text: `Hey PayNest Elite 🌟,\n\nYour account type change request has been approved.\n\nPrevious Account Type: ${data.previousAccountType}\nNew Account Type: ${data.newAccountType}\nApproval Date: ${approvalDate}\n\nThe updated account type is now active.\n\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Account Type Change Request Approved',
      intro: 'We are pleased to inform you that your account type change request has been reviewed and approved.',
      details: [
        { label: 'Previous Account Type', value: data.previousAccountType },
        { label: 'New Account Type', value: data.newAccountType },
        { label: 'Approval Date', value: approvalDate },
      ],
      message: 'The updated account type is now active on your PayNest account and all applicable features and limits have been updated accordingly.',
    }),
  });
};

const sendClassificationLimitsUpdatedEmail = async (toEmail, data) => {
  const effectiveDate = formatEmailDate(data.effectiveDate);
  const updatedFields = Array.isArray(data.updatedFields) ? data.updatedFields : [];
  const isUpdated = (field) => updatedFields.includes(field);
  const updatedFieldLabels = [
    isUpdated('dailyTransferLimit') && 'Daily Transfer Limit',
    isUpdated('monthlyTransferLimit') && 'Monthly Transfer Limit',
    isUpdated('overdraftLimit') && 'Overdraft Limit',
  ].filter(Boolean);
  const updatedSummary = updatedFieldLabels.join(', ');
  const displayLimit = (field, value) => `${isUpdated(field) ? '(Updated) ' : ''}${formatCurrency(value)}`;
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: 'Important Update: Account Classification Limits Modified',
    text: `Hey PayNest Elite 🌟,\n\nThe limits for your ${data.classification} classification have been updated.\n\nWhat Was Updated: ${updatedSummary}\nDaily Transfer Limit: ${displayLimit('dailyTransferLimit', data.dailyTransferLimit)}\nMonthly Transfer Limit: ${displayLimit('monthlyTransferLimit', data.monthlyTransferLimit)}\nOverdraft Limit: ${displayLimit('overdraftLimit', data.overdraftLimit)}\nEffective Date: ${effectiveDate}\n\nThese updated limits are now active and will apply to all future transactions performed through your account.`,
    html: buildPremiumBankingEmail({
      heading: 'Account Classification Limits Modified',
      intro: 'This email is to inform you that the limits associated with your account classification have been updated by the bank administrator.',
      details: [
        { label: 'Classification', value: data.classification },
        { label: 'What Was Updated', value: updatedSummary },
        { label: 'Daily Transfer Limit', value: displayLimit('dailyTransferLimit', data.dailyTransferLimit) },
        { label: 'Monthly Transfer Limit', value: displayLimit('monthlyTransferLimit', data.monthlyTransferLimit) },
        { label: 'Overdraft Limit', value: displayLimit('overdraftLimit', data.overdraftLimit) },
        { label: 'Effective Date', value: effectiveDate },
      ],
      message: 'These updated limits are now active and will apply to all future transactions performed through your account.',
    }),
  });
};

/**
 * Generate a temporary password from the customer's email address.
 * Rule: Take the part before '@', capitalise the first letter, append '@123'.
 * Example: palkirathore@example.com → Palki@123
 * @param {string} email - The customer's email address
 * @returns {string} Temporary password
 */
const generateTempPassword = (email) => {
  if (!email || typeof email !== 'string') {
    // Fallback if no email provided
    return 'User@123';
  }
  const prefix = email.split('@')[0] || 'user';
  const capitalised = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  return `${capitalised}@123`;
};

/**
 * Send temporary password email to user
 */
const sendTempPasswordEmail = async (toEmail, tempPassword, userName) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.'
    );
  }

  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(245,158,11,0.3);">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #0a0e27; font-size: 24px; font-weight: 800;">🏦 Adnate PayNest</h1>
        <p style="margin: 8px 0 0; color: rgba(10,14,39,0.7); font-size: 14px;">Password Reset Request</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 8px;">Hello <strong>${displayName}</strong>,</p>
        <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          We received a request to reset your password. Here is your temporary password:
        </p>
        <div style="background: rgba(245,158,11,0.1); border: 2px dashed rgba(245,158,11,0.4); border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
          <p style="color: #f59e0b; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${tempPassword}</p>
        </div>
        <div style="background: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
          <p style="color: #fca5a5; font-size: 13px; margin: 0; line-height: 1.6;">
            ⚠️ <strong>Important:</strong> Please log in with this temporary password and change it immediately from your Profile settings. This password is for one-time use.
          </p>
        </div>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0; line-height: 1.6;">
          If you did not request this password reset, please ignore this email or contact our support team immediately.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
          🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
        </p>
      </div>
    </div>
  `;

  const plainText = [
    `Hello ${displayName},`,
    '',
    'We received a request to reset your Adnate PayNest password.',
    '',
    `Your temporary password is: ${tempPassword}`,
    '',
    'Sign in with this password, then change it immediately from Profile settings.',
    '',
    'If you did not request this reset, please contact support.',
    '',
    '— Adnate PayNest',
  ].join('\n');

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your temporary password — Adnate PayNest',
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    const msg = err.message || '';
    if (/535|534|EAUTH|Invalid login|authentication failed/i.test(msg)) {
      throw new Error(
        getEmailAuthErrorMessage()
      );
    }
    throw err;
  }
};

/**
 * Send password reset email with secure token link to user
 */
const sendPasswordResetEmail = async (toEmail, token, userName) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.'
    );
  }

  const transporter = createTransporter();
  const clientUrl = getClientUrl();
  const resetLink = `${clientUrl}/reset-password?token=${token}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(245,158,11,0.3);">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #0a0e27; font-size: 24px; font-weight: 800;">🏦 Adnate PayNest Bank</h1>
        <p style="margin: 8px 0 0; color: rgba(10,14,39,0.7); font-size: 14px;">Password Reset Request</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 17px; font-weight: 600; margin: 0 0 16px;">Hey ${displayName} 🌟,</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0 0 16px;">
          We received a request to reset the password for your Adnate PayNest account.
        </p>
        <p style="color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0 0 28px;">
          To create a new password, please click the secure link below:
        </p>
        <div style="text-align: center; margin: 0 0 32px;">
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0a0e27; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 44px; border-radius: 10px; box-shadow: 0 4px 14px rgba(245,158,11,0.35); letter-spacing: 0.3px;">Reset Password</a>
        </div>
        <div style="background: rgba(255,255,255,0.05); border-left: 4px solid rgba(245,158,11,0.6); border-radius: 8px; padding: 16px; margin: 0 0 24px;">
          <p style="color: rgba(255,255,255,0.65); font-size: 13px; margin: 0; line-height: 1.7;">
            If you did not request a password reset, please ignore this email. Your account will remain secure, and no changes will be made.
          </p>
        </div>
        <p style="color: rgba(255,255,255,0.5); font-size: 13px; margin: 0 0 28px; line-height: 1.7;">
          For your protection, never share your password, OTP, or account credentials with anyone.
        </p>
        <p style="color: rgba(255,255,255,0.65); font-size: 14px; margin: 0; line-height: 1.8;">
          Thank you for choosing Adnate PayNest Bank.<br /><br />
          Regards,<br />
          <strong style="color: #f59e0b;">Adnate PayNest Bank Team 🤝</strong>
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
          🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
        </p>
      </div>
    </div>
  `;

  const plainText = [
    `Hey ${displayName} 🌟,`,
    '',
    'We received a request to reset the password for your Adnate PayNest account.',
    '',
    'To create a new password, please click the secure link below:',
    resetLink,
    '',
    'If you did not request a password reset, please ignore this email. Your account will remain secure, and no changes will be made.',
    '',
    'For your protection, never share your password, OTP, or account credentials with anyone.',
    '',
    'Thank you for choosing Adnate PayNest Bank.',
    '',
    'Regards,',
    'Adnate PayNest Bank Team 🤝🏻',
  ].join('\n');

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Reset Your Adnate PayNest Password',
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    const msg = err.message || '';
    if (/535|534|EAUTH|Invalid login|authentication failed/i.test(msg)) {
      throw new Error(
        getEmailAuthErrorMessage()
      );
    }
    throw err;
  }
};

/**
 * Build the welcome email HTML + plain-text for a newly admin-created user.
 * Design: white card, navy blue header, separate credentials box.
 */
const createNewUserEmailContent = ({ role, userName, emailAddress, tempPassword, clientUrl }) => {
  const isManager = role === 'manager';
  const displayName = getDisplayName(userName, isManager ? 'Manager' : 'Customer');
  const accountLabel = isManager ? 'manager' : 'customer';
  const portalLabel = isManager ? 'manager portal' : 'customer portal';
  const greeting = isManager ? 'Hey PayNester Manager&#127775;,' : `Hey ${displayName} &#127775;,`;
  const subject = `Welcome to Adnate PayNest \u2013 Your ${isManager ? 'Manager ' : ''}Login Credentials`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Adnate PayNest</title>
</head>
<body style="margin:0;padding:0;background-color:#e2e8f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e2e8f0;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Outer card -->
        <table role="presentation" width="100%" style="max-width:600px;background-color:#0a0e27;border-radius:18px;overflow:hidden;border:2px solid #ffffff;box-shadow:0 8px 32px rgba(10,14,39,0.25);">

          <!-- Logo Header -->
          <tr>
            <td style="padding:40px 32px 24px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">🏦</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.02em;">Adnate PayNest</h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:0 36px 36px;color:#f1f5f9;">
              <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#ffffff;">${greeting}</p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                Welcome to <strong>Adnate PayNest Bank</strong>.
              </p>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                Your ${accountLabel} account has been created successfully. Below are your ${isManager ? '' : 'temporary '}login credentials. Please use these to sign in and activate your account.
              </p>

              <!-- ─── Credentials Box ─── -->
              <table data-paynest-credentials="true" role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#ffffff;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:18px;">
                <tr>
                  <td style="padding:18px 20px;color:#0a0e27;">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:800;color:#0a2e5c;text-transform:uppercase;letter-spacing:0.08em;">🔑 Credentials</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Email ID</span><br/>
                          <strong style="font-size:14px;color:#0f172a;">${emailAddress}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0 0;">
                          <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${isManager ? 'Password' : 'Temporary Password'}</span><br/>
                          <strong style="font-size:18px;color:#0a2e5c;font-family:'Courier New',monospace;letter-spacing:1px;">${tempPassword}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Login Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td align="center">
                    <a href="${clientUrl}/login"
                      style="display:inline-block;background-color:#0a2e5c;color:#ffffff !important;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:10px;border:1px solid #0a2e5c;letter-spacing:0.3px;">
                      Login to ${isManager ? 'Manager Portal' : 'Portal'}
                    </a>
                  </td>
                </tr>
              </table>

              ${isManager ? '' : `<!-- Security Notice -->
              <table data-paynest-card="true" role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:16px;">
                <tr>
                  <td style="padding:18px 20px;color:#0f2d5e;">
                    <p style="margin:0;font-size:13px;line-height:1.6;font-weight:500;">
                      <strong>⚠️ Important Security Notice:</strong> You will be required to change this temporary password immediately upon your first login. Do not share your credentials, password, or OTP with anyone.
                    </p>
                  </td>
                </tr>
              </table>`}

              <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.7;">
                Thank you for using Adnate PayNest.<br/><br/>
                Regards,<br/>
                <strong style="color:#ffffff;">Adnate PayNest Team &#129309;&#127995;</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;padding:18px 32px;border-top:1px solid rgba(255,255,255,0.1);text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                🔒 Protected by 256-bit SSL encryption &nbsp;|&nbsp; Adnate PayNest &copy; 2026<br/>
                This is an automated message. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  let textContent = [
    'Hey PayNester Elite 🌟,',
    '',
    'Welcome to Adnate PayNest Bank.',
    '',
    'Your account has been successfully created by the admin.',
    `Please use the login credentials below to access your ${portalLabel}:`,
    '',
    '-----------------------------',
    'LOGIN CREDENTIALS',
    '-----------------------------',
    `Email ID          : ${emailAddress}`,
    `Temporary Password: ${tempPassword}`,
    '-----------------------------',
    '',
    `Login Portal: ${clientUrl}/login`,
    '',
    'IMPORTANT: For your security, you will be forced to change your password immediately after first login.',
    'Please do not share your password, OTP, or banking details with anyone.',
    '',
    'Thank you for using Adnate PayNest.',
    '',
    'Regards,',
    'Adnate PayNest Team 🤝🏻',
  ].join('\n');

  if (isManager) {
    textContent = textContent
      .replace(/^[^\n]+/, 'Hey PayNester Manager🌟,')
      .replace('Temporary Password', 'Password')
      .replace('IMPORTANT: For your security, you will be forced to change your password immediately after first login.\n', '')
      .replace('Please do not share your password, OTP, or banking details with anyone.\n\n', '')
      .replace(/Adnate PayNest Team[^\n]*$/, 'Adnate PayNest Team 🤝🏻');
  }

  return { subject, textContent, htmlContent };
};

/**
 * Send welcome email to a newly admin-created user with their login credentials.
 */
const sendNewUserWelcomeEmail = async (toEmail, tempPassword, userName, role, userId) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.'
    );
  }

  const transporter = createTransporter();
  const clientUrl = getClientUrl();
  const emailContent = createNewUserEmailContent({
    role,
    userName,
    emailAddress: toEmail,
    tempPassword,
    clientUrl,
  });

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: emailContent.subject,
    text: emailContent.textContent,
    html: emailContent.htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    const msg = err.message || '';
    if (/535|534|EAUTH|Invalid login|authentication failed/i.test(msg)) {
      throw new Error(
        getEmailAuthErrorMessage()
      );
    }
    throw err;
  }
};

const sendTransferSuccessEmail = async (toEmail, receiverName, senderName, amount, transactionId, direction = 'debit', fromAccount, toAccount) => {
  const displayReceiverName = getDisplayName(receiverName, '');
  const displaySenderName = getDisplayName(senderName, '');
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email is not configured. Skipping transfer success email.');
    return;
  }

  const transporter = createTransporter();

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true });

  const isCredit = direction === 'credit';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid ${isCredit ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};">
      <div style="background: linear-gradient(135deg, ${isCredit ? '#22c55e' : '#ef4444'} 0%, ${isCredit ? '#16a34a' : '#dc2626'} 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">${isCredit ? '✓ Credit Received' : '✓ Debit Successful'}</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Adnate PayNest</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Dear ${displayReceiverName},</p>
        <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Your account has been ${isCredit ? 'credited' : 'debited'} successfully! Here are the transaction details:
        </p>
        <div style="background: ${isCredit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid ${isCredit ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Transaction ID</p>
              <p style="color: #ffffff; font-size: 12px; font-family: 'Courier New'; margin: 0; word-break: break-all;">${transactionId}</p>
            </div>
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Amount ${isCredit ? 'Credited' : 'Debited'}</p>
              <p style="color: ${isCredit ? '#22c55e' : '#ef4444'}; font-size: 24px; font-weight: 800; margin: 0;">₹${amount.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">${isCredit ? 'Received From' : 'Sent To'}</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">${isCredit ? displaySenderName : displayReceiverName}</p>
            </div>
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Date & Time</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">${formattedDate}, ${formattedTime}</p>
            </div>
          </div>
        </div>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0; line-height: 1.6; text-align: center;">
          Your account balance is now updated. You can view the transaction in your dashboard.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
          🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
        </p>
      </div>
    </div>
  `;

  const plainText = [
    'Hey PayNester Elite 🌟,',
    '',
    `Your account has been ${isCredit ? 'credited' : 'debited'} successfully.`,
    '',
    'Transaction Details:',
    `* Transaction ID: ${transactionId}`,
    `* Amount ${isCredit ? 'Credited' : 'Debited'}: ₹${amount}`,
    `* ${isCredit ? 'Received From' : 'Sent To'}: ${isCredit ? displaySenderName : displayReceiverName}`,
    `* Date & Time: ${formattedDate}, ${formattedTime}`,
    '',
    'Thank you for using Adnate PayNest.',
    '',
    'Regards,',
    'Adnate PayNest Team🤝🏻',
  ].join('\n');

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Transaction ${isCredit ? 'Credit' : 'Debit'} — ₹${amount} ${isCredit ? 'credited' : 'debited'}`,
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send transfer success email:', err.message);
  }
};

/**
 * Send transfer failure notification email
 */
const sendTransferFailureEmail = async (toEmail, senderName, recipientName, amount, reason) => {
  const displaySenderName = getDisplayName(senderName);
  const displayRecipientName = getDisplayName(recipientName, '');
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email is not configured. Skipping transfer failure email.');
    return;
  }

  const transporter = createTransporter();

  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true });

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(239,68,68,0.3);">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">✗ Transfer Failed</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Adnate PayNest</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Hello <strong>${displaySenderName}</strong>,</p>
        <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Unfortunately, your transfer could not be completed. Here are the details:
        </p>
        <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">Amount</p>
              <p style="color: #ef4444; font-size: 24px; font-weight: 800; margin: 0;">₹${amount.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px; text-transform: uppercase;">To Recipient</p>
              <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">${displayRecipientName}</p>
            </div>
          </div>
          <div style="background: rgba(239,68,68,0.2); border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px; margin-top: 12px;">
            <p style="color: #fca5a5; font-size: 12px; margin: 0;">
              <strong>Reason:</strong> ${reason}
            </p>
          </div>
        </div>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0; line-height: 1.6;">
          Please review the reason above and try again. If you need assistance, contact our support team.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
          🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
        </p>
      </div>
    </div>
  `;

  const plainText = [
    'Hey PayNester Elite 🌟,',
    '',
    'Your transfer could not be completed.',
    '',
    `Amount: ₹${amount}`,
    `To: ${displayRecipientName}`,
    `Reason: ${reason}`,
    '',
    'Please try again or contact support.',
    '',
   'Thank you for using Adnate PayNest.',
    '',
    'Regards,',
    'Adnate PayNest Team🤝🏻',
  ].join('\n');

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `✗ Transfer Failed — ₹${amount} to ${displayRecipientName}`,
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send transfer failure email:', err.message);
  }
};

/**
 * Send transfer notification email (new format for direct transfers)
 */
const sendTransferNotificationEmail = async (
  toEmail,
  userName,
  otherPartyName,
  amount,
  failureReason = null,
  category = 'transfer',
  status = 'success',
  transactionId = 'N/A',
  balance = 0,
  dateStr = '',
  timeStr = '',
  isReceiver = false
) => {
  const displayName = getDisplayName(userName);
  const displayOtherPartyName = getDisplayName(otherPartyName, '');
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email is not configured. Skipping transfer notification email.');
    return;
  }

  const transporter = createTransporter();

  // If status is failed, show failure message
  if (status === 'failed') {
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(239,68,68,0.3);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">✗ Transfer Failed</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Adnate PayNest</p>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Dear ${displayName},</p>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Your transfer to ${displayOtherPartyName} could not be completed. Here are the details:
          </p>
          <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 12px;"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 12px;"><strong>Recipient:</strong> ${displayOtherPartyName}</p>
            <p style="color: #fca5a5; font-size: 13px; margin: 0;"><strong>Reason:</strong> ${failureReason}</p>
          </div>
          <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0; line-height: 1.6;">
            Please contact customer support if you need assistance.
          </p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
          <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
            🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
          </p>
        </div>
      </div>
    `;

    const plainText = [
     `Hey ${displayName} 🌟,`,
      '',
      'Your transfer could not be completed.',
      '',
      'Transaction Details:',
      `* Amount: ₹${amount}`,
      `* Recipient: ${displayOtherPartyName}`,
      `* Reason: ${failureReason}`,
      '',
      'Please contact support if you need assistance.',
      '',
      'Thank you for using Adnate PayNest.',
      '',
      'Regards,',
      'Adnate PayNest Team🤝🏻',
    ].join('\n');

    const mailOptions = {
      from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Transfer Failed — ₹${amount}`,
      text: plainText,
      html: htmlContent,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (err) {
      console.error('Failed to send transfer failure email:', err.message);
    }
    return;
  }

  // Success or Received status
  const isDebit = status === 'success' && !isReceiver;
  const isCredit = isReceiver;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(${isCredit ? '34,197,94' : '239,68,68'},0.3);">
      <div style="background: linear-gradient(135deg, ${isCredit ? '#22c55e' : '#ef4444'} 0%, ${isCredit ? '#16a34a' : '#dc2626'} 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">${isCredit ? '✓ Amount Received' : '✓ Amount Debited'}</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Adnate PayNest Transaction</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 15px; margin: 0 0 24px;">Dear ${displayName},</p>
        <p style="color: rgba(255,255,255,0.65); font-size: 13px; line-height: 1.7; margin: 0 0 24px;">
          Your account has been ${isCredit ? 'successfully credited' : 'successfully debited'}.
        </p>
        <div style="background: rgba(${isCredit ? '34,197,94' : '239,68,68'},0.08); border: 1px solid rgba(${isCredit ? '34,197,94' : '239,68,68'},0.25); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
          <p style="color: rgba(255,255,255,0.65); font-size: 12px; margin: 0 0 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Details:</p>
          
          <div style="margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Transaction ID</p>
            <p style="color: #ffffff; font-size: 12px; font-family: 'Courier New', monospace; margin: 0; word-break: break-all; font-weight: 600;">${transactionId}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Amount ${isCredit ? 'Credited' : 'Debited'}</p>
            <p style="color: ${isCredit ? '#22c55e' : '#ef4444'}; font-size: 20px; font-weight: 800; margin: 0;">₹${amount.toLocaleString('en-IN')}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">${isCredit ? 'Received From' : 'Sent To'}</p>
            <p style="color: #ffffff; font-size: 13px; margin: 0;">${displayOtherPartyName}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
            <p style="color: #ffffff; font-size: 13px; margin: 0;">${dateStr}, ${timeStr}</p>
          </div>

          <div style="margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Available Balance</p>
            <p style="color: #ffffff; font-size: 13px; margin: 0; font-weight: 600;">₹${balance.toLocaleString('en-IN')}</p>
          </div>

          <div>
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Status</p>
            <p style="color: #22c55e; font-size: 13px; margin: 0; font-weight: 600;">✓ Successful</p>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 16px; margin: 0 0 24px;">
          <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 0; line-height: 1.6;">
            If you did not perform this transaction, please contact customer support immediately.
          </p>
        </div>

        <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 16px; line-height: 1.6; text-align: center;">
          Thank you for using Adnate PayNest. Your transaction is secure and protected.
        </p>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
        <p style="color: rgba(255,255,255,0.25); font-size: 11px; margin: 0;">
          🔒 Protected by 256-bit SSL encryption · Adnate PayNest © 2025
        </p>
      </div>
    </div>
  `;

  const plainText = [
    `Hey ${displayName} 🌟,`,
    '',
    'Your account has been successfully ' + (isCredit ? 'credited' : 'debited') + '.',
    '',
    'Transaction Details:',
    '',
    `* Transaction ID: ${transactionId}`,
    `* Amount ${isCredit ? 'Credited' : 'Debited'}: ₹${amount}`,
    `* ${isCredit ? 'Received From' : 'Sent To'}: ${displayOtherPartyName}`,
    `* Date & Time: ${dateStr}, ${timeStr}`,
    `* Available Balance: ₹${balance}`,
    `* Transaction Status: Successful`,
    '',
    'If you did not perform this transaction, please contact customer support immediately.',
     '',
      'Thank you for using Adnate PayNest.',
      '',
      'Regards,',
      'Adnate PayNest Team🤝🏻',
  ].join('\n');

  const mailOptions = {
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${isCredit ? 'Credit' : 'Debit'} — ₹${amount} ${isCredit ? 'received' : 'debited'}`,
    text: plainText,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send transfer notification email:', err.message);
  }
};

/**
 * Send registration approved email
 */
const sendRegistrationApprovedEmail = async (toEmail, userName, role) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email not configured. Skipping registration approved email.');
    return;
  }
  const transporter = createTransporter();
  const roleLabel = role === 'manager' ? 'Manager' : 'Customer';
  const clientUrl = getClientUrl();

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(34,197,94,0.3);">
      <div style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">✅ Account Approved!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#ffffff;font-size:16px;margin:0 0 16px;">Dear <strong>${displayName}</strong>,</p>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;margin:0 0 24px;">
          Great news! Your <strong>${roleLabel}</strong> account registration has been <strong style="color:#22c55e;">approved</strong> by our admin team.
          You can now log in to Adnate PayNest and start using your account.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${clientUrl}/login" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">Login to Adnate PayNest</a>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0;">If you have any issues, contact support@adnatefinance.com</p>
      </div>
      <div style="background:rgba(255,255,255,0.03);padding:16px 24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
        <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">🔒 Protected by 256-bit SSL · Adnate PayNest © 2025</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Your ${roleLabel} Account is Approved — Adnate PayNest`,
    text: `Dear ${displayName},\n\nYour ${roleLabel} account has been approved. You can now log in at ${clientUrl}/login\n\nAdnate PayNest`,
    html: htmlContent,
  });
};

/**
 * Send registration rejected email
 */
const sendRegistrationRejectedEmail = async (toEmail, userName, role, reason) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email not configured. Skipping registration rejected email.');
    return;
  }
  const transporter = createTransporter();
  const roleLabel = role === 'manager' ? 'Manager' : 'Customer';

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.3);">
      <div style="background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">❌ Account Registration Rejected</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#ffffff;font-size:16px;margin:0 0 16px;">Dear <strong>${displayName}</strong>,</p>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;margin:0 0 16px;">
          Unfortunately, your <strong>${roleLabel}</strong> account registration has been <strong style="color:#ef4444;">rejected</strong>.
        </p>
        ${reason ? `<div style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:0 0 24px;"><p style="color:#fca5a5;font-size:13px;margin:0;"><strong>Reason:</strong> ${reason}</p></div>` : ''}
        <p style="color:rgba(255,255,255,0.4);font-size:12px;">Please contact support@adnatefinance.com for further assistance.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `❌ Account Registration Rejected — Adnate PayNest`,
    text: `Dear ${displayName},\n\nYour ${roleLabel} account registration was rejected.${reason ? `\nReason: ${reason}` : ''}\n\nContact support for more info.\n\nAdnate PayNest`,
    html: htmlContent,
  });
};

/**
 * Send overdraft limit increase approved email
 */
const sendOverdraftLimitApprovedEmail = async (toEmail, userName, newLimit, comment) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) { throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS environment variables.'); }
  const transporter = createTransporter();
  const formattedLimit = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(newLimit);

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(34,197,94,0.3);">
      <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✅ OD Limit Increase Approved</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#fff;font-size:16px;">Dear <strong>${displayName}</strong>,</p>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">Your overdraft limit increase request has been <strong style="color:#22c55e;">approved!</strong></p>
        <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:20px;margin:16px 0;">
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 4px;text-transform:uppercase;">New Overdraft Limit</p>
          <p style="color:#22c55e;font-size:28px;font-weight:800;margin:0;">${formattedLimit}</p>
        </div>
        ${comment ? `<p style="color:rgba(255,255,255,0.6);font-size:13px;"><strong>Manager Comment:</strong> ${comment}</p>` : ''}
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Overdraft Limit Increased to ${formattedLimit} — Adnate PayNest`,
    text: `Dear ${displayName},\n\nYour overdraft limit has been increased to ${formattedLimit}.${comment ? `\n\nManager Comment: ${comment}` : ''}\n\nAdnate PayNest`,
    html: htmlContent,
  });
};

/**
 * Send overdraft limit increase rejected email
 */
const sendOverdraftLimitRejectedEmail = async (toEmail, userName, comment) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) { throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS environment variables.'); }
  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.3);">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">❌ OD Limit Request Rejected</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#fff;font-size:16px;">Dear <strong>${displayName}</strong>,</p>
        <p style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">Your overdraft limit increase request has been <strong style="color:#ef4444;">rejected</strong>.</p>
        ${comment ? `<div style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;border-radius:8px;padding:16px;"><p style="color:#fca5a5;font-size:13px;margin:0;"><strong>Reason:</strong> ${comment}</p></div>` : ''}
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:16px;">You can submit a new request after reviewing your usage. Contact support if you have questions.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `❌ Overdraft Limit Increase Rejected — Adnate PayNest`,
    text: `Dear ${displayName},\n\nYour overdraft limit increase request was rejected.${comment ? `\n\nReason: ${comment}` : ''}\n\nAdnate PayNest`,
    html: htmlContent,
  });
};

const sendMonthlyTransactionStatementEmail = async ({
  toEmail,
  userName,
  monthLabel,
  filename,
  attachment,
}) => {
  const displayName = getDisplayName(userName);
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.');
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${monthLabel} Transaction Statement — Adnate PayNest`,
    text: `Dear ${displayName},\n\nYour Adnate PayNest transaction statement for ${monthLabel} is attached to this email.\n\nThank you for using Adnate PayNest.\n\nRegards,\nAdnate PayNest Team 🤝🏻`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(56,189,248,0.3);">
        <div style="padding:32px 24px;text-align:center;background:linear-gradient(135deg,#0a2e5c,#164e63);">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Monthly Transaction Statement</h1>
          <p style="margin:8px 0 0;color:#bae6fd;font-size:14px;">${monthLabel}</p>
        </div>
        <div style="padding:32px 24px;color:#e2e8f0;">
          <p style="margin:0 0 16px;font-size:16px;">Dear <strong>${displayName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#cbd5e1;">
            Your Adnate PayNest transaction statement for ${monthLabel} is attached to this email as an Excel file.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;">
            Thank you for using Adnate PayNest.<br/><br/>
            Regards,<br/><strong style="color:#fff;">Adnate PayNest Team &#129309;&#127995;</strong>
          </p>
        </div>
      </div>
    `,
    attachments: [{
      filename,
      content: attachment,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  });
};

const formatOverdraftEmailCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

const sendOverdraftEmail = async ({ toEmail, subject, heading, intro, details, closing }) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error('Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.');
  }

  const detailRows = details.map(({ label, value }) => `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">${label}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${value}</td>
    </tr>
  `).join('');

  await createTransporter().sendMail({
    from: `"Adnate PayNest" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    text: [
      'Hey PayNester Elite 🌟,',
      '',
      intro,
      '',
      ...details.map(({ label, value }) => `${label}: ${value}`),
      '',
      closing,
      '',
      'Thank you for banking with Adnate PayNest.',
      '',
      'Regards,',
      'Adnate PayNest Team 🤝🏻',
      'Your Trust, Our Secure Technology',
    ].join('\n'),
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(56,189,248,0.3);">
        <div style="padding:32px 24px;text-align:center;background:linear-gradient(135deg,#0a2e5c,#164e63);">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">${heading}</h1>
          <p style="margin:8px 0 0;color:#bae6fd;font-size:14px;">Adnate PayNest</p>
        </div>
        <div style="padding:32px 24px;color:#e2e8f0;">
          <p style="margin:0 0 18px;color:#fff;font-size:16px;font-weight:700;">Hey PayNester Elite &#127775;,</p>
          <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.7;">${intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
            ${detailRows}
          </table>
          <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.7;">${closing}</p>
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">
            Thank you for banking with Adnate PayNest.<br/><br/>
            Regards,<br/>
            <strong style="color:#fff;">Adnate PayNest Team &#129309;&#127995;</strong><br/>
            Your Trust, Our Secure Technology
          </p>
        </div>
      </div>
    `,
  });
};

const sendOverdraftUsedEmail = (data) => sendOverdraftEmail({
  toEmail: data.toEmail,
  subject: 'Overdraft Used Successfully — Adnate PayNest',
  heading: 'Overdraft Used Successfully',
  intro: 'Your overdraft request has been successfully processed, and the funds have been transferred.',
  details: [
    { label: 'Customer ID', value: data.customerId },
    { label: 'Customer Name', value: getDisplayName(data.customerName) },
    { label: 'Account Type', value: data.accountType },
    { label: 'Overdraft Amount Used', value: formatOverdraftEmailCurrency(data.amountUsed) },
    { label: 'Total Overdraft Used This Month', value: formatOverdraftEmailCurrency(data.totalUsedThisMonth) },
    { label: 'Outstanding Overdraft', value: formatOverdraftEmailCurrency(data.outstandingAmount) },
    { label: 'Overdraft Usage This Month', value: `${data.monthlyUsageCount} / 3` },
    { label: 'Remaining Uses', value: String(Math.max(0, 3 - Number(data.monthlyUsageCount || 0))) },
    { label: 'Transaction ID', value: data.transactionId || 'Not available' },
    { label: 'Date & Time', value: data.dateTime },
  ],
  closing: 'Please remember that the overdraft amount should be repaid till the end of month to maintain uninterrupted overdraft eligibility.',
});

const sendAllOverdraftChancesUsedEmail = (data) => sendOverdraftEmail({
  toEmail: data.toEmail,
  subject: 'All 3 Monthly Overdraft Chances Used — Adnate PayNest',
  heading: 'All 3 Monthly Overdraft Chances Used',
  intro: 'This is to inform you that you have successfully utilized all three overdraft opportunities available for the current month.',
  details: [
    { label: 'Customer ID', value: data.customerId },
    { label: 'Customer Name', value: getDisplayName(data.customerName) },
    { label: 'Account Type', value: data.accountType },
    { label: 'Total Overdraft Outstanding', value: formatOverdraftEmailCurrency(data.outstandingAmount) },
    { label: 'Monthly Usage', value: '3 / 3' },
    { label: 'Remaining Uses', value: '0' },
  ],
  closing: 'Your overdraft facility will remain unavailable until the outstanding overdraft amount has been fully repaid. Once your repayment is successfully completed, your overdraft eligibility will be restored according to Adnate PayNest policies.',
});

const sendMonthEndOverdraftReminderEmail = (data) => sendOverdraftEmail({
  toEmail: data.toEmail,
  subject: 'Month-End Overdraft Payment Reminder — Adnate PayNest',
  heading: 'Month-End Overdraft Payment Reminder',
  intro: 'Our records indicate that you have an outstanding overdraft balance that has not yet been repaid.',
  details: [
    { label: 'Customer ID', value: data.customerId },
    { label: 'Customer Name', value: getDisplayName(data.customerName) },
    { label: 'Outstanding Overdraft', value: formatOverdraftEmailCurrency(data.outstandingAmount) },
    { label: 'Customer Classification', value: data.classification },
    { label: 'Penalty Currently Applied', value: formatOverdraftEmailCurrency(data.currentPenalty) },
    { label: 'Applicable Penalty Rule', value: `${formatOverdraftEmailCurrency(data.penaltyPerDay)} per overdue day` },
    { label: 'Due Date', value: data.dueDate },
  ],
  closing: 'Please repay the outstanding overdraft amount immediately to avoid additional charges. You can repay it from Customer Dashboard → Overdraft → Repay Overdraft.',
});

const sendOverdraftPenaltyAppliedEmail = (data) => sendOverdraftEmail({
  toEmail: data.toEmail,
  subject: 'Penalty Applied for Overdraft Non-Payment — Adnate PayNest',
  heading: 'Penalty Applied for Non-Payment',
  intro: 'We regret to inform you that your overdraft repayment was not received before the due date. As per your customer classification, a penalty has now been applied.',
  details: [
    { label: 'Customer ID', value: data.customerId },
    { label: 'Customer Name', value: getDisplayName(data.customerName) },
    { label: 'Outstanding Overdraft', value: formatOverdraftEmailCurrency(data.outstandingAmount) },
    { label: 'Customer Classification', value: data.classification },
    { label: 'Penalty Charged', value: formatOverdraftEmailCurrency(data.penaltyAmount) },
    { label: 'Penalty Rule', value: `${formatOverdraftEmailCurrency(data.penaltyPerDay)} per overdue day` },
    { label: 'Total Amount Payable', value: formatOverdraftEmailCurrency(data.totalAmountPayable) },
    { label: 'Penalty Applied On', value: data.appliedOn },
  ],
  closing: 'Please clear the outstanding amount along with the applicable penalty at the earliest to continue enjoying uninterrupted banking services and restore your overdraft eligibility. Repayment is available from Customer Dashboard → Overdraft → Repay Overdraft.',
});

const sendLoanApprovedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `Loan Application Approved — ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nWe are pleased to inform you that your loan application has been approved and disbursed.\n\nLoan Number: ${data.loanNumber}\nLoan Type: ${data.loanType}\nApproved Amount: ${formatCurrency(data.approvedAmount)}\nInterest Rate: ${data.interestRate}% p.a.\nTenure: ${data.tenure} Months\nMonthly EMI: ${formatCurrency(data.monthlyEMI)}\nTotal Repayment: ${formatCurrency(data.totalRepayment)}\nFirst EMI Date: ${data.firstEMIDate}\nAccount: ${data.accountNumber}\n\nThank you for choosing Adnate PayNest.\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Loan Application Approved',
      intro: 'We are pleased to inform you that your loan application has been approved and the funds have been successfully disbursed.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'Loan Type', value: data.loanType },
        { label: 'Approved Amount', value: formatCurrency(data.approvedAmount) },
        { label: 'Interest Rate', value: `${data.interestRate}% p.a.` },
        { label: 'Tenure', value: `${data.tenure} Months` },
        { label: 'Monthly EMI', value: formatCurrency(data.monthlyEMI) },
        { label: 'Total Repayment', value: formatCurrency(data.totalRepayment) },
        { label: 'First EMI Due Date', value: data.firstEMIDate },
        { label: 'Disbursed To Account', value: data.accountNumber },
      ],
      message: 'The approved amount has been credited to your linked account. Your monthly EMIs will be automatically deducted starting from the first due date.',
    }),
  });
};

const sendLoanRejectedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `Loan Application Rejected — ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nWe regret to inform you that your loan application has been rejected.\n\nLoan Number: ${data.loanNumber}\nLoan Type: ${data.loanType}\nRequested Amount: ${formatCurrency(data.amount)}\nReason: ${data.reason}\n\nIf you have any questions, please contact support.\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Loan Application Rejected',
      intro: 'We regret to inform you that after careful review, your loan application has been rejected.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'Loan Type', value: data.loanType },
        { label: 'Requested Amount', value: formatCurrency(data.amount) },
        { label: 'Rejection Reason', value: data.reason },
      ],
      message: 'If you have any questions or would like to discuss this decision, please contact your account manager.',
    }),
  });
};

const sendLoanApplicationStatusEmail = async (toEmail, data) => {
  const details = (data.details || []).map(([label, value]) => ({ label, value }));
  const displayName = getDisplayName(data.customerName);
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `${data.heading} — Adnate PayNest`,
    text: `Dear ${displayName},\n\n${data.message}\n\n${details.map((item) => `${item.label}: ${item.value}`).join('\n')}\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: data.heading,
      intro: data.message,
      details,
      message: 'You can track this application from Customer Dashboard → Loans & EMI.',
    }),
  });
};

const sendLoanDisbursedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `Loan Funds Disbursed — ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nYour loan funds have been successfully disbursed to your account.\n\nLoan Number: ${data.loanNumber}\nDisbursed Amount: ${formatCurrency(data.amount)}\nLinked Account: ${data.accountNumber}\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Loan Funds Disbursed',
      intro: 'The funds for your approved loan have been successfully disbursed to your linked account.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'Disbursed Amount', value: formatCurrency(data.amount) },
        { label: 'Linked Account', value: data.accountNumber },
        { label: 'Disbursement Date', value: formatEmailDate(new Date()) },
      ],
      message: 'You can now use the funds for your business or personal needs. Thank you for choosing Adnate PayNest.',
    }),
  });
};

const sendEMIDeductedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `EMI Deduction Successful — Loan ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nYour monthly EMI has been successfully deducted.\n\nLoan Number: ${data.loanNumber}\nEMI Number: ${data.emiNumber} / ${data.totalEMIs}\nEMI Amount: ${formatCurrency(data.emiAmount)}\nAccount: ${data.accountNumber}\nReference: ${data.transactionRef}\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'EMI Deduction Successful',
      intro: 'This is a receipt for your monthly loan EMI deduction.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'EMI Number', value: `${data.emiNumber} / ${data.totalEMIs}` },
        { label: 'Amount Deducted', value: formatCurrency(data.emiAmount) },
        { label: 'Deducted From Account', value: data.accountNumber },
        { label: 'Transaction Reference', value: data.transactionRef },
        { label: 'Deduction Date', value: formatEmailDate(new Date()) },
      ],
      message: 'Your payment has been successfully recorded. Thank you for your timely repayment.',
    }),
  });
};

const sendEMIPaymentSuccessEmail = async (toEmail, data) => {
  const paymentDate = data.paymentDate || formatEmailDate(new Date());
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: 'EMI Payment Successful - Adnate PayNest',
    text: `Hey PayNester Elite 🌟,

Your EMI payment has been successfully processed.

EMI Payment Details:

EMI No: ${data.emiNumber}
Due Date: ${data.dueDate}
Principal Paid: ${formatCurrency(data.principalPaid)}
Interest Paid: ${formatCurrency(data.interestPaid)}
EMI Amount: ${formatCurrency(data.emiAmount)}
Outstanding Balance: ${formatCurrency(data.outstandingBalance)}
Payment Status: Paid
Payment Date: ${paymentDate}

Thank you for banking with Adnate PayNest.

Regards,
Adnate PayNest Team 🤝🏻
Your Trust, Our Secure Technology`,
    html: buildPremiumBankingEmail({
      heading: 'EMI Payment Successful',
      intro: 'Your EMI payment has been successfully processed.',
      details: [
        { label: 'EMI No', value: data.emiNumber },
        { label: 'Due Date', value: data.dueDate },
        { label: 'Principal Paid', value: formatCurrency(data.principalPaid) },
        { label: 'Interest Paid', value: formatCurrency(data.interestPaid) },
        { label: 'EMI Amount', value: formatCurrency(data.emiAmount) },
        { label: 'Outstanding Balance', value: formatCurrency(data.outstandingBalance) },
        { label: 'Payment Status', value: 'Paid' },
        { label: 'Payment Date', value: paymentDate },
      ],
      message: 'Thank you for banking with Adnate PayNest. Your Trust, Our Secure Technology.',
    }),
  });
};

const sendEMIPaymentFailedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: 'EMI Payment Failed - Adnate PayNest',
    text: `Hey PayNester Elite 🌟,

We could not process your EMI payment.

EMI No: ${data.emiNumber}
Due Date: ${data.dueDate}
EMI Amount: ${formatCurrency(data.emiAmount)}
Reason: ${data.reason}
Payment Status: Failed

Please add sufficient funds to your repayment account and try again.

Regards,
Adnate PayNest Team 🤝🏻
Your Trust, Our Secure Technology`,
    html: buildPremiumBankingEmail({
      heading: 'EMI Payment Failed',
      intro: 'We could not process your EMI payment.',
      details: [
        { label: 'EMI No', value: data.emiNumber },
        { label: 'Due Date', value: data.dueDate },
        { label: 'EMI Amount', value: formatCurrency(data.emiAmount) },
        { label: 'Reason', value: data.reason },
        { label: 'Payment Status', value: 'Failed' },
      ],
      message: 'Please add sufficient funds to your repayment account and try again.',
    }),
  });
};

const sendEMIMissedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `⚠️ Urgent: EMI Payment Missed — Loan ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nWe were unable to deduct your loan EMI due to insufficient balance.\n\nLoan Number: ${data.loanNumber}\nEMI Number: ${data.emiNumber}\nEMI Amount: ${formatCurrency(data.emiAmount)}\nPenalty Applied: ${formatCurrency(data.penalty)}\nOutstanding: ${formatCurrency(data.outstandingBalance)}\nDue Date: ${data.dueDate}\n\nPlease add funds to avoid additional penalties.\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Loan EMI Missed',
      intro: 'We were unable to deduct your monthly loan EMI due to insufficient balance in your linked account.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'EMI Number', value: data.emiNumber },
        { label: 'EMI Amount', value: formatCurrency(data.emiAmount) },
        { label: 'Late Payment Penalty', value: formatCurrency(data.penalty) },
        { label: 'Outstanding Balance', value: formatCurrency(data.outstandingBalance) },
        { label: 'Scheduled Due Date', value: data.dueDate },
      ],
      message: 'A penalty has been applied as per your loan agreement. Please add sufficient funds to your linked account to clear the outstanding amount immediately.',
    }),
  });
};

const sendLoanClosedEmail = async (toEmail, data) => {
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: `Loan Closed Successfully — ${data.loanNumber}`,
    text: `Hey PayNest Elite 🌟,\n\nCongratulations! Your loan has been fully repaid and officially closed.\n\nLoan Number: ${data.loanNumber}\nLoan Type: ${data.loanType}\nTotal Repaid: ${formatCurrency(data.totalRepaid)}\nClosure Date: ${formatEmailDate(new Date())}\n\nRegards,\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: 'Loan Closed Successfully',
      intro: 'Congratulations! Your loan has been fully repaid and officially closed.',
      details: [
        { label: 'Loan Number', value: data.loanNumber },
        { label: 'Loan Type', value: data.loanType },
        { label: 'Total Repaid', value: formatCurrency(data.totalRepaid) },
        { label: 'Closure Date', value: formatEmailDate(new Date()) },
      ],
      message: 'We appreciate your prompt repayments throughout the tenure. A No Objection Certificate (NOC) and final statement will be sent to you shortly.',
    }),
  });
};

const sendInvestmentEmail = async (toEmail, data) => {
  const details = Array.isArray(data.details)
    ? data.details.map(([label, value]) => ({ label, value }))
    : [];
  return sendAutomaticBankingEmail({
    to: toEmail,
    subject: data.subject || 'Adnate PayNest Investment Update',
    text: `${data.heading || 'Investment Update'}\n\n${details.map((item) => `${item.label}: ${item.value}`).join('\n')}\n\n${data.message || ''}\n\nAdnate PayNest Team`,
    html: buildPremiumBankingEmail({
      heading: data.heading || 'Investment Update',
      intro: 'Here is the latest update for your Adnate PayNest investment product.',
      details,
      message: data.message || 'Please log in to your dashboard for more details.',
    }),
  });
};

module.exports = { 
  verifyEmailTransporter,
  generateTempPassword, 
  sendTempPasswordEmail, 
  sendPasswordResetEmail,
  sendNewUserWelcomeEmail,
  sendTransferSuccessEmail, 
  sendTransferFailureEmail,
  sendTransferNotificationEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendOverdraftLimitApprovedEmail,
  sendOverdraftLimitRejectedEmail,
  sendTransferLimitApprovedEmail,
  sendAccountTypeApprovedEmail,
  sendClassificationLimitsUpdatedEmail,
  sendMonthlyTransactionStatementEmail,
  sendOverdraftUsedEmail,
  sendAllOverdraftChancesUsedEmail,
  sendMonthEndOverdraftReminderEmail,
  sendOverdraftPenaltyAppliedEmail,
  sendLoanApprovedEmail,
  sendLoanRejectedEmail,
  sendLoanApplicationStatusEmail,
  sendLoanDisbursedEmail,
  sendEMIDeductedEmail,
  sendEMIPaymentSuccessEmail,
  sendEMIPaymentFailedEmail,
  sendEMIMissedEmail,
  sendLoanClosedEmail,
  sendInvestmentEmail,
};
