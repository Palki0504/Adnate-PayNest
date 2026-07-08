require('dotenv').config();

const nodemailer = require('nodemailer');

const getEmailCredentials = () => ({
  user: (process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.EMAIL_FROM)?.trim(),
  pass: process.env.EMAIL_SERVICE === 'gmail_api' || process.env.EMAIL_SERVICE === 'gmail-api'
    ? process.env.GMAIL_REFRESH_TOKEN?.trim()
    : process.env.EMAIL_SERVICE === 'gmail'
    ? process.env.EMAIL_PASS?.replace(/\s/g, '')
    : (process.env.BREVO_API_KEY || process.env.EMAIL_API_KEY || process.env.EMAIL_PASS)?.trim(),
});

const hasGmailApiConfig = () =>
  Boolean(
    (process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.EMAIL_FROM)?.trim()
    && process.env.GMAIL_CLIENT_ID?.trim()
    && process.env.GMAIL_CLIENT_SECRET?.trim()
    && process.env.GMAIL_REFRESH_TOKEN?.trim()
  );

const base64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

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

const createTransporter = () => {
  const auth = getEmailCredentials();
  const service = (process.env.EMAIL_SERVICE || 'smtp').trim().toLowerCase();

  if (service === 'gmail_api' || service === 'gmail-api' || hasGmailApiConfig()) {
    return {
      verify: async () => {
        await getGmailApiAccessToken();
        return true;
      },
      sendMail: async (mailOptions) => {
        const accessToken = await getGmailApiAccessToken();
        const raw = [
          `From: "Adnate PayNest" <${auth.user}>`,
          `To: ${mailOptions.to}`,
          `Subject: ${mailOptions.subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset="UTF-8"',
          '',
          mailOptions.text,
        ].join('\r\n');
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ raw: base64Url(raw) }),
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`Gmail send ${response.status}: ${body}`);
        return body ? JSON.parse(body) : {};
      },
    };
  }

  if (service === 'brevo') {
    return {
      verify: async () => true,
      sendMail: async (mailOptions) => {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': auth.pass,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { email: auth.user, name: 'Adnate PayNest' },
            to: [{ email: mailOptions.to }],
            subject: mailOptions.subject,
            textContent: mailOptions.text,
          }),
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`Brevo API ${response.status}: ${body}`);
        return body ? JSON.parse(body) : {};
      },
    };
  }

  if (service === 'gmail') {
    const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com',
      port,
      secure: port === 465,
      family: 4,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      auth,
    });
  }

  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth,
  });
};

const main = async () => {
  const to = process.argv[2] || process.env.EMAIL_USER;
  const auth = getEmailCredentials();

  console.log(`EMAIL_SERVICE=${process.env.EMAIL_SERVICE || 'smtp'}`);
  console.log(`EMAIL_USER_SET=${Boolean(auth.user)}`);
  console.log(`EMAIL_PASS_LENGTH=${auth.pass?.length || 0}`);
  console.log(`TO=${to}`);

  if (!auth.user || !auth.pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS are required.');
  }

  const transporter = createTransporter();
  await transporter.verify();
  console.log('SMTP verification: OK');

  const info = await transporter.sendMail({
    from: `"Adnate PayNest" <${auth.user}>`,
    to,
    subject: 'Adnate PayNest email test',
    text: 'This is a test email from Adnate PayNest.',
  });

  console.log(`Test email sent: ${info.messageId}`);
};

main().catch((error) => {
  console.error('Email test failed:');
  console.error(error.code || error.name || 'Error');
  console.error(error.message);
  process.exit(1);
});
