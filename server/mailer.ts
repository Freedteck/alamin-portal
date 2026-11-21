import nodemailer from 'nodemailer';

const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPassword = process.env.SMTP_PASSWORD || '';
const smtpFrom = (process.env.SMTP_FROM || '').trim();

export function isPasswordResetEmailConfigured() {
  return Boolean(smtpHost && Number.isInteger(smtpPort) && smtpPort > 0 && smtpUser && smtpPassword && smtpFrom);
}

export async function sendPasswordResetEmail(email: string, otp: string) {
  if (!isPasswordResetEmailConfigured()) {
    throw new Error('Password reset email delivery is not configured.');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword }
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: 'Al-Amin Schools password reset',
    text: `Your password reset code is ${otp}. It expires in 15 minutes. If you did not request this, ignore this email.`,
    html: `<p>Your Al-Amin Schools password reset code is <strong>${otp}</strong>.</p><p>It expires in 15 minutes. If you did not request this, ignore this email.</p>`
  });
}
