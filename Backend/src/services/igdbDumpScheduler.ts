import {
  getIgdbDumpSyncStatus,
  isIgdbDumpSyncRunningInProcess,
  startIgdbDumpSync,
} from './igdbDumpSync.js';

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function getCheckIntervalMs(): number {
  const minutes = Number.parseInt(
    process.env.IGDB_DUMP_SYNC_CHECK_INTERVAL_MINUTES || '30',
    10
  );

  if (!Number.isFinite(minutes) || minutes < 1) {
    return 30 * 60 * 1000;
  }

  return minutes * 60 * 1000;
}

function getDueMs(): number {
  const hours = Number.parseInt(
    process.env.IGDB_DUMP_SYNC_DUE_HOURS || '48',
    10
  );

  if (!Number.isFinite(hours) || hours < 1) {
    return 48 * 60 * 60 * 1000;
  }

  return hours * 60 * 60 * 1000;
}

async function checkAndRunScheduledSync(): Promise<void> {
  const status = await getIgdbDumpSyncStatus();

  if (status.isRunning || isIgdbDumpSyncRunningInProcess()) {
    return;
  }

  const dueMs = getDueMs();

  if (!status.lastSuccessfulAt) {
    const startResult = await startIgdbDumpSync('scheduled');
    console.log(`🗂️ IGDB scheduler: ${startResult.message}`);
    return;
  }

  const lastSuccessAt = new Date(status.lastSuccessfulAt).getTime();
  if (Number.isNaN(lastSuccessAt)) {
    const startResult = await startIgdbDumpSync('scheduled');
    console.log(`🗂️ IGDB scheduler: ${startResult.message}`);
    return;
  }

  if (Date.now() - lastSuccessAt >= dueMs) {
    const startResult = await startIgdbDumpSync('scheduled');
    console.log(`🗂️ IGDB scheduler: ${startResult.message}`);
  }
}

export function initIgdbDumpScheduler() {
  if (schedulerTimer) {
    return;
  }

  const isEnabled = parseBooleanEnv(process.env.IGDB_DUMP_SYNC_ENABLED, true);

  if (!isEnabled) {
    console.log('🗂️ IGDB scheduler disabled by IGDB_DUMP_SYNC_ENABLED');
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('🗂️ IGDB scheduler disabled outside production');
    return;
  }

  const intervalMs = getCheckIntervalMs();

  console.log(
    `🗂️ IGDB scheduler enabled (checks every ${Math.round(intervalMs / 60000)} minute(s), due every ${Math.round(
      getDueMs() / 3600000
    )} hour(s))`
  );

  void checkAndRunScheduledSync().catch((error) => {
    console.error('IGDB scheduler check failed:', error);
  });

  schedulerTimer = setInterval(() => {
    void checkAndRunScheduledSync().catch((error) => {
      console.error('IGDB scheduler check failed:', error);
    });
  }, intervalMs);
}
