const CHUNK_RELOAD_ATTEMPT_KEY = 'nt:chunk-reload-attempt';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

const DYNAMIC_IMPORT_ERROR_PATTERN =
  /dynamically imported module|ChunkLoadError|Importing a module script failed|Failed to fetch dynamically imported module|MIME type|valid JavaScript MIME type/i;

type ChunkRecoveryWindow = Window & {
  __ntChunkRecoveryListenersRegistered?: boolean;
};

function canAttemptChunkRecovery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const previousAttempt = Number(
    sessionStorage.getItem(CHUNK_RELOAD_ATTEMPT_KEY) || '0'
  );
  const now = Date.now();

  if (
    Number.isFinite(previousAttempt) &&
    now - previousAttempt < CHUNK_RELOAD_COOLDOWN_MS
  ) {
    return false;
  }

  sessionStorage.setItem(CHUNK_RELOAD_ATTEMPT_KEY, String(now));
  return true;
}

export function recoverFromChunkLoadFailure(): boolean {
  if (!canAttemptChunkRecovery()) {
    return false;
  }

  const retryUrl = new URL(window.location.href);
  retryUrl.searchParams.set('chunkRetry', Date.now().toString());
  window.location.replace(retryUrl.toString());
  return true;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const routeError = error as { statusText?: unknown; data?: unknown };
    if (typeof routeError.statusText === 'string') {
      return routeError.statusText;
    }

    if (typeof routeError.data === 'string') {
      return routeError.data;
    }
  }

  return '';
}

export function isChunkLoadError(message: string): boolean {
  return DYNAMIC_IMPORT_ERROR_PATTERN.test(message);
}

export function setupChunkLoadRecoveryListeners(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const globalWindow = window as ChunkRecoveryWindow;
  if (globalWindow.__ntChunkRecoveryListenersRegistered) {
    return;
  }

  globalWindow.__ntChunkRecoveryListenersRegistered = true;

  window.addEventListener('vite:preloadError', (event: Event) => {
    event.preventDefault();
    recoverFromChunkLoadFailure();
  });

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.message || '')) {
      event.preventDefault();
      recoverFromChunkLoadFailure();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : '';

    if (isChunkLoadError(message)) {
      event.preventDefault();
      recoverFromChunkLoadFailure();
    }
  });
}
