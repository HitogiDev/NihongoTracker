import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';
import { useTimezone } from '../hooks/useTimezone';

interface HeatmapCell {
  date: string; // YYYY-MM-DD in user timezone
  value: number;
  level: number;
}

interface ImmersionHeatmapProps {
  username: string;
}

interface LogData {
  _id: string;
  date: string | Date;
  xp?: number;
  unknownDate?: boolean;
}

/** Extract YYYY-MM-DD from a UTC Date in the given IANA timezone without
 *  constructing a new Date (avoids the double-shift bug). */
function toDateKey(utcDate: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(utcDate);

    const y = parts.find((p) => p.type === 'year')?.value ?? '';
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const d = parts.find((p) => p.type === 'day')?.value ?? '';
    return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC
    const y = utcDate.getUTCFullYear();
    const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(utcDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/** Add `days` calendar days to a YYYY-MM-DD string. */
function addDays(dateKey: string, days: number): string {
  // Parse as UTC noon to avoid DST edge-cases
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Day-of-week (0=Sun…6=Sat) for a YYYY-MM-DD string, interpreted as UTC. */
function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

const WEEKS = 24;
const DAYS = WEEKS * 7; // 168

const ImmersionHeatmap: React.FC<ImmersionHeatmapProps> = ({ username }) => {
  const { timezone } = useTimezone();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['heatmap-logs', username],
    // limit 0 = no limit so we don't miss logs that could affect the XP scale
    queryFn: () => getUserLogsFn(username, { limit: 0 }),
    enabled: !!username,
  });

  const { weeks, todayKey } = React.useMemo(() => {
    const todayKey = toDateKey(new Date(), timezone);

    if (!logs || !Array.isArray(logs)) {
      return { weeks: [], todayKey };
    }

    // ── Aggregate XP by date ──────────────────────────────────────────────
    const dailyXp = new Map<string, number>();

    // The earliest date we care about (168 days back, inclusive)
    const firstKey = addDays(todayKey, -(DAYS - 1));

    for (const log of logs as LogData[]) {
      if (log.unknownDate || !log.date) continue;
      const key = toDateKey(new Date(log.date), timezone);
      if (key < firstKey || key > todayKey) continue;
      dailyXp.set(
        key,
        (dailyXp.get(key) ?? 0) + Math.max(0, Number(log.xp) || 0)
      );
    }

    const maxXp = dailyXp.size ? Math.max(...dailyXp.values()) : 0;

    const levelFor = (xp: number): number => {
      if (xp <= 0 || maxXp <= 0) return 0;
      const r = xp / maxXp;
      if (r >= 0.8) return 4;
      if (r >= 0.55) return 3;
      if (r >= 0.3) return 2;
      return 1;
    };

    // ── Build columns (weeks), each column = 7 rows (Sun→Sat) ────────────
    // Today falls on dayOfWeek(todayKey) row. The last column ends on today's
    // row; rows after today in that column are empty padding cells.
    const todayDow = dayOfWeek(todayKey); // 0–6
    // Total cells in the grid = WEEKS * 7, last cell = todayKey, aligned so
    // today sits at row `todayDow` of the last column.
    // Cell index of today = WEEKS*7 - 1 - (6 - todayDow) = WEEKS*7 - 7 + todayDow
    const todayCellIndex = DAYS - 7 + todayDow;

    const columns: (HeatmapCell | null)[][] = [];

    for (let col = 0; col < WEEKS; col++) {
      const column: (HeatmapCell | null)[] = [];
      for (let row = 0; row < 7; row++) {
        const cellIndex = col * 7 + row;
        // Days relative to today: negative = past, positive = future
        const daysOffset = cellIndex - todayCellIndex;
        if (daysOffset > 0) {
          // Future cells in the last column — render as empty padding
          column.push(null);
          continue;
        }
        const key = addDays(todayKey, daysOffset);
        const xp = dailyXp.get(key) ?? 0;
        column.push({ date: key, value: xp, level: levelFor(xp) });
      }
      columns.push(column);
    }

    return { weeks: columns, todayKey };
  }, [logs, timezone]);

  const cellClass = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-primary/30';
      case 2:
        return 'bg-primary/50';
      case 3:
        return 'bg-primary/70';
      case 4:
        return 'bg-primary';
      default:
        return 'bg-base-300';
    }
  };

  const tooltip = (cell: HeatmapCell) => {
    // Format date for display — parse as UTC noon so timezone doesn't shift the day
    const d = new Date(`${cell.date}T12:00:00Z`);
    const label = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return cell.date === todayKey
      ? `${label}: ${cell.value} XP (today)`
      : `${label}: ${cell.value} XP`;
  };

  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center h-20">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between">
        {weeks.map((column, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {column.map((cell, ri) => {
              if (!cell) {
                return <div key={ri} className="w-3 h-3" />;
              }
              const isToday = cell.date === todayKey;
              return (
                <div
                  key={ri}
                  className={`w-3 h-3 rounded-sm tooltip tooltip-left md:tooltip-top ${cellClass(cell.level)} ${isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-base-100' : ''}`}
                  data-tip={tooltip(cell)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-base-content/60">
        <span>Less</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-3 h-3 rounded-sm ${cellClass(level)}`}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
};

export default ImmersionHeatmap;
