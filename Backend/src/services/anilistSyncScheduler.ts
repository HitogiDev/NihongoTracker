/**
 * Polls every linked AniList account on a schedule so episodes watched on
 * AniList show up here without the user doing anything.
 *
 * Accounts are walked one at a time with a pause between them: AniList's rate
 * limit is per application, not per user, so a burst across many accounts would
 * throttle everyone. A run that overruns the interval is skipped rather than
 * overlapped.
 */

import { CronJob } from 'cron';
import {
  getAutoSyncUserIds,
  syncAnilistForUser,
} from './anilistSync.service.js';

/** Cron expression: every 30 minutes. */
const SYNC_SCHEDULE = '*/30 * * * *';
/** Gap between accounts, keeping the shared AniList rate budget healthy. */
const USER_DELAY_MS = 1500;

let isRunning = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAnilistSyncCycle(): Promise<{
  users: number;
  logs: number;
  failed: number;
}> {
  const summary = { users: 0, logs: 0, failed: 0 };
  const userIds = await getAutoSyncUserIds();

  for (const userId of userIds) {
    summary.users += 1;
    try {
      const result = await syncAnilistForUser(userId);
      summary.logs += result.created;
    } catch (error) {
      summary.failed += 1;
      // The per-user failure is already recorded on the user document; keep the
      // cycle going so one broken token can't stall everyone else.
      console.error(`AniList sync failed for user ${userId.toString()}:`, error);
    }
    await sleep(USER_DELAY_MS);
  }

  return summary;
}

export function initAnilistSyncScheduler(): void {
  new CronJob(
    SYNC_SCHEDULE,
    () => {
      if (isRunning) {
        console.warn('AniList sync still running, skipping this tick');
        return;
      }
      isRunning = true;
      runAnilistSyncCycle()
        .then(({ users, logs, failed }) => {
          if (users > 0) {
            console.log(
              `📺 AniList sync: ${users} account(s), ${logs} log(s), ${failed} failed`
            );
          }
        })
        .catch((error) => console.error('AniList sync cycle error:', error))
        .finally(() => {
          isRunning = false;
        });
    },
    null,
    true,
    'UTC'
  );

  console.log('📺 AniList sync scheduled (every 30 minutes)');
}
