/* eslint-disable no-await-in-loop, no-continue */
import { Types } from 'mongoose';
import Activity from '../models/activity.model.js';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import User from '../models/user.model.js';
import { ILog, IUser } from '../types.js';
import { buildLogActivityInput } from './activityEvents.service.js';

const BATCH_SIZE = 500;

export interface ActivityBackfillState {
  running: boolean;
  total: number;
  processed: number;
  created: number;
  existing: number;
  skipped: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

let backfillState: ActivityBackfillState = {
  running: false,
  total: 0,
  processed: 0,
  created: 0,
  existing: 0,
  skipped: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

type BackfillLog = Pick<
  ILog,
  | '_id'
  | 'user'
  | 'type'
  | 'mediaId'
  | 'mediaTitle'
  | 'xp'
  | 'private'
  | 'time'
  | 'chars'
  | 'pages'
  | 'episodes'
  | 'unknownDate'
  | 'date'
>;

interface BackfillMedia {
  contentId: string;
  title?: {
    contentTitleEnglish?: string;
    contentTitleRomaji?: string;
    contentTitleNative?: string;
  };
}

function mediaDisplayTitle(media?: BackfillMedia): string | undefined {
  return (
    media?.title?.contentTitleEnglish ||
    media?.title?.contentTitleRomaji ||
    media?.title?.contentTitleNative
  );
}

async function runActivityBackfill(): Promise<void> {
  try {
    const eligibleFilter = { unknownDate: { $ne: true } };
    backfillState.total = await Log.countDocuments(eligibleFilter);

    let afterId: Types.ObjectId | undefined;
    let hasMore = true;
    while (hasMore) {
      const filter = afterId
        ? { ...eligibleFilter, _id: { $gt: afterId } }
        : eligibleFilter;
      const logs = (await Log.find(filter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select(
          '_id user type mediaId mediaTitle xp private time chars pages episodes description unknownDate date'
        )
        .lean()) as unknown as BackfillLog[];

      if (logs.length === 0) {
        hasMore = false;
        continue;
      }
      afterId = logs[logs.length - 1]._id as Types.ObjectId;

      const userIds = [...new Set(logs.map((log) => log.user.toString()))].map(
        (id) => new Types.ObjectId(id)
      );
      const mediaIds = [
        ...new Set(
          logs
            .map((log) => log.mediaId)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      const [users, media] = await Promise.all([
        User.find({ _id: { $in: userIds } })
          .select('_id settings.socialPrivacy settings.blurAdultContent')
          .lean(),
        mediaIds.length > 0
          ? MediaBase.find({ contentId: { $in: mediaIds } })
              .select('contentId title')
              .lean()
          : Promise.resolve([]),
      ]);

      const usersById = new Map(
        users.map((user) => [user._id.toString(), user])
      );
      const mediaById = new Map(
        (media as unknown as BackfillMedia[]).map((item) => [
          item.contentId,
          item,
        ])
      );
      const now = new Date();
      const operations = [];

      for (const log of logs) {
        const user = usersById.get(log.user.toString());
        if (!user) {
          backfillState.skipped += 1;
          continue;
        }

        const title =
          mediaDisplayTitle(
            log.mediaId ? mediaById.get(log.mediaId) : undefined
          ) || log.mediaTitle;
        const input = buildLogActivityInput(
          log as ILog,
          user as Pick<IUser, 'settings'>,
          title
        );
        if (!input) {
          backfillState.skipped += 1;
          continue;
        }

        const activityWithoutMetadata = { ...input };
        delete activityWithoutMetadata.metadata;

        operations.push({
          updateOne: {
            filter: { dedupeKey: input.dedupeKey },
            update: {
              $set: { metadata: input.metadata },
              $setOnInsert: {
                ...activityWithoutMetadata,
                visibility: input.visibility ?? 'public',
                importance: input.importance ?? 'normal',
                occurredAt: input.occurredAt ?? now,
                reactionCounts: {},
                commentCount: 0,
                createdAt: now,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        });
      }

      if (operations.length > 0) {
        const result = await Activity.bulkWrite(operations, {
          ordered: false,
          timestamps: false,
        });
        backfillState.created += result.upsertedCount;
        backfillState.existing += result.matchedCount;
      }
      backfillState.processed += logs.length;
    }
  } catch (error) {
    backfillState.error = (error as Error)?.message ?? String(error);
    // eslint-disable-next-line no-console
    console.error('Activity feed backfill failed:', error);
  } finally {
    backfillState.running = false;
    backfillState.finishedAt = new Date().toISOString();
  }
}

export function getActivityBackfillState(): ActivityBackfillState {
  return { ...backfillState };
}

export function startActivityBackfill(): {
  started: boolean;
  state: ActivityBackfillState;
} {
  if (backfillState.running) {
    return { started: false, state: getActivityBackfillState() };
  }

  backfillState = {
    running: true,
    total: 0,
    processed: 0,
    created: 0,
    existing: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };
  // eslint-disable-next-line no-void
  void runActivityBackfill();
  return { started: true, state: getActivityBackfillState() };
}
