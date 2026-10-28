import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Types } from 'mongoose';
import MobileSession from '../models/mobileSession.model.js';
import User from '../models/user.model.js';
import { SupportedLanguage } from '../types.js';
import {
  localizePushText,
  normalizeLanguage,
  type PushTextSource,
} from './pushText.js';

const MAX_PUSH_TITLE = 120;
const MAX_PUSH_BODY = 240;
/** Firebase accepts at most 500 tokens in one multicast request. */
const MULTICAST_LIMIT = 500;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

let firebaseApp: App | null | undefined;

/**
 * Read the service account from FIREBASE_SERVICE_ACCOUNT_JSON.
 * Push delivery is off when the variable is missing or invalid.
 */
function getFirebaseApp(): App | null {
  if (firebaseApp !== undefined) return firebaseApp;
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!credentials) {
    firebaseApp = null;
    return firebaseApp;
  }
  try {
    firebaseApp =
      getApps().find((app) => app.name === 'push') ??
      initializeApp({ credential: cert(JSON.parse(credentials)) }, 'push');
  } catch (error) {
    console.error('Failed to initialize Firebase push delivery:', error);
    firebaseApp = null;
  }
  return firebaseApp;
}

export function isPushEnabled() {
  return getFirebaseApp() !== null;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export interface PushMessage extends PushTextSource {
  link?: string | null;
  notificationId?: string;
  /** Android replaces a shown message that has the same tag. */
  tag?: string | null;
}

async function sendToTokens(
  app: App,
  tokens: string[],
  language: SupportedLanguage,
  message: PushMessage
) {
  const text = localizePushText(message, language);
  const invalid: string[] = [];
  for (let start = 0; start < tokens.length; start += MULTICAST_LIMIT) {
    const chunk = tokens.slice(start, start + MULTICAST_LIMIT);
    const response = await getMessaging(app).sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: truncate(text.title, MAX_PUSH_TITLE),
        body: text.body ? truncate(text.body, MAX_PUSH_BODY) : undefined,
      },
      data: {
        ...(message.link ? { link: message.link } : {}),
        ...(message.notificationId
          ? { notificationId: message.notificationId }
          : {}),
      },
      android: {
        priority: 'high',
        notification: { channelId: 'default', tag: message.tag ?? undefined },
      },
    });
    response.responses.forEach((result, index) => {
      if (
        !result.success &&
        result.error &&
        INVALID_TOKEN_CODES.has(result.error.code)
      )
        invalid.push(chunk[index]);
    });
  }
  return invalid;
}

/**
 * Send one push message to every active mobile session of the given users.
 * Each user receives the text in their own language. Delete tokens that
 * Firebase reports as invalid. This function never throws.
 */
export async function sendPushToUsers(
  userIds: Array<Types.ObjectId | string>,
  message: PushMessage
) {
  const app = getFirebaseApp();
  if (!app || !userIds.length) return;
  try {
    const sessions = await MobileSession.find({
      user: { $in: userIds },
      expiresAt: { $gt: new Date() },
      pushToken: { $type: 'string' },
    })
      .select('user pushToken')
      .lean();
    if (!sessions.length) return;

    const users = await User.find({
      _id: { $in: [...new Set(sessions.map((s) => String(s.user)))] },
    })
      .select('settings.language')
      .lean();
    const languages = new Map(
      users.map((user) => [
        String(user._id),
        normalizeLanguage(user.settings?.language),
      ])
    );
    const tokensByLanguage = new Map<SupportedLanguage, string[]>();
    for (const session of sessions) {
      if (!session.pushToken) continue;
      const language = languages.get(String(session.user)) ?? 'en';
      const tokens = tokensByLanguage.get(language) ?? [];
      tokens.push(session.pushToken);
      tokensByLanguage.set(language, tokens);
    }

    const invalid: string[] = [];
    for (const [language, tokens] of tokensByLanguage)
      invalid.push(...(await sendToTokens(app, tokens, language, message)));
    if (invalid.length) {
      await MobileSession.updateMany(
        { pushToken: { $in: invalid } },
        { $unset: { pushToken: 1 } }
      );
    }
  } catch (error) {
    console.error('Failed to send push notification:', error);
  }
}

export function sendPushToUser(
  userId: Types.ObjectId | string,
  message: PushMessage
) {
  return sendPushToUsers([userId], message);
}
