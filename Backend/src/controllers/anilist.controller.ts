import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import {
  fetchAnilistViewer,
  syncAnilistForUser,
} from '../services/anilistSync.service.js';
import { IUser } from '../types.js';

const ANILIST_AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';
const ANILIST_TOKEN_URL = 'https://anilist.co/api/v2/oauth/token';
/** AniList access tokens are valid for a year and cannot be refreshed. */
const TOKEN_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
/** Manual syncs are cheap for us but spend a shared AniList rate budget. */
const MANUAL_SYNC_COOLDOWN_MS = 60 * 1000;

// ─── URL helpers ─────────────────────────────────────────────────────────────
// AniList requires the redirect_uri to match the one registered for the client,
// so these mirror the Patreon controller's resolution rules exactly.

function normalizeBaseUrl(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

function getFirstHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(',')[0]?.trim();
}

function getRequestOrigin(req?: Request): string {
  if (!req) return '';
  const forwardedProto = getFirstHeaderValue(req.headers['x-forwarded-proto']);
  const forwardedHost = getFirstHeaderValue(req.headers['x-forwarded-host']);
  const host = forwardedHost || req.get('host') || '';
  if (!host) return '';
  const protocol = forwardedProto || req.protocol || 'https';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function getUrls(req?: Request) {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestOrigin = normalizeBaseUrl(getRequestOrigin(req));

  if (isProduction) {
    const canonicalUrl = normalizeBaseUrl(process.env.PROD_DOMAIN);
    return { backendUrl: canonicalUrl, frontendUrl: canonicalUrl };
  }

  const backendUrl =
    normalizeBaseUrl(
      process.env.BACKEND_PUBLIC_URL || process.env.BACKEND_URL
    ) || requestOrigin;
  const frontendUrl =
    normalizeBaseUrl(process.env.FRONTEND_URL) || requestOrigin || backendUrl;

  return {
    backendUrl: backendUrl.replace(/\/+$/, ''),
    frontendUrl: frontendUrl.replace(/\/+$/, ''),
  };
}

// ─── OAuth state ─────────────────────────────────────────────────────────────

const oauthStateStore = new Map<
  string,
  { userId: string; createdAt: number }
>();

function cleanupOAuthStates() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.createdAt < tenMinutesAgo) oauthStateStore.delete(state);
  }
}

// ─── Status ──────────────────────────────────────────────────────────────────

function serializeStatus(user: IUser) {
  const anilist = user.anilist;
  if (!anilist?.anilistId) {
    return { linked: false as const };
  }

  return {
    linked: true as const,
    anilistId: anilist.anilistId,
    anilistUsername: anilist.anilistUsername,
    anilistAvatar: anilist.anilistAvatar,
    autoSync: anilist.autoSync ?? true,
    linkedAt: anilist.linkedAt,
    lastSyncedAt: anilist.lastSyncedAt,
    lastSyncStatus: anilist.lastSyncStatus,
    lastSyncError: anilist.lastSyncError,
    syncedLogCount: anilist.syncedLogCount ?? 0,
    tokenExpiry: anilist.tokenExpiry,
    tokenExpired: anilist.tokenExpiry
      ? new Date(anilist.tokenExpiry) <= new Date()
      : false,
  };
}

export async function getAnilistStatus(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(res.locals.user._id);
    if (!user) throw apiError('user.notFound', 404, 'User not found');
    return res.status(200).json(serializeStatus(user));
  } catch (error) {
    return next(error as customError);
  }
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export async function initiateAnilistOAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const clientId = process.env.ANILIST_CLIENT_ID;
    if (!clientId) {
      throw apiError(
        'anilist.notConfigured',
        500,
        'AniList OAuth is not configured on this server'
      );
    }

    const { backendUrl } = getUrls(req);
    if (!backendUrl) {
      throw apiError(
        'anilist.notConfigured',
        500,
        'AniList OAuth base URL is not configured'
      );
    }

    const state = crypto.randomBytes(32).toString('hex');
    oauthStateStore.set(state, {
      userId: res.locals.user._id.toString(),
      createdAt: Date.now(),
    });
    cleanupOAuthStates();

    const authUrl = new URL(ANILIST_AUTHORIZE_URL);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append(
      'redirect_uri',
      `${backendUrl}/api/anilist/oauth/callback`
    );
    authUrl.searchParams.append('response_type', 'code');
    // AniList has no scopes, but it does echo `state` back to the callback.
    authUrl.searchParams.append('state', state);

    return res.status(200).json({ authUrl: authUrl.toString() });
  } catch (error) {
    return next(error as customError);
  }
}

