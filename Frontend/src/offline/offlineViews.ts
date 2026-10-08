import type {
  ICreateLog,
  ILog,
  ILoginResponse,
  ILogsParams,
  IUser,
  ISocialSummary,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';
import { getOfflineOperations, type OfflineOperation } from './offlineStore';

export function queuedLog(
  operation: OfflineOperation,
  user: ILoginResponse,
): ILog {
  const values = operation.payload.log as ICreateLog;
  return {
    ...values,
    _id: `offline-${operation.id}`,
    user: { _id: user._id, username: user.username, avatar: user.avatar },
    media:
      values.media ??
      (values.mediaData
        ? {
            ...values.mediaData,
            title: {
              contentTitleNative: values.mediaData.contentTitleNative ?? '',
              contentTitleEnglish: values.mediaData.contentTitleEnglish ?? '',
              contentTitleRomaji: values.mediaData.contentTitleRomaji,
            },
          }
        : undefined),
    xp: 0,
    offlineStatus: operation.status,
  };
}

export function matchesLog(log: ILog, params?: ILogsParams) {
  if ((params?.page ?? 1) !== 1) return false;
  if (
    params?.type &&
    !(Array.isArray(params.type) ? params.type : [params.type]).includes(
      log.type,
    )
  )
    return false;
  if (params?.mediaId && log.mediaId !== params.mediaId) return false;
  if (
    params?.search &&
    !log.description.toLowerCase().includes(params.search.toLowerCase())
  )
    return false;
  if (
    params?.mediaTitle &&
    !JSON.stringify(log.media?.title ?? {})
      .toLowerCase()
      .includes(params.mediaTitle.toLowerCase())
  )
    return false;
  const date = new Date(log.date).getTime();
  if (params?.start && date < new Date(params.start).getTime()) return false;
  if (params?.end && date >= new Date(params.end).getTime() + 86400000)
    return false;
  const tagIds = (log.tags ?? []).map((tag) =>
    typeof tag === 'string' ? tag : tag._id,
  );
  if (params?.tags) {
    const required = Array.isArray(params.tags)
      ? params.tags
      : params.tags.split(',');
    if (
      params.tagsMode === 'all'
        ? !required.every((id) => tagIds.includes(id))
        : !required.some((id) => tagIds.includes(id))
    )
      return false;
  }
  for (const key of ['volume', 'episodes', 'pages', 'chars', 'time'] as const) {
    const value = log[key] ?? 0;
    if (params?.[key] !== undefined && value !== params[key]) return false;
    const min = params?.[`${key}Min`];
    const max = params?.[`${key}Max`];
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
  }
  return true;
}

export function profileFields(
  user: ILoginResponse,
  fields: Record<string, string>,
): ILoginResponse {
  const next = {
    ...user,
    settings: {
      ...user.settings,
      blurAdultContent: user.settings?.blurAdultContent ?? false,
    },
  };
  if (fields.about !== undefined) next.about = fields.about;
  for (const key of [
    'blurAdultContent',
    'hideAdultFromSearch',
    'hideUnmatchedLogsAlert',
    'hideRankingFeatures',
  ] as const) {
    if (fields[key] !== undefined) next.settings[key] = fields[key] === 'true';
  }
  if (fields.timezone !== undefined) next.settings.timezone = fields.timezone;
  if (fields.weekStartsOn !== undefined)
    next.settings.weekStartsOn = fields.weekStartsOn === '1' ? 1 : 0;
  if (fields.language === 'es' || fields.language === 'en')
    next.settings.language = fields.language;
  return next;
}

export function followingSummary(
  social: ISocialSummary | undefined,
  following: boolean,
): ISocialSummary {
  const current = social ?? {
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    mutualFollow: false,
  };
  return {
    ...current,
    isFollowing: following,
    mutualFollow: following && current.isFollowedBy,
    followerCount: Math.max(
      0,
      current.followerCount + Number(following) - Number(current.isFollowing),
    ),
  };
}

export async function overlayUser<
  T extends ILoginResponse & { social?: ISocialSummary },
>(user: T): Promise<T> {
  const current = useUserDataStore.getState().user;
  if (!isNativeApp() || !current) return user;
  const operations = await getOfflineOperations(current._id);
  let next = { ...user };
  for (const operation of operations) {
    if (operation.status === 'failed') continue;
    if (
      String(operation.payload.username).toLowerCase() === user.username.toLowerCase() &&
      ['follow', 'unfollow'].includes(operation.type)
    ) {
      next.social = followingSummary(next.social, operation.type === 'follow');
    }
    if (user._id !== current._id) continue;
    if (operation.type === 'profile') {
      const updated = profileFields(
        next,
        operation.payload.fields as Record<string, string>,
      );
      next = { ...next, ...updated };
    }
    if (operation.type === 'settings') {
      const body = operation.payload.body as Record<string, unknown>;
      if (operation.payload.key === 'customization')
        next.customization = { ...next.customization, ...body };
      if (operation.payload.key === 'statsLayout')
        next.settings = {
          ...next.settings!,
          statsLayout: body.layout as IUser['statsLayout'],
        };
      if (operation.payload.key === 'profileLayout')
        next.settings = {
          ...next.settings!,
          profileLayout: body.layout as IUser['profileLayout'],
        };
      if (operation.payload.key === 'socialPrivacy')
        next.settings = {
          ...next.settings!,
          socialPrivacy: body.socialPrivacy as NonNullable<
            IUser['settings']
          >['socialPrivacy'],
        };
      if (operation.payload.key === 'customThemes')
        next.settings = {
          ...next.settings!,
          customThemes: body.themes as NonNullable<
            IUser['settings']
          >['customThemes'],
          profileThemeId: body.profileThemeId as string | null,
        };
    }
  }
  return next;
}
