import { Resend } from 'resend';
import { logApiError } from './logger';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY ?? '');
  }
  return resend;
}

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@boxzenj.com';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set. Email to ${to} not sent: ${subject}`);
    return;
  }

  try {
    await getResend().emails.send({ from: EMAIL_FROM, to, subject, html });
  } catch (error) {
    logApiError('lib/email', 'sendEmail', error);
    throw error;
  }
}
