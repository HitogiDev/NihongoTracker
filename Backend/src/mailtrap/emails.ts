import {
  VERIFICATION_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
} from './emailTemplates.js';
import { sendEmail } from './mailtrap.config.js';

export async function sendVerificationEmail(to: string, token: string) {
  try {
    const subject = 'Verify Your Email Address';
    const verificationURL = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    const html = VERIFICATION_EMAIL_TEMPLATE.replace(
      /{verificationURL}/g,
      verificationURL
    );
    return await sendEmail(to, subject, html, 'Verification');
  } catch (error) {
    console.error('Error in sendVerificationEmail:', error);
  }
}

export async function sendPasswordResetEmail(to: string, link: string) {
  try {
    const subject = 'Reset Your Password';
    const html = PASSWORD_RESET_REQUEST_TEMPLATE.replace('{resetURL}', link);
    return await sendEmail(to, subject, html, 'PasswordReset');
  } catch (error) {
    console.error('Error in sendPasswordResetEmail:', error);
  }
}

export async function sendPasswordResetSuccessEmail(to: string) {
  try {
    const subject = 'Your Password Has Been Reset';
    const html = PASSWORD_RESET_SUCCESS_TEMPLATE;
    return await sendEmail(to, subject, html, 'PasswordResetSuccess');
  } catch (error) {
    console.error('Error in sendPasswordResetSuccessEmail:', error);
  }
}
