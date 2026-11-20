import { create } from 'zustand';
import {
  getSessionState,
  pauseSession,
  refreshSession,
  resumeSession,
  startSession,
  stopSession,
  type SessionStartInput,
  type SessionTimerState,
} from '../native/sessionTimer';

interface SessionTimerStore {
  state: SessionTimerState | null;
  ready: boolean;
}

/**
 * Mirror of the native session timer. The native state is the source of truth,
 * so this store is not persisted.
 */
export const useSessionTimerStore = create<SessionTimerStore>(() => ({
  state: null,
  ready: false,
}));

function apply(state: SessionTimerState | null) {
  useSessionTimerStore.setState({ state, ready: true });
  return state;
}

/** Read the native state. Stop a session that belongs to another account. */
export async function syncSessionTimer(userId: string | undefined) {
  const state = await getSessionState();
  if (state && userId && state.userId !== userId) {
    return apply(await stopSession());
  }
  return apply(userId ? state : null);
}

export async function startSessionTimer(input: SessionStartInput) {
  return apply(await startSession(input));
}

export async function pauseSessionTimer() {
  return apply(await pauseSession());
}

export async function resumeSessionTimer() {
  return apply(await resumeSession());
}

export async function stopSessionTimer() {
  return apply(await stopSession());
}

export async function refreshSessionTimer(labels?: Record<string, string>) {
  return apply(await refreshSession(labels));
}
