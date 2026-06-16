const nodemailer = require('nodemailer');
const path = require('path');
const { randomUUID } = require('crypto');

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

const getEmailCredentials = () => ({
  user: process.env.EMAIL_USER?.trim(),
  pass: process.env.EMAIL_PASS?.trim(),
});

const isPlaceholderConfig = ({ user, pass }) =>
  !user ||
  !pass ||
  user.includes('your-email') ||
  pass.includes('your-app-password') ||
  user.includes('your_mailtrap');

// ─── Create transporter (SMTP or Gmail service) ─────────────────────────────
const createTransporter = () => {
  const auth = getEmailCredentials();
  const transporter = process.env.EMAIL_SERVICE === 'gmail'
    ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: auth.user,
        pass: auth.pass,
      },
    })
    : (() => {
      const host = process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io';
      const port = parseInt(process.env.EMAIL_PORT, 10) || 2525;
      return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: auth.user, pass: auth.pass },
      });
    })();

  const sendMail = transporter.sendMail.bind(transporter);
  transporter.sendMail = (mailOptions) => sendMail(decorateMailOptions(mailOptions));
  return transporter;
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
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 8px;">Hello <strong>${userName}</strong>,</p>
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
    `Hello ${userName},`,
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
        'Mailtrap rejected the login. Verify EMAIL_USER and EMAIL_PASS environment variables.'
      );
    }
    throw err;
  }
};

/**
 * Send password reset email with secure token link to user
 */
const sendPasswordResetEmail = async (toEmail, token, userName) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    throw new Error(
      'Email is not configured. Set EMAIL_USER and EMAIL_PASS in server/.env.'
    );
  }

  const transporter = createTransporter();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${clientUrl}/reset-password?token=${token}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; border-radius: 16px; overflow: hidden; border: 1px solid rgba(245,158,11,0.3);">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; color: #0a0e27; font-size: 24px; font-weight: 800;">🏦 Adnate PayNest Bank</h1>
        <p style="margin: 8px 0 0; color: rgba(10,14,39,0.7); font-size: 14px;">Password Reset Request</p>
      </div>
      <div style="padding: 32px 24px;">
        <p style="color: #ffffff; font-size: 17px; font-weight: 600; margin: 0 0 16px;">Hey PayNester Elite 🌟,</p>
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
    'Hey PayNester Elite 🌟,',
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
        'Mailtrap rejected the login. Verify EMAIL_USER and EMAIL_PASS environment variables.'
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
  const subject = 'Welcome to Adnate PayNest \u2013 Your Account Login Credentials';

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
              <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#ffffff;">Hey PayNester Elite &#127775;,</p>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                Welcome to <strong>Adnate PayNest Bank</strong>.
              </p>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#cbd5e1;">
                Your customer account has been created successfully. Below are your temporary login credentials. Please use these to sign in and activate your account.
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
                          <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Temporary Password</span><br/>
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
                      Login to Portal
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table data-paynest-card="true" role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;margin-bottom:16px;">
                <tr>
                  <td style="padding:18px 20px;color:#0f2d5e;">
                    <p style="margin:0;font-size:13px;line-height:1.6;font-weight:500;">
                      <strong>⚠️ Important Security Notice:</strong> You will be required to change this temporary password immediately upon your first login. Do not share your credentials, password, or OTP with anyone.
                    </p>
                  </td>
                </tr>
              </table>

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

  const textContent = [
    'Hey PayNester Elite 🌟,',
    '',
    'Welcome to Adnate PayNest Bank.',
    '',
    'Your account has been successfully created by the admin.',
    'Please use the login credentials below to access your customer portal:',
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
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
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
        'Mailtrap rejected the login. Verify EMAIL_USER and EMAIL_PASS environment variables.'
      );
    }
    throw err;
  }
};

