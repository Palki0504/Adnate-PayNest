require('dotenv').config();

const nodemailer = require('nodemailer');

const getEmailCredentials = () => ({
  user: process.env.EMAIL_USER?.trim(),
  pass: process.env.EMAIL_SERVICE === 'gmail'
    ? process.env.EMAIL_PASS?.replace(/\s/g, '')
    : process.env.EMAIL_PASS?.trim(),
});

const createTransporter = () => {
  const auth = getEmailCredentials();
  const service = (process.env.EMAIL_SERVICE || 'smtp').trim().toLowerCase();

  if (service === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
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
