/**
 * Shared achievement backfill.
 *
 * Used by both `npm run backfill:achievements` and the admin
 * "Backfill All Achievements" button so the two can never drift apart.
 */

import { Types } from 'mongoose';
import User from '../../models/user.model.js';
import UserAchievement from '../../models/userAchievement.model.js';
import { IAchievementCheckContext } from '../../types.js';
import {
  checkAchievements,
  revokeUnearnedAchievements,
} from './achievementEngine.js';

const TRIGGERS: IAchievementCheckContext['trigger'][] = [
  'log',
  'streak',
  'levelup',
];

export interface BackfillResult {
  usersProcessed: number;
  usersWithNewAchievements: number;
  totalGranted: number;
  totalRevoked: number;
}

export interface BackfillOptions {
  /** Take back achievements the user no longer qualifies for. Default true. */
  revoke?: boolean;
  /** Called after each user, for CLI progress output. */
  onUser?: (info: {
    username: string;
    granted: number;
    revoked: number;
    index: number;
    total: number;
  }) => void;
}

export async function backfillAchievementsForAllUsers(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const { revoke = true, onUser } = options;

  const users = await User.find({}).select('_id username').lean();

  const result: BackfillResult = {
    usersProcessed: 0,
    usersWithNewAchievements: 0,
    totalGranted: 0,
    totalRevoked: 0,
  };

  for (const user of users) {
    const userId = user._id as Types.ObjectId;

    try {
      // Revoke first: a stale unlock shouldn't survive just because the
      // grant pass ran before it.
      const revoked = revoke ? await revokeUnearnedAchievements(userId) : [];

      let granted = 0;
      for (const trigger of TRIGGERS) {
        const newlyGranted = await checkAchievements(userId, { trigger });
        granted += newlyGranted.length;
      }

      result.totalGranted += granted;
      result.totalRevoked += revoked.length;
      if (granted > 0) result.usersWithNewAchievements++;

      onUser?.({
        username: user.username,
        granted,
        revoked: revoked.length,
        index: result.usersProcessed + 1,
        total: users.length,
      });
    } catch (err) {
      console.error(`Backfill failed for ${user.username}:`, err);
    }

    result.usersProcessed++;
  }

  // Historical unlocks shouldn't pop the reveal modal on next login
  await UserAchievement.updateMany(
    { notified: false },
    { $set: { notified: true } }
  );

  return result;
}
