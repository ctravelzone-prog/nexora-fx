// emailService.js — SMTP email + dev console fallback
const nodemailer = require('nodemailer');
require('dotenv').config();

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

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

async function sendVerifyEmail(to, token, siteUrl) {
  const link = `${siteUrl}/verify-email?token=${token}`;
  await sendEmail(to, 'Verify your Nexora Fx email', `
    <p>Welcome to Nexora Fx!</p>
    <p>Click below to verify your email address:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 24 hours.</p>
  `);
}

async function sendResetEmail(to, token, siteUrl) {
  const link = `${siteUrl}/reset-password?token=${token}`;
  await sendEmail(to, 'Reset your Nexora Fx password', `
    <p>You requested a password reset for your Nexora Fx account.</p>
    <p>Click below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore it.</p>
  `);
}

function isSmtpConfigured() {
  return !!process.env.SMTP_HOST;
}

module.exports = { sendEmail, sendVerifyEmail, sendResetEmail, isSmtpConfigured };
