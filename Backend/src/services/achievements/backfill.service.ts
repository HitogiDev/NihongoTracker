import { Types } from 'mongoose';
import Achievement from '../../models/achievement.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import User from '../../models/user.model.js';
import { IAchievement, IAchievementCheckContext } from '../../types.js';
import { checkAchievements, evaluateCondition } from './achievementEngine.js';

/**
 * Shared backfill used by both the admin endpoint and
 * `scripts/backfillAchievements.ts`.
 *
 * Granting is idempotent: `checkAchievements` upserts, so re-running only ever
 * adds what is genuinely missing.
 *
 * Revoking is **destructive** — it deletes `UserAchievement` rows whose
 * condition no longer evaluates to true (e.g. the user deleted the logs that
 * earned it). It is therefore opt-in at every call site.
 */

/** Triggers that between them cover every condition type the engine checks. */
const ALL_TRIGGERS: IAchievementCheckContext['trigger'][] = [
  'log',
  'streak',
  'levelup',
];

export interface BackfillProgress {
  username: string;
  granted: number;
  revoked: number;
  /** 1-based position in the run. */
  index: number;
  total: number;
}

export interface BackfillOptions {
  /** Delete achievements whose condition no longer holds. Off by default. */
  revoke?: boolean;
  /** Called once per user, after that user is processed. */
  onUser?: (progress: BackfillProgress) => void;
}

export interface BackfillResult {
  usersProcessed: number;
  totalGranted: number;
  totalRevoked: number;
  usersWithNewAchievements: number;
}

/**
 * Re-check the achievements a user already holds and drop the ones that no
 * longer qualify. Returns how many were removed.
 */
async function revokeStaleAchievements(
  userId: Types.ObjectId
): Promise<number> {
  const held = await UserAchievement.find({ user: userId })
    .select('achievement')
    .lean();

  if (held.length === 0) return 0;

  const achievements = await Achievement.find({
    _id: { $in: held.map((entry) => entry.achievement) },
    isActive: true,
  }).lean();

  let revoked = 0;

  for (const achievement of achievements) {
    try {
      const { met } = await evaluateCondition(
        userId,
        achievement as unknown as IAchievement
      );

      if (!met) {
        const deleted = await UserAchievement.findOneAndDelete({
          user: userId,
          achievement: achievement._id,
        });
        if (deleted) revoked += 1;
      }
    } catch (error) {
      // One unevaluable achievement must not abort the whole run, and must
      // never cause a revoke: on error we keep what the user already has.
      console.error(
        `Failed to re-evaluate achievement ${String(achievement._id)}:`,
        error
      );
    }
  }

  return revoked;
}

export async function backfillAchievementsForAllUsers(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const { revoke = false, onUser } = options;

  const users = await User.find({}).select('_id username').lean();

  let totalGranted = 0;
  let totalRevoked = 0;
  let usersProcessed = 0;
  let usersWithNewAchievements = 0;

  for (const user of users) {
    const userId = user._id as Types.ObjectId;
    let granted = 0;

    for (const trigger of ALL_TRIGGERS) {
      const newlyGranted = await checkAchievements(userId, { trigger });
      granted += newlyGranted.length;
    }

    const revoked = revoke ? await revokeStaleAchievements(userId) : 0;

    totalGranted += granted;
    totalRevoked += revoked;
    usersProcessed += 1;
    if (granted > 0) usersWithNewAchievements += 1;

    onUser?.({
      username: user.username ?? String(userId),
      granted,
      revoked,
      index: usersProcessed,
      total: users.length,
    });
  }

  return {
    usersProcessed,
    totalGranted,
    totalRevoked,
    usersWithNewAchievements,
  };
}
