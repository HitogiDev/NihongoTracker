import { useEffect, useState } from 'react';
import {
  sessionElapsedMs,
  type SessionTimerState,
} from '../native/sessionTimer';

/** Return the elapsed session seconds. Update every second while the timer runs. */
export default function useSessionElapsed(state: SessionTimerState | null) {
  const [now, setNow] = useState(() => Date.now());
  const running = Boolean(state?.runningSince);

  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, state]);

  return state ? Math.floor(sessionElapsedMs(state, now) / 1000) : 0;
}

export function formatSessionTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
