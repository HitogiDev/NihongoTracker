import {
  verificationEmailTemplate,
  passwordResetRequestTemplate,
  passwordResetSuccessTemplate,
} from './emailTemplates.js';
import { getEmailStrings } from '../i18n/emailStrings.js';
import { sendEmail } from './mailtrap.config.js';

function getBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.PROD_DOMAIN ||
    'http://localhost:5173'
  );
}

/**
 * `language` is always the **recipient's** `settings.language`. Using the
 * request's Accept-Language would be wrong for any email triggered by someone
 * else's action; it is only equivalent during signup, where the two coincide.
 * Unset or unknown values fall back to English.
 */
export async function sendVerificationEmail(
  to: string,
  token: string,
  language?: string | null
) {
  try {
    const subject = getEmailStrings(language).verification.subject;
    const verificationURL = `${getBaseUrl()}/verify-email/${token}`;
    const html = verificationEmailTemplate(verificationURL, language ?? 'en');
    return await sendEmail(to, subject, html, 'Verification');
  } catch (error) {
    console.error('Error in sendVerificationEmail:', error);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  link: string,
  language?: string | null
) {
  try {
    const subject = getEmailStrings(language).passwordReset.subject;
    const html = passwordResetRequestTemplate(link, language ?? 'en');
    return await sendEmail(to, subject, html, 'PasswordReset');
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
  }
}

export async function sendPasswordResetSuccessEmail(
  to: string,
  language?: string | null
) {
  try {
    const subject = getEmailStrings(language).passwordResetSuccess.subject;
    const html = passwordResetSuccessTemplate(language ?? 'en');
    return await sendEmail(to, subject, html, 'PasswordResetSuccess');
  } catch (error) {
    console.error('Error in sendPasswordResetSuccessEmail:', error);
  }
}
