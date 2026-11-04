import type { DuelMetric, IDuel } from '../types';

export const DUEL_METRICS: DuelMetric[] = ['time', 'chars', 'pages', 'episodes'];
export const DUEL_DURATIONS = [1, 3, 7, 14, 30];

/** Formats a remaining duration as its two largest units, such as "2d 3h". */
export function formatDuelTimeLeft(ms: number): string {
  const totalMinutes = Math.max(Math.floor(ms / 60_000), 0);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export type DuelOutcome = 'won' | 'lost' | 'draw';

export function getDuelOutcome(
  duel: IDuel,
  viewerId: string | undefined
): DuelOutcome | null {
  if (duel.status !== 'completed') return null;
  if (duel.isDraw || !duel.winner) return 'draw';
  return duel.winner === viewerId ? 'won' : 'lost';
}
