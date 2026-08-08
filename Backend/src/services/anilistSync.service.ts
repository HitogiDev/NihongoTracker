/**
 * AniList automatic logging.
 *
 * A linked account is polled for its list activity feed; every "watched
 * episode" entry becomes an anime log, dated at the moment the user updated
 * their AniList list. Logs carry `anilistActivityId`, which is what makes the
 * whole thing idempotent: re-running a sync, or overlapping a backfill with an
 * incremental run, can never double-count an episode.
 *
 * Only anime is synced. AniList manga progress is measured in chapters, which
 * has no honest mapping onto the pages/chars/time a manga log needs, so those
 * activities are counted as skipped rather than guessed at.
 */

import { gql, GraphQLClient } from 'graphql-request';
import { Types } from 'mongoose';
import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import { Anime, MediaBase } from '../models/media.model.js';
import { searchAnilist } from './searchAnilist.js';
import { parseEpisodeProgress } from './anilistActivity.js';
import { addMediaToIndex } from './meilisearch/mediaIndex.js';
import { recalculateStreaksForUser } from './streaks.js';
import { recalculateUserXpFromLogs } from './updateStats.js';
import { checkAchievements } from './achievements/achievementEngine.js';
import {
  computeXp,
  continuousLevel,
  getUserConsumedDifficulty,
  normalizeJitenDifficulty,
} from './xp.js';
import { ILog, IMediaDocument, IUser } from '../types.js';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const anilist = new GraphQLClient(ANILIST_GRAPHQL_URL);

/** AniList allows ~90 requests/minute; pace pages well under that. */
const PAGE_DELAY_MS = 700;
const PER_PAGE = 50;
/** Safety valve so one account can't spend the whole rate budget. */
const MAX_PAGES_INCREMENTAL = 10;
const MAX_PAGES_BACKFILL = 60;

const VIEWER_QUERY = gql`
  query {
    Viewer {
      id
      name
      avatar {
        large
      }
    }
  }
`;

const ACTIVITY_QUERY = gql`
  query ($userId: Int, $page: Int, $perPage: Int, $createdAtGreater: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      activities(
        userId: $userId
        type: ANIME_LIST
        createdAt_greater: $createdAtGreater
        sort: ID_DESC
      ) {
        ... on ListActivity {
          id
          status
          progress
          createdAt
          media {
            id
            type
          }
        }
      }
    }
  }
`;

interface IAnilistViewerResponse {
  Viewer: {
    id: number;
    name: string;
    avatar?: { large?: string | null } | null;
  } | null;
}

interface IAnilistListActivity {
  id: number;
  status?: string | null;
  progress?: string | null;
  createdAt: number;
  media?: { id: number; type: 'ANIME' | 'MANGA' } | null;
}

interface IAnilistActivityResponse {
  Page: {
    pageInfo: { hasNextPage: boolean };
    activities: (IAnilistListActivity | Record<string, never>)[];
  };
}

export interface IAnilistSyncResult {
  /** Activities inspected in this run. */
  scanned: number;
  /** Logs written. */
  created: number;
  /** Activities that carried no episode progress (status changes, manga…). */
  skipped: number;
  /** Media documents created on the fly for newly seen shows. */
  mediaCreated: number;
  /** Highest activity id seen, i.e. the new incremental watermark. */
  lastActivityId: number;
}

