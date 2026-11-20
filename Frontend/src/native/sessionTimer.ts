import { registerPlugin } from '@capacitor/core';
import type { IMediaDocument } from '../types';
import { isNativeApp } from '../utils/nativeRuntime';

/** The media fields that the session keeps to prefill the log. */
export type SessionMedia = Pick<
  IMediaDocument,
  | 'contentId'
  | 'type'
  | 'title'
  | 'contentImage'
  | 'coverImage'
  | 'isAdult'
  | 'isAdultImage'
  | 'episodes'
  | 'episodeDuration'
  | 'runtime'
  | 'volumes'
>;

/**
 * The immersion session timer.
 * Keep the fields aligned with Mobile/android/.../timer/SessionTimerState.java.
 */
export interface SessionTimerState {
  userId: string;
  /** The title that the notification shows. */
  title: string;
  media: SessionMedia;
  /** Time counted before the current run, in milliseconds. */
  accumulatedMs: number;
  /** Start of the current run (epoch milliseconds), or null while paused. */
  runningSince: number | null;
  startedAt: number;
  labels: Record<string, string>;
}

export interface SessionStartInput {
  userId: string;
  title: string;
  media: SessionMedia;
  labels: Record<string, string>;
}

interface StateResult {
  state?: string | null;
}

interface NihongoSessionTimerPlugin {
  start(options: { data: string }): Promise<StateResult>;
  pause(): Promise<StateResult>;
  resume(): Promise<StateResult>;
  stop(): Promise<StateResult>;
  getState(): Promise<StateResult>;
  refresh(options: { labels?: string }): Promise<StateResult>;
  checkPermissions(): Promise<{ notifications: string }>;
  requestPermissions(): Promise<{ notifications: string }>;
  addListener(
    event: 'stateChange',
    listener: () => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const NihongoSessionTimer =
  registerPlugin<NihongoSessionTimerPlugin>('NihongoSessionTimer');

const LOCAL_KEY = 'nihongo:session-timer';
const localListeners = new Set<() => void>();

/** Older native builds do not have the plugin. They keep the timer in the web view only. */
let nativeMissing = false;
const nativeAvailable = () => isNativeApp() && !nativeMissing;

function isUnimplemented(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'UNIMPLEMENTED'
  );
}

function parseState(raw: string | null | undefined): SessionTimerState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SessionTimerState;
    return value?.media?.contentId ? value : null;
  } catch {
    return null;
  }
}

function readLocal() {
  try {
    return parseState(localStorage.getItem(LOCAL_KEY));
  } catch {
    return null;
  }
}

function writeLocal(state: SessionTimerState | null) {
  try {
    if (state) localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* Storage can be unavailable. The timer then lasts until reload. */
  }
  localListeners.forEach((listener) => listener());
  return state;
}

async function callNative(
  run: () => Promise<StateResult>,
  fallback: () => SessionTimerState | null
) {
  if (!nativeAvailable()) return fallback();
  try {
    return parseState((await run()).state);
  } catch (error) {
    if (!isUnimplemented(error)) throw error;
    nativeMissing = true;
    return fallback();
  }
}

export function sessionElapsedMs(state: SessionTimerState, now = Date.now()) {
  const accumulated = Math.max(0, state.accumulatedMs || 0);
  if (!state.runningSince) return accumulated;
  return accumulated + Math.max(0, now - state.runningSince);
}

export function getSessionState() {
  return callNative(() => NihongoSessionTimer.getState(), readLocal);
}

export function startSession(input: SessionStartInput) {
  const now = Date.now();
  const data: SessionTimerState = {
    ...input,
    accumulatedMs: 0,
    runningSince: now,
    startedAt: now,
  };
  return callNative(
    () => NihongoSessionTimer.start({ data: JSON.stringify(data) }),
    () => writeLocal(data)
  );
}

export function pauseSession() {
  return callNative(
    () => NihongoSessionTimer.pause(),
    () => {
      const state = readLocal();
      if (!state?.runningSince) return state;
      return writeLocal({
        ...state,
        accumulatedMs: sessionElapsedMs(state),
        runningSince: null,
      });
    }
  );
}

export function resumeSession() {
  return callNative(
    () => NihongoSessionTimer.resume(),
    () => {
      const state = readLocal();
      if (!state || state.runningSince) return state;
      return writeLocal({ ...state, runningSince: Date.now() });
    }
  );
}

export function stopSession() {
  return callNative(
    () => NihongoSessionTimer.stop(),
    () => writeLocal(null)
  );
}

/** Show the notification again and update its labels. */
export function refreshSession(labels?: Record<string, string>) {
  return callNative(
    () =>
      NihongoSessionTimer.refresh({
        labels: labels ? JSON.stringify(labels) : undefined,
      }),
    () => {
      const state = readLocal();
      return state && labels ? writeLocal({ ...state, labels }) : state;
    }
  );
}

/** Return false when the user does not allow notifications. The timer still works in the app. */
export async function ensureSessionNotifications() {
  if (!nativeAvailable()) return true;
  try {
    let { notifications } = await NihongoSessionTimer.checkPermissions();
    if (notifications === 'prompt' || notifications === 'prompt-with-rationale') {
      ({ notifications } = await NihongoSessionTimer.requestPermissions());
    }
    return notifications === 'granted';
  } catch {
    return true;
  }
}

/** Call the listener when the notification actions change the session. */
export function onSessionChange(listener: () => void) {
  localListeners.add(listener);
  let removeNative: (() => Promise<void>) | undefined;
  let disposed = false;
  if (nativeAvailable()) {
    NihongoSessionTimer.addListener('stateChange', listener)
      .then((handle) => {
        if (disposed) void handle.remove();
        else removeNative = handle.remove;
      })
      .catch(() => {
        /* Older native builds do not have the plugin. */
      });
  }
  return () => {
    disposed = true;
    localListeners.delete(listener);
    void removeNative?.();
  };
}
