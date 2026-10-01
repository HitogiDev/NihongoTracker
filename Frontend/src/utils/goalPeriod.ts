export type GoalPeriod = { startDate: string; targetDate: string };
export type GoalPeriodPreset = 'today' | 'thisWeek' | 'thisMonth' | 'nextDays';

export function goalInputDate(value: string | Date): string {
  return (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);
}

export function goalDateKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function goalPeriodFromPreset(
  preset: GoalPeriodPreset,
  timeZone: string,
  days = 7,
  now = new Date()
): GoalPeriod {
  const today = new Date(`${goalDateKey(now, timeZone)}T00:00:00Z`);
  const start = new Date(today);
  const end = new Date(today);

  if (preset === 'thisWeek') {
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    end.setTime(start.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
  } else if (preset === 'thisMonth') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (preset === 'nextDays') {
    end.setUTCDate(end.getUTCDate() + days - 1);
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    targetDate: end.toISOString().slice(0, 10)
  };
}
