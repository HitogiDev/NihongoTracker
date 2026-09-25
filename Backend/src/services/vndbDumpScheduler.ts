import {
  getVndbDumpSyncStatus,
  isVndbDumpSyncRunningInProcess,
  startVndbDumpSync,
} from './vndbDumpSync.js';

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
    process.env.VNDB_DUMP_SYNC_CHECK_INTERVAL_MINUTES || '60',
    10
  );
  if (!Number.isFinite(minutes) || minutes < 1) return 60 * 60 * 1000;
  return minutes * 60 * 1000;
}

function getDueMs(): number {
  const hours = Number.parseInt(
    process.env.VNDB_DUMP_SYNC_DUE_HOURS || '168', // 7 days default
    10
  );
  if (!Number.isFinite(hours) || hours < 1) return 168 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

async function checkAndRunScheduledSync(): Promise<void> {
  const status = await getVndbDumpSyncStatus();

  if (status.isRunning || isVndbDumpSyncRunningInProcess()) {
    return;
  }

  const dueMs = getDueMs();

  if (!status.lastSuccessfulAt) {
    const startResult = await startVndbDumpSync('scheduled');
    console.log(`🗂️  VNDB scheduler: ${startResult.message}`);
    return;
  }

  const lastSuccessAt = new Date(status.lastSuccessfulAt).getTime();
  if (Number.isNaN(lastSuccessAt)) {
    const startResult = await startVndbDumpSync('scheduled');
    console.log(`🗂️  VNDB scheduler: ${startResult.message}`);
    return;
  }

  if (Date.now() - lastSuccessAt >= dueMs) {
    const startResult = await startVndbDumpSync('scheduled');
    console.log(`🗂️  VNDB scheduler: ${startResult.message}`);
  }
}

export function initVndbDumpScheduler(): void {
  if (schedulerTimer) return;

  const isEnabled = parseBooleanEnv(
    process.env.VNDB_DUMP_SYNC_ENABLED,
    true
  );

  if (!isEnabled) {
    console.log('🗂️  VNDB scheduler disabled by VNDB_DUMP_SYNC_ENABLED');
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('🗂️  VNDB scheduler disabled outside production');
    return;
  }

  const intervalMs = getCheckIntervalMs();

  console.log(
    `🗂️  VNDB scheduler enabled (checks every ${Math.round(intervalMs / 60000)} minute(s), due every ${Math.round(getDueMs() / 3600000)} hour(s))`
  );

  void checkAndRunScheduledSync().catch((error) => {
    console.error('VNDB scheduler check failed:', error);
  });

  schedulerTimer = setInterval(() => {
    void checkAndRunScheduledSync().catch((error) => {
      console.error('VNDB scheduler check failed:', error);
    });
  }, intervalMs);
}