const sendTransferSuccessEmail = async (toEmail, receiverName, senderName, amount, transactionId, direction = 'debit', fromAccount, toAccount) => {
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
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Dear ${receiverName},</p>
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
              <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">${isCredit ? senderName : receiverName}</p>
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
    `* ${isCredit ? 'Received From' : 'Sent To'}: ${isCredit ? senderName : receiverName}`,
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
        <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Hello <strong>${senderName}</strong>,</p>
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
              <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">${recipientName}</p>
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
    `To: ${recipientName}`,
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
    subject: `✗ Transfer Failed — ₹${amount} to ${recipientName}`,
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
          <p style="color: #ffffff; font-size: 16px; margin: 0 0 24px;">Dear Customer,</p>
          <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Your transfer to ${otherPartyName} could not be completed. Here are the details:
          </p>
          <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 12px;"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 12px;"><strong>Recipient:</strong> ${otherPartyName}</p>
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
     'Hey PayNester Elite 🌟,',
      '',
      'Your transfer could not be completed.',
      '',
      'Transaction Details:',
      `* Amount: ₹${amount}`,
      `* Recipient: ${otherPartyName}`,
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
        <p style="color: #ffffff; font-size: 15px; margin: 0 0 24px;">Dear Customer,</p>
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
            <p style="color: #ffffff; font-size: 13px; margin: 0;">${otherPartyName}</p>
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
    'Hey PayNester Elite 🌟,',
    '',
    'Your account has been successfully ' + (isCredit ? 'credited' : 'debited') + '.',
    '',
    'Transaction Details:',
    '',
    `* Transaction ID: ${transactionId}`,
    `* Amount ${isCredit ? 'Credited' : 'Debited'}: ₹${amount}`,
    `* ${isCredit ? 'Received From' : 'Sent To'}: ${otherPartyName}`,
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
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) {
    console.warn('Email not configured. Skipping registration approved email.');
    return;
  }
  const transporter = createTransporter();
  const roleLabel = role === 'manager' ? 'Manager' : 'Customer';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(34,197,94,0.3);">
      <div style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;">✅ Account Approved!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#ffffff;font-size:16px;margin:0 0 16px;">Dear <strong>${userName}</strong>,</p>
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
    text: `Dear ${userName},\n\nYour ${roleLabel} account has been approved. You can now log in at ${clientUrl}/login\n\nAdnate PayNest`,
    html: htmlContent,
  }).catch((err) => console.error('sendRegistrationApprovedEmail error:', err.message));
};

/**
 * Send registration rejected email
 */
const sendRegistrationRejectedEmail = async (toEmail, userName, role, reason) => {
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
        <p style="color:#ffffff;font-size:16px;margin:0 0 16px;">Dear <strong>${userName}</strong>,</p>
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
    text: `Dear ${userName},\n\nYour ${roleLabel} account registration was rejected.${reason ? `\nReason: ${reason}` : ''}\n\nContact support for more info.\n\nAdnate PayNest`,
    html: htmlContent,
  }).catch((err) => console.error('sendRegistrationRejectedEmail error:', err.message));
};

/**
 * Send overdraft limit increase approved email
 */
const sendOverdraftLimitApprovedEmail = async (toEmail, userName, newLimit, comment) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) { console.warn('Email not configured.'); return; }
  const transporter = createTransporter();
  const formattedLimit = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(newLimit);

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(34,197,94,0.3);">
      <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">✅ OD Limit Increase Approved</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#fff;font-size:16px;">Dear <strong>${userName}</strong>,</p>
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
    text: `Dear ${userName},\n\nYour overdraft limit has been increased to ${formattedLimit}.${comment ? `\n\nManager Comment: ${comment}` : ''}\n\nAdnate PayNest`,
    html: htmlContent,
  }).catch((err) => console.error('sendOverdraftLimitApprovedEmail error:', err.message));
};

/**
 * Send overdraft limit increase rejected email
 */
const sendOverdraftLimitRejectedEmail = async (toEmail, userName, comment) => {
  const auth = getEmailCredentials();
  if (isPlaceholderConfig(auth)) { console.warn('Email not configured.'); return; }
  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0e27;border-radius:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.3);">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">❌ OD Limit Request Rejected</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Adnate PayNest</p>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#fff;font-size:16px;">Dear <strong>${userName}</strong>,</p>
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
    text: `Dear ${userName},\n\nYour overdraft limit increase request was rejected.${comment ? `\n\nReason: ${comment}` : ''}\n\nAdnate PayNest`,
    html: htmlContent,
  }).catch((err) => console.error('sendOverdraftLimitRejectedEmail error:', err.message));
};

module.exports = { 
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
};
