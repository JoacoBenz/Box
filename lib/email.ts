import nodemailer from 'nodemailer';
import { logApiError } from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

const EMAIL_FROM = process.env.EMAIL_FROM ?? `BoxZenj <${process.env.GMAIL_USER ?? 'noreply@boxzenj.com'}>`;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`[email] GMAIL credentials not set. Email to ${to} not sent: ${subject}`);
    return;
  }

  try {
    await getTransporter().sendMail({ from: EMAIL_FROM, to, subject, html });
  } catch (error) {
    logApiError('lib/email', 'sendEmail', error);
    throw error;
  }
}
