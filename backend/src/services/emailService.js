// services/emailService.js — optional SMTP mail (nodemailer).
// Sends the registration verification mail and the password-reset mail.
// Mailing is optional: when SMTP_HOST / SMTP_USER / SMTP_PASS are not set,
// isSmtpConfigured() is false, sendEmail logs the mail to the console
// (dev only) and returns false instead of failing. No SMTP is configured
// in production, so the admin-OTP flow (see routes/auth2.js) is the
// working password-reset path.
const nodemailer = require('nodemailer');
require('dotenv').config();

// Creates (once) the nodemailer transporter from the SMTP env vars;
// returns null when SMTP is not configured.
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Sends one mail. Without SMTP it logs the message to the console
// (dev only) and returns false.
async function sendEmail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n[DEV EMAIL] To:', to);
      console.log('[DEV EMAIL] Subject:', subject);
      console.log('[DEV EMAIL] Body:', html.replace(/<[^>]+>/g,'').trim());
      console.log('[DEV EMAIL] ---\n');
    }
    return { devMode: true };
  }
  return transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

// Sends the registration verification mail with the confirm link built
// from the token and the site URL.
async function sendVerifyEmail(to, token, siteUrl) {
  const link = `${siteUrl}/verify-email?token=${token}`;
  await sendEmail(to, 'Verify your Nexora Fx email', `
    <p>Welcome to Nexora Fx!</p>
    <p>Click below to verify your email address:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 24 hours.</p>
  `);
}

// Sends the password-reset mail with the reset link.
async function sendResetEmail(to, token, siteUrl) {
  const link = `${siteUrl}/reset-password?token=${token}`;
  await sendEmail(to, 'Reset your Nexora Fx password', `
    <p>You requested a password reset for your Nexora Fx account.</p>
    <p>Click below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore it.</p>
  `);
}

// True only when SMTP_HOST, SMTP_USER and SMTP_PASS are all set.
function isSmtpConfigured() {
  return !!process.env.SMTP_HOST;
}

module.exports = { sendEmail, sendVerifyEmail, sendResetEmail, isSmtpConfigured };
