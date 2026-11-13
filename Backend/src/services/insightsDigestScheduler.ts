import { CronJob } from 'cron';
import { runInsightsDigests } from './insightsDigest.service.js';

/** Cron expression: minute 7 of every hour, so each time zone reaches its local send hour. */
const DIGEST_SCHEDULE = '7 * * * *';

let isRunning = false;

export function initInsightsDigestScheduler(): void {
  new CronJob(
    DIGEST_SCHEDULE,
    () => {
      if (isRunning) {
        console.warn('Insights digests still running, skipping this tick');
        return;
      }
      isRunning = true;
      runInsightsDigests()
        .then((sent) => {
          if (sent > 0) console.log(`📈 Insights digests sent: ${sent}`);
        })
        .catch((error) => console.error('Insights digest error:', error))
        .finally(() => {
          isRunning = false;
        });
    },
    null,
    true,
    'UTC'
  );

  console.log('📈 Insights digests scheduled (hourly)');
}
