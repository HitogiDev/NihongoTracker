import { MailtrapClient } from 'mailtrap';
import dotenv from 'dotenv';

dotenv.config();

const client = new MailtrapClient({
  token: process.env.MAILTRAP_TOKEN || '',
});

const sender = {
  email: `no-reply@${process.env.MAILTRAP_INBOX_DOMAIN || 'demomailtrap.co'}`,
};

export async function sendEmail(
  recipients: Array<{ email: string }> | string,
  subject: string,
  html: string,
  category?: string
) {
  try {
    await client.send({
      from: sender,
      to: recipients instanceof Array ? recipients : [{ email: recipients }],
      subject: subject,
      html: html,
      category: category || 'General',
    });
    console.log(
      `Email sent to ${recipients instanceof Array ? recipients.map((r) => r.email).join(', ') : recipients}`
    );
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
