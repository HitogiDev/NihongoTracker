import { AnyBulkWriteOperation } from 'mongoose';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';
import { updateLevelAndXp } from './updateStats.js';
import { ILog } from '../types.js';
import {
  computeXp,
  continuousLevel,
  getLogCategory,
  medianOf,
  normalizeJitenDifficulty,
  weightedPercentile,
  CONSUMED_DIFFICULTY_MIN_HOURS,
  CONSUMED_DIFFICULTY_PERCENTILE,
  CONSUMED_DIFFICULTY_WINDOW_DAYS,
  MIN_SPEED_SAMPLES,
  READING_TYPES,
} from './xp.js';

export interface IXpMigrationSummary {
  totalUsers: number;
  processedUsers: number;
  updatedLogs: number;
  dryRun: boolean;
  errors: string[];
}

const SPEED_WINDOW = 50;

/**
 * Rolling median over the last SPEED_WINDOW reading-speed samples, tracked
 * per log type with a category-wide fallback — mirrors
 * getUserReadingSpeedCph's behavior for the live path.
 */
class RollingSpeed {
  private byType = new Map<string, number[]>();
  private combined: number[] = [];

  push(type: ILog['type'], chars: number, timeMin: number) {
    const speed = (chars / timeMin) * 60;
    let typeSamples = this.byType.get(type);
    if (!typeSamples) {
      typeSamples = [];
      this.byType.set(type, typeSamples);
    }
    typeSamples.push(speed);
    if (typeSamples.length > SPEED_WINDOW) typeSamples.shift();
    this.combined.push(speed);
    if (this.combined.length > SPEED_WINDOW) this.combined.shift();
  }

  median(type: ILog['type']): number | null {
    const typeSamples = this.byType.get(type);
    if (typeSamples && typeSamples.length >= MIN_SPEED_SAMPLES) {
      return medianOf(typeSamples);
    }
    return medianOf(this.combined);
  }
}

const CONSUMED_WINDOW_MS =
  CONSUMED_DIFFICULTY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Rolling consumed-difficulty signal during replay: hours-weighted p75 of
 * the difficulty consumed within the window before each log's date.
 */
class RollingConsumedDifficulty {
  private samples: { at: number; hours: number; difficulty: number }[] = [];

  push(atMs: number, hours: number, difficulty: number) {
    this.samples.push({ at: atMs, hours, difficulty });
  }

  p75(nowMs: number): number | null {
    const cutoff = nowMs - CONSUMED_WINDOW_MS;
    this.samples = this.samples.filter((s) => s.at >= cutoff);
    const totalHours = this.samples.reduce((sum, s) => sum + s.hours, 0);
    if (totalHours < CONSUMED_DIFFICULTY_MIN_HOURS) return null;
    return weightedPercentile(
      this.samples.map((s) => ({ value: s.difficulty, weight: s.hours })),
      CONSUMED_DIFFICULTY_PERCENTILE
    );
  }
}

/**
 * Recomputes every log's XP with the v2 formula via chronological replay.
 *
 * Order matters: each log's difficulty multiplier depends on the category
 * level accumulated up to that moment, and the personal reading speed evolves
 * with the user's history, so logs are replayed oldest-first per user. Set
 * dryRun to compute the summary without writing anything.
 */
export async function recalculateAllUsersXpV2(
  options: { dryRun?: boolean } = {}
): Promise<IXpMigrationSummary> {
  const dryRun = options.dryRun ?? false;
  const users = await User.find({});

  const summary: IXpMigrationSummary = {
    totalUsers: users.length,
    processedUsers: 0,
    updatedLogs: 0,
    dryRun,
    errors: [],
  };

  for (const user of users) {
    try {
      const logs = await Log.find({ user: user._id }).sort({
        date: 1,
        _id: 1,
      });

      // One difficulty lookup per user for all their media.
      const mediaIds = Array.from(
        new Set(
          logs
            .map((log) => log.mediaId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const difficultyByContentId = new Map<string, number | null>();
      if (mediaIds.length) {
        const medias = await MediaBase.find({ contentId: { $in: mediaIds } })
          .select('contentId jitenDifficulty')
          .lean();
        for (const media of medias) {
          difficultyByContentId.set(
            media.contentId,
            normalizeJitenDifficulty(media.jitenDifficulty)
          );
        }
      }

      let readingXp = 0;
      let listeningXp = 0;
      let userXp = 0;
      const speed = new RollingSpeed();
      const consumed = {
        reading: new RollingConsumedDifficulty(),
        listening: new RollingConsumedDifficulty(),
      };
      const bulkOps: AnyBulkWriteOperation[] = [];

      for (const log of logs) {
        const category = getLogCategory(log.type);
        const categoryLevel = continuousLevel(
          category === 'reading' ? readingXp : listeningXp
        );
        const logAtMs = new Date(log.date).getTime();
        const difficulty = log.mediaId
          ? (difficultyByContentId.get(log.mediaId) ?? null)
          : null;

        const { xp, breakdown } = computeXp(
          {
            type: log.type,
            time: log.time,
            chars: log.chars,
            pages: log.pages,
            episodes: log.episodes,
          },
          {
            personalSpeedCph:
              category === 'reading' ? speed.median(log.type) : null,
            difficulty,
            categoryLevel: category ? categoryLevel : 0,
            consumedDifficulty: category
              ? consumed[category].p75(logAtMs)
              : null,
          }
        );

        if (log.xp !== xp || log.xpBreakdown?.version !== breakdown.version) {
          summary.updatedLogs++;
          if (!dryRun) {
            bulkOps.push({
              updateOne: {
                filter: { _id: log._id },
                update: { $set: { xp, xpBreakdown: breakdown } },
              },
            });
          }
        }

        if (category === 'reading') readingXp += xp;
        else if (category === 'listening') listeningXp += xp;
        userXp += xp;

        // Feed the rolling speed with the same signal the live engine uses.
        if (
          READING_TYPES.includes(log.type) &&
          typeof log.chars === 'number' &&
          log.chars > 0 &&
          typeof log.time === 'number' &&
          log.time > 0
        ) {
          speed.push(log.type, log.chars, log.time);
        }

        // Feed the consumed-difficulty window for the i+1 comfort signal.
        if (
          category &&
          difficulty !== null &&
          breakdown.timeCreditedMin > 0
        ) {
          consumed[category].push(
            logAtMs,
            breakdown.timeCreditedMin / 60,
            difficulty
          );
        }
      }

      if (!dryRun) {
        if (bulkOps.length) {
          await Log.bulkWrite(bulkOps, { ordered: false });
        }

        if (user.stats) {
          user.stats.readingXp = readingXp;
          user.stats.listeningXp = listeningXp;
          user.stats.userXp = userXp;
          updateLevelAndXp(user.stats, 'reading');
          updateLevelAndXp(user.stats, 'listening');
          updateLevelAndXp(user.stats, 'user');
          user.markModified('stats');
          await user.save();
        }
      }

      summary.processedUsers++;
    } catch (error) {
      summary.errors.push(
        `Error processing user ${user.username}: ${(error as Error).message}`
      );
    }
  }

  return summary;
}
