const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function goalTodayKey(timeZone: string, now = new Date()): string {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    dateFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function isGoalTargetDatePast(
  targetDate: Date,
  timeZone: string,
  now = new Date()
): boolean {
  if (Number.isNaN(targetDate.getTime())) return true;
  return targetDate.toISOString().slice(0, 10) < goalTodayKey(timeZone, now);
}
