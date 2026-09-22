/* eslint-disable max-classes-per-file, no-await-in-loop */
import { AnyBulkWriteOperation } from 'mongoose';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { MediaBase } from '../models/media.model.js';
import { updateLevelAndXp } from './updateStats.js';
import { calculateLevel } from './calculateLevel.js';
import { ILog } from '../types.js';
import {
  computeXp,
  continuousLevel,
  getLogCategory,
  medianOf,
  normalizeJitenDifficulty,
  roughLogMinutes,
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
  previousXp: number;
  recalculatedXp: number;
  xpDelta: number;
  usersWithStatsChanges: number;
  usersWithLevelChanges: number;
  difficultyTaggedLogs: number;
  fullBonusLogs: number;
  fullBonusPercent: number;
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
 * Rolling consumed-difficulty signal during replay: hours-weighted median of
 * the difficulty consumed within the window before each log's date.
 */
class RollingConsumedDifficulty {
  private samples: { at: number; hours: number; difficulty: number }[] = [];

  push(atMs: number, hours: number, difficulty: number) {
    this.samples.push({ at: atMs, hours, difficulty });
  }

  percentile(nowMs: number): number | null {
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
 * Recomputes every log's XP with the v3 formula via chronological replay.
 *
 * Order matters: each log's difficulty multiplier depends on the category
 * level accumulated up to that moment, and the personal reading speed evolves
 * with the user's history, so logs are replayed oldest-first per user. Set
 * dryRun to compute the summary without writing anything.
 */
export async function recalculateAllUsersXpV3(
  options: { dryRun?: boolean } = {}
): Promise<IXpMigrationSummary> {
  const dryRun = options.dryRun ?? false;
  const totalUsers = await User.countDocuments({});
  const users = User.find({}).sort({ _id: 1 }).cursor();

  const summary: IXpMigrationSummary = {
    totalUsers,
    processedUsers: 0,
    updatedLogs: 0,
    previousXp: 0,
    recalculatedXp: 0,
    xpDelta: 0,
    usersWithStatsChanges: 0,
    usersWithLevelChanges: 0,
    difficultyTaggedLogs: 0,
    fullBonusLogs: 0,
    fullBonusPercent: 0,
    dryRun,
    errors: [],
  };

  for await (const user of users) {
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
              ? consumed[category].percentile(logAtMs)
              : null,
          }
        );

        summary.previousXp += log.xp;
        summary.recalculatedXp += xp;
        if (difficulty !== null) {
          summary.difficultyTaggedLogs += 1;
          if (breakdown.multiplier === 1.3) summary.fullBonusLogs += 1;
        }

        if (log.xp !== xp || log.xpBreakdown?.version !== breakdown.version) {
          summary.updatedLogs += 1;
          if (!dryRun) {
            bulkOps.push({
              updateOne: {
                filter: { _id: log._id },
                update: { $set: { xp, xpBreakdown: breakdown } },
              },
            });
            if (bulkOps.length >= 500) {
              await Log.bulkWrite(bulkOps, { ordered: false });
              bulkOps.length = 0;
            }
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
          const historyHours = roughLogMinutes({
            type: log.type,
            time: log.time,
            chars: log.chars,
            pages: log.pages,
            episodes: log.episodes,
          }) / 60;
          if (historyHours > 0) {
            consumed[category].push(logAtMs, historyHours, difficulty);
          }
        }
      }

      if (user.stats) {
        const nextLevels = [
          calculateLevel(userXp),
          calculateLevel(readingXp),
          calculateLevel(listeningXp),
        ];
        if (
          user.stats.userXp !== userXp ||
          user.stats.readingXp !== readingXp ||
          user.stats.listeningXp !== listeningXp ||
          user.stats.userLevel !== nextLevels[0] ||
          user.stats.readingLevel !== nextLevels[1] ||
          user.stats.listeningLevel !== nextLevels[2]
        ) {
          summary.usersWithStatsChanges += 1;
        }
        if (
          user.stats.userLevel !== nextLevels[0] ||
          user.stats.readingLevel !== nextLevels[1] ||
          user.stats.listeningLevel !== nextLevels[2]
        ) {
          summary.usersWithLevelChanges += 1;
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

      summary.processedUsers += 1;
    } catch (error) {
      summary.errors.push(
        `Error processing user ${user.username}: ${(error as Error).message}`
      );
    }
  }

  summary.xpDelta = summary.recalculatedXp - summary.previousXp;
  summary.fullBonusPercent = summary.difficultyTaggedLogs
    ? Math.round((summary.fullBonusLogs / summary.difficultyTaggedLogs) * 10000) / 100
    : 0;

  return summary;
}