export async function handleAnilistOAuthCallback(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const { frontendUrl, backendUrl } = getUrls(req);
  const fail = (message: string) =>
    res.redirect(`${frontendUrl}/settings?anilist=error&message=${message}`);

  try {
    const { code, state } = req.query;
    if (!code || !state) return fail('missing_params');

    const stateData = oauthStateStore.get(state as string);
    if (!stateData) return fail('invalid_state');
    oauthStateStore.delete(state as string);

    const clientId = process.env.ANILIST_CLIENT_ID;
    const clientSecret = process.env.ANILIST_CLIENT_SECRET;
    if (!clientId || !clientSecret) return fail('oauth_not_configured');

    const tokenResponse = await axios.post(
      ANILIST_TOKEN_URL,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${backendUrl}/api/anilist/oauth/callback`,
        code,
      },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
    );

    const accessToken: string | undefined = tokenResponse.data?.access_token;
    if (!accessToken) return fail('oauth_failed');

    const viewer = await fetchAnilistViewer(accessToken);
    if (!viewer) return fail('oauth_failed');

    const takenBy = await User.findOne({
      'anilist.anilistId': viewer.id,
      _id: { $ne: stateData.userId },
    }).select('_id');
    if (takenBy) return fail('account_already_linked');

    const user = await User.findById(stateData.userId);
    if (!user) return fail('user_not_found');

    const expiresIn: number | undefined = tokenResponse.data?.expires_in;
    const now = new Date();
    // Relinking the same account keeps its watermark so nothing is replayed;
    // linking a different one starts clean from this moment.
    const previous = user.anilist;
    const isSameAccount = previous?.anilistId === viewer.id;

    user.anilist = {
      anilistId: viewer.id,
      anilistUsername: viewer.name,
      anilistAvatar: viewer.avatar,
      accessToken,
      tokenExpiry: new Date(
        now.getTime() + (expiresIn ? expiresIn * 1000 : TOKEN_LIFETIME_MS)
      ),
      linkedAt: isSameAccount ? (previous?.linkedAt ?? now) : now,
      autoSync: previous?.autoSync ?? true,
      lastActivityId: isSameAccount ? (previous?.lastActivityId ?? 0) : 0,
      syncFrom: isSameAccount ? (previous?.syncFrom ?? null) : now,
      syncedLogCount: isSameAccount ? (previous?.syncedLogCount ?? 0) : 0,
      lastSyncedAt: isSameAccount ? previous?.lastSyncedAt : undefined,
      lastSyncStatus: null,
      lastSyncError: null,
    };

    await user.save();

    return res.redirect(`${frontendUrl}/settings?anilist=success`);
  } catch (error) {
    console.error('AniList OAuth callback failed:', error);
    return fail('oauth_failed');
  }
}

export async function unlinkAnilistAccount(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(res.locals.user._id);
    if (!user) throw apiError('user.notFound', 404, 'User not found');

    // $unset rather than clearing fields: the unique index on
    // `anilist.anilistId` treats a lingering null as a value, so a second
    // unlinked user would collide with the first.
    await User.updateOne({ _id: user._id }, { $unset: { anilist: '' } });

    // Logs already created stay: they are real immersion the user earned XP
    // for. Only the link and its watermark go away.
    return res.status(200).json({ message: 'AniList account unlinked' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateAnilistSettings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(res.locals.user._id);
    if (!user?.anilist?.anilistId) {
      throw apiError('anilist.notLinked', 400, 'No AniList account is linked');
    }

    if (typeof req.body?.autoSync === 'boolean') {
      user.anilist.autoSync = req.body.autoSync;
    }

    await user.save();
    return res.status(200).json(serializeStatus(user));
  } catch (error) {
    return next(error as customError);
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

async function runSync(
  res: Response,
  next: NextFunction,
  options: { backfill: boolean }
) {
  try {
    const user = await User.findById(res.locals.user._id);
    if (!user?.anilist?.anilistId) {
      throw apiError('anilist.notLinked', 400, 'No AniList account is linked');
    }

    const lastSyncedAt = user.anilist.lastSyncedAt;
    if (
      !options.backfill &&
      lastSyncedAt &&
      Date.now() - new Date(lastSyncedAt).getTime() < MANUAL_SYNC_COOLDOWN_MS
    ) {
      throw apiError(
        'anilist.syncCooldown',
        429,
        'Please wait a moment before syncing again'
      );
    }

    if (options.backfill) {
      // A backfill is explicitly asking for history, so the link-date floor
      // that normally protects new links no longer applies.
      user.anilist.syncFrom = null;
      await user.save();
    }

    const result = await syncAnilistForUser(user._id, {
      backfill: options.backfill,
    });

    const updated = await User.findById(user._id);

    return res.status(200).json({
      ...result,
      status: updated ? serializeStatus(updated) : undefined,
    });
  } catch (error) {
    if ((error as customError).statusCode) {
      return next(error as customError);
    }
    console.error('AniList sync failed:', error);
    return next(
      apiError(
        'anilist.syncFailed',
        502,
        error instanceof Error ? error.message : 'AniList sync failed'
      )
    );
  }
}

export async function syncAnilistNow(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  return runSync(res, next, { backfill: false });
}

export async function backfillAnilist(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  return runSync(res, next, { backfill: true });
}

/** Logs this integration created, newest first — shown in settings. */
export async function getAnilistSyncedLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const logs = await Log.find({
      user: res.locals.user._id,
      anilistActivityId: { $ne: null },
    })
      .sort({ date: -1 })
      .limit(limit)
      .populate('media')
      .lean();

    return res.status(200).json(logs);
  } catch (error) {
    return next(error as customError);
  }
}
