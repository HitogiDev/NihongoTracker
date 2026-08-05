import { getEmailStrings, resolveEmailLanguage } from '../i18n/emailStrings.js';

/**
 * Email bodies are built per language from `i18n/emailStrings.ts`. The markup
 * is shared; only the copy and the `<html lang>` change.
 */

const BODY_STYLE =
  'font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;';
const HEADER_STYLE =
  'background: linear-gradient(to right, #625dfe, #f2329a); padding: 20px; text-align: center;';
const CARD_STYLE =
  'background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);';
const BUTTON_STYLE =
  'background-color: #5754e8; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;';
const FOOTER_STYLE =
  'text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;';

/** Recipient-supplied values never reach these templates, but escape anyway. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(
  language: string,
  title: string,
  heading: string,
  content: string,
  automated: string
): string {
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="${BODY_STYLE}">
  <div style="${HEADER_STYLE}">
    <h1 style="color: white; margin: 0;">${heading}</h1>
  </div>
  <div style="${CARD_STYLE}">
${content}
  </div>
  <div style="${FOOTER_STYLE}">
    <p>${automated}</p>
  </div>
</body>
</html>
`;
}

export function verificationEmailTemplate(
  verificationURL: string,
  language: string
): string {
  const lang = resolveEmailLanguage(language);
  const t = getEmailStrings(lang).verification;
  const url = escapeHtml(verificationURL);

  return shell(
    lang,
    t.heading,
    t.heading,
    `    <p>${t.greeting}</p>
    <p>${t.intro}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="${BUTTON_STYLE}">${t.button}</a>
    </div>
    <p>${t.orCopy}</p>
    <p style="word-break: break-all; color: #5754e8;">${url}</p>
    <p>${t.expiry}</p>
    <p>${t.ignore}</p>
    <p>${t.signOff}<br>NihongoTracker</p>`,
    t.automated
  );
}

export function passwordResetRequestTemplate(
  resetURL: string,
  language: string
): string {
  const lang = resolveEmailLanguage(language);
  const t = getEmailStrings(lang).passwordReset;
  const url = escapeHtml(resetURL);

  return shell(
    lang,
    t.heading,
    t.heading,
    `    <p>${t.greeting}</p>
    <p>${t.intro}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="${BUTTON_STYLE}">${t.button}</a>
    </div>
    <p>${t.expiry}</p>
    <p>${t.ignore}</p>
    <p>${t.signOff}<br>NihongoTracker</p>`,
    t.automated
  );
}

export function passwordResetSuccessTemplate(language: string): string {
  const lang = resolveEmailLanguage(language);
  const t = getEmailStrings(lang).passwordResetSuccess;

  return shell(
    lang,
    t.heading,
    t.heading,
    `    <p>${t.greeting}</p>
    <p>${t.intro}</p>
    <p>${t.adviceIntro}</p>
    <ul>
${t.advice.map((line) => `      <li>${line}</li>`).join('\n')}
    </ul>
    <p>${t.signOff}<br>NihongoTracker</p>`,
    t.automated
  );
}
