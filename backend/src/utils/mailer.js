const nodemailer = require('nodemailer');

/**
 * Mailer using nodemailer. Requires SMTP environment variables:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.log('[Email stub] To:', to, 'Subject:', subject, 'Body:', text || html || '');
    return { accepted: [to], messageId: 'stub-' + Date.now() };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return await transporter.sendMail({
    from: process.env.SMTP_FROM || `"NivaTV Admin" <noreply@${process.env.SMTP_HOST}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };
