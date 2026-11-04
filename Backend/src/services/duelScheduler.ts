/**
 * Finishes duels whose deadline passed and expires unanswered challenges.
 * Duels that someone wins early finish when the winner logs, not here.
 * A run that overruns the interval is skipped rather than overlapped.
 */

import { CronJob } from 'cron';
import { finalizeExpiredDuels } from './duels.service.js';

/** Cron expression: every 15 minutes. */
const DUEL_SCHEDULE = '*/15 * * * *';

let isRunning = false;

export function initDuelScheduler(): void {
  new CronJob(
    DUEL_SCHEDULE,
    () => {
      if (isRunning) {
        console.warn('Duel finalization still running, skipping this tick');
        return;
      }
      isRunning = true;
      finalizeExpiredDuels()
        .then(({ expired, finished }) => {
          if (expired > 0 || finished > 0) {
            console.log(`⚔️ Duels: ${finished} finished, ${expired} expired`);
          }
        })
        .catch((error) => console.error('Duel finalization error:', error))
        .finally(() => {
          isRunning = false;
        });
    },
    null,
    true,
    'UTC'
  );

  console.log('⚔️ Duel finalization scheduled (every 15 minutes)');
}