export interface IAnilistViewer {
  id: number;
  name: string;
  avatar?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Identify the account behind an access token (used right after OAuth). */
export async function fetchAnilistViewer(
  accessToken: string
): Promise<IAnilistViewer | null> {
  const client = new GraphQLClient(ANILIST_GRAPHQL_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await client.request<IAnilistViewerResponse>(VIEWER_QUERY);
  if (!data.Viewer) return null;
  return {
    id: data.Viewer.id,
    name: data.Viewer.name,
    avatar: data.Viewer.avatar?.large ?? undefined,
  };
}

function isListActivity(
  activity: IAnilistListActivity | Record<string, never>
): activity is IAnilistListActivity {
  return typeof (activity as IAnilistListActivity).id === 'number';
}

async function fetchActivityPage(
  userId: number,
  page: number,
  createdAtGreater?: number,
  accessToken?: string
): Promise<{ activities: IAnilistListActivity[]; hasNextPage: boolean }> {
  const client = accessToken
    ? new GraphQLClient(ANILIST_GRAPHQL_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    : anilist;

  const data = await client.request<IAnilistActivityResponse>(ACTIVITY_QUERY, {
    userId,
    page,
    perPage: PER_PAGE,
    ...(createdAtGreater ? { createdAtGreater } : {}),
  });

  return {
    activities: (data.Page?.activities ?? []).filter(isListActivity),
    hasNextPage: Boolean(data.Page?.pageInfo?.hasNextPage),
  };
}

/**
 * Local anime documents for the given AniList ids, creating any that are
 * missing from the same AniList data the rest of the app already uses.
 */
async function resolveAnimeMedia(
  anilistIds: number[]
): Promise<{ media: Map<string, IMediaDocument>; created: number }> {
  const media = new Map<string, IMediaDocument>();
  if (anilistIds.length === 0) return { media, created: 0 };

  const contentIds = anilistIds.map((id) => id.toString());
  const existing = await MediaBase.find({
    contentId: { $in: contentIds },
    type: 'anime',
  }).lean();

  for (const doc of existing) {
    media.set(doc.contentId, doc as unknown as IMediaDocument);
  }

  const missing = anilistIds.filter((id) => !media.has(id.toString()));
  if (missing.length === 0) return { media, created: 0 };

  let created = 0;
  try {
    const fetched = await searchAnilist({ ids: missing, type: 'ANIME' });
    for (const doc of fetched) {
      // Guard against AniList returning something the mapper typed as manga.
      if (doc.type !== 'anime') continue;
      const saved = await Anime.findOneAndUpdate(
        { contentId: doc.contentId, type: 'anime' },
        { $setOnInsert: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      if (saved) {
        const savedDoc = saved as unknown as IMediaDocument & { _id: unknown };
        media.set(savedDoc.contentId, savedDoc);
        created += 1;
        // Search indexing is best-effort: the document is already in Mongo, so
        // an unreachable Meilisearch must not abort the remaining lookups.
        await addMediaToIndex(savedDoc).catch((error) =>
          console.error('AniList sync: media index failed', error)
        );
      }
    }
  } catch (error) {
    // A media lookup failure must not lose the activity — the log is still
    // written with the AniList id and can be matched later.
    console.error('AniList sync: media lookup failed', error);
  }

  return { media, created };
}

function mediaTitle(media?: IMediaDocument): string {
  return (
    media?.title?.contentTitleRomaji ||
    media?.title?.contentTitleNative ||
    media?.title?.contentTitleEnglish ||
    'AniList entry'
  );
}

/**
 * Pull new list activity for a linked account and turn it into logs.
 *
 * `backfill` ignores both the stored watermark and the link date and walks the
 * whole feed; the activity id dedupe means it is safe to run at any time.
 */
export async function syncAnilistForUser(
  userId: Types.ObjectId | string,
  options: { backfill?: boolean } = {}
): Promise<IAnilistSyncResult> {
  const user = (await User.findById(userId).select(
    '+anilist.accessToken'
  )) as IUser | null;

  if (!user?.anilist?.anilistId) {
    throw new Error('AniList account is not linked');
  }

  const result: IAnilistSyncResult = {
    scanned: 0,
    created: 0,
    skipped: 0,
    mediaCreated: 0,
    lastActivityId: user.anilist.lastActivityId ?? 0,
  };

  try {
    const backfill = Boolean(options.backfill);
    const watermark = backfill ? 0 : (user.anilist.lastActivityId ?? 0);
    // On the very first incremental run there is no watermark yet, so the link
    // date is what keeps years of history from being logged retroactively.
    const createdAtGreater =
      !backfill && !watermark && user.anilist.syncFrom
        ? Math.floor(new Date(user.anilist.syncFrom).getTime() / 1000)
        : undefined;
    // Hitting the page cap moves the watermark to the newest activity seen, so
    // an account that piled up more than the cap between runs skips the excess
    // rather than re-scanning it every 30 minutes. "Import full history"
    // recovers anything skipped that way — it ignores the watermark entirely.
    const maxPages = backfill ? MAX_PAGES_BACKFILL : MAX_PAGES_INCREMENTAL;

    const collected: IAnilistListActivity[] = [];
    let page = 1;
    let hasNextPage = true;
    let highestId = watermark;

    while (hasNextPage && page <= maxPages) {
      const pageResult = await fetchActivityPage(
        user.anilist.anilistId,
        page,
        createdAtGreater,
        user.anilist.accessToken
      );

      let reachedWatermark = false;
      for (const activity of pageResult.activities) {
        if (activity.id > highestId) highestId = activity.id;
        // Feed is sorted by id descending, so the first already-known activity
        // means everything after it has been processed too.
        if (watermark && activity.id <= watermark) {
          reachedWatermark = true;
          break;
        }
        collected.push(activity);
      }

      if (reachedWatermark) break;
      hasNextPage = pageResult.hasNextPage;
      page += 1;
      if (hasNextPage && page <= maxPages) await sleep(PAGE_DELAY_MS);
    }

    result.scanned = collected.length;

    const episodeActivities = collected
      .filter((activity) => activity.media?.type === 'ANIME')
      .map((activity) => ({
        activity,
        episodes: parseEpisodeProgress(activity.status, activity.progress),
      }))
      .filter((entry) => entry.episodes > 0);

    result.skipped = collected.length - episodeActivities.length;

    if (episodeActivities.length === 0) {
      await markSyncSuccess(user, highestId, 0);
      result.lastActivityId = highestId;
      return result;
    }

    // Drop anything already logged: a previous partial run, or a backfill
    // covering ground an incremental sync already walked.
    const existingLogs = await Log.find({
      user: user._id,
      anilistActivityId: {
        $in: episodeActivities.map((entry) => entry.activity.id),
      },
    })
      .select('anilistActivityId')
      .lean();
    const alreadyLogged = new Set(
      existingLogs.map((log) => log.anilistActivityId)
    );
    const pending = episodeActivities.filter(
      (entry) => !alreadyLogged.has(entry.activity.id)
    );

    if (pending.length === 0) {
      await markSyncSuccess(user, highestId, 0);
      result.lastActivityId = highestId;
      return result;
    }

    const { media, created: mediaCreated } = await resolveAnimeMedia(
      Array.from(new Set(pending.map((entry) => entry.activity.media!.id)))
    );
    result.mediaCreated = mediaCreated;

    // XP context is snapshotted once for the batch, exactly like the importer:
    // per-log recomputation would let a long backfill drift as the level rises.
    const categoryLevel = continuousLevel(user.stats?.listeningXp ?? 0);
    const consumedDifficulty = await getUserConsumedDifficulty(
      user._id,
      'listening'
    ).catch(() => null);

    const logs: Partial<ILog>[] = pending.map(({ activity, episodes }) => {
      const contentId = activity.media!.id.toString();
      const mediaDoc = media.get(contentId);
      const episodeDuration = mediaDoc?.episodeDuration;
      const time =
        episodeDuration && episodeDuration > 0
          ? episodes * episodeDuration
          : undefined;

      const { xp, breakdown } = computeXp(
        { type: 'anime', episodes, time },
        {
          difficulty: normalizeJitenDifficulty(mediaDoc?.jitenDifficulty),
          categoryLevel,
          consumedDifficulty,
        }
      );

      return {
        user: user._id,
        type: 'anime',
        mediaId: contentId,
        anilistActivityId: activity.id,
        episodes,
        time,
        xp,
        xpBreakdown: breakdown,
        description: mediaTitle(mediaDoc),
        isAdult: mediaDoc?.isAdult ?? false,
        private: false,
        date: new Date(activity.createdAt * 1000),
      };
    });

    const pendingIds = pending.map((entry) => entry.activity.id);
    try {
      const insertedDocs = await Log.insertMany(logs, { ordered: false });
      result.created = insertedDocs.length;
    } catch (error) {
      // `ordered: false` keeps inserting past a duplicate, and a concurrent run
      // hitting the same activity is expected rather than exceptional. Count
      // what actually landed instead of trusting the driver's error shape; a
      // batch where nothing landed is a real failure and still propagates.
      result.created = await Log.countDocuments({
        user: user._id,
        anilistActivityId: { $in: pendingIds },
      });
      if (result.created === 0) throw error;
    }

    if (result.created > 0) {
      await recalculateUserXpFromLogs(user._id);
      await recalculateStreaksForUser(user._id);
      // Left unnotified on purpose: the user isn't watching a request here, so
      // the client reveals these on its next /achievements/me/pending drain.
      await checkAchievements(user._id, { trigger: 'log' });
      await checkAchievements(user._id, { trigger: 'streak' });
    }

    await markSyncSuccess(user, highestId, result.created);
    result.lastActivityId = highestId;
    return result;
  } catch (error) {
    await markSyncError(user, error);
    throw error;
  }
}

async function markSyncSuccess(
  user: IUser,
  lastActivityId: number,
  createdCount: number
): Promise<void> {
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'anilist.lastActivityId': lastActivityId,
        'anilist.lastSyncedAt': new Date(),
        'anilist.lastSyncStatus': 'ok',
        'anilist.lastSyncError': null,
      },
      ...(createdCount > 0
        ? { $inc: { 'anilist.syncedLogCount': createdCount } }
        : {}),
    }
  );
}

async function markSyncError(user: IUser, error: unknown): Promise<void> {
  const message =
    error instanceof Error ? error.message : 'Unknown AniList sync error';
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'anilist.lastSyncedAt': new Date(),
        'anilist.lastSyncStatus': 'error',
        'anilist.lastSyncError': message.slice(0, 300),
      },
    }
  ).catch(() => {
    // Status bookkeeping must never mask the original failure.
  });
}

/** Every linked account the scheduler is allowed to poll. */
export async function getAutoSyncUserIds(): Promise<Types.ObjectId[]> {
  const users = await User.find({
    'anilist.anilistId': { $ne: null },
    'anilist.autoSync': true,
  })
    .select('_id')
    .lean();
  return users.map((user) => user._id as Types.ObjectId);
}
