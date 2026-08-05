import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../types.js';

/**
 * Email copy, per language.
 *
 * Emails are the one place the backend *does* produce user-facing text: there
 * is no client to translate them. They always follow the **recipient's**
 * `settings.language`, never the `Accept-Language` of the request that
 * triggered them — someone else's action can send you an email.
 */
interface EmailStrings {
  verification: {
    subject: string;
    heading: string;
    greeting: string;
    intro: string;
    button: string;
    orCopy: string;
    expiry: string;
    ignore: string;
    signOff: string;
    automated: string;
  };
  passwordReset: {
    subject: string;
    heading: string;
    greeting: string;
    intro: string;
    button: string;
    expiry: string;
    ignore: string;
    signOff: string;
    automated: string;
  };
  passwordResetSuccess: {
    subject: string;
    heading: string;
    greeting: string;
    intro: string;
    adviceIntro: string;
    advice: string[];
    signOff: string;
    automated: string;
  };
}

const EMAIL_STRINGS: Record<SupportedLanguage, EmailStrings> = {
  en: {
    verification: {
      subject: 'Verify Your Email Address',
      heading: 'Verify Your Email',
      greeting: 'Hello,',
      intro:
        'Thank you for signing up! Please verify your email address by clicking the button below:',
      button: 'Verify Email Address',
      orCopy: 'Or copy and paste this link into your browser:',
      expiry: 'This link will expire in 24 hours for security reasons.',
      ignore:
        "If you didn't create an account with us, please ignore this email.",
      signOff: 'Best regards,',
      automated:
        'This is an automated message, please do not reply to this email.',
    },
    passwordReset: {
      subject: 'Reset Your Password',
      heading: 'Password Reset',
      greeting: 'Hello,',
      intro:
        'We received a request to reset your password. Click the button below to choose a new one:',
      button: 'Reset Password',
      expiry: 'This link will expire in 1 hour for security reasons.',
      ignore:
        "If you didn't request a password reset, you can safely ignore this email.",
      signOff: 'Best regards,',
      automated:
        'This is an automated message, please do not reply to this email.',
    },
    passwordResetSuccess: {
      subject: 'Your Password Has Been Reset',
      heading: 'Password Reset Successful',
      greeting: 'Hello,',
      intro: 'Your password has been successfully reset.',
      adviceIntro:
        'If you did not make this change, please contact us immediately. For security, we recommend that you:',
      advice: [
        'Use a strong, unique password',
        'Avoid using the same password across multiple sites',
        'Change your password periodically',
      ],
      signOff: 'Best regards,',
      automated:
        'This is an automated message, please do not reply to this email.',
    },
  },
  es: {
    verification: {
      subject: 'Verifica tu dirección de correo',
      heading: 'Verifica tu correo',
      greeting: 'Hola:',
      intro:
        '¡Gracias por registrarte! Verifica tu dirección de correo pulsando el botón de abajo:',
      button: 'Verificar el correo',
      orCopy: 'O copia y pega este enlace en tu navegador:',
      expiry: 'Por seguridad, este enlace caduca en 24 horas.',
      ignore: 'Si no has creado una cuenta con nosotros, ignora este correo.',
      signOff: 'Un saludo,',
      automated: 'Este es un mensaje automático; por favor, no respondas.',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña',
      heading: 'Restablecer la contraseña',
      greeting: 'Hola:',
      intro:
        'Hemos recibido una solicitud para restablecer tu contraseña. Pulsa el botón de abajo para elegir una nueva:',
      button: 'Restablecer la contraseña',
      expiry: 'Por seguridad, este enlace caduca en 1 hora.',
      ignore:
        'Si no has solicitado restablecer la contraseña, puedes ignorar este correo.',
      signOff: 'Un saludo,',
      automated: 'Este es un mensaje automático; por favor, no respondas.',
    },
    passwordResetSuccess: {
      subject: 'Tu contraseña se ha restablecido',
      heading: 'Contraseña restablecida',
      greeting: 'Hola:',
      intro: 'Tu contraseña se ha restablecido correctamente.',
      adviceIntro:
        'Si no has hecho tú este cambio, contáctanos de inmediato. Por seguridad, te recomendamos:',
      advice: [
        'Usar una contraseña fuerte y única',
        'No reutilizar la misma contraseña en varios sitios',
        'Cambiar la contraseña cada cierto tiempo',
      ],
      signOff: 'Un saludo,',
      automated: 'Este es un mensaje automático; por favor, no respondas.',
    },
  },
};

export function isSupportedLanguage(
  value: unknown
): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

/** Normalises to a language we actually have copy for. */
export function resolveEmailLanguage(
  language?: string | null
): SupportedLanguage {
  return isSupportedLanguage(language) ? language : 'en';
}

/** Falls back to English for unset or unknown languages. */
export function getEmailStrings(language?: string | null): EmailStrings {
  return EMAIL_STRINGS[resolveEmailLanguage(language)];
}
