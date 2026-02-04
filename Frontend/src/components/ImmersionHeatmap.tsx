import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';
import { useTimezone } from '../hooks/useTimezone';
import { convertToUserTimezone } from '../utils/timezone';

interface HeatmapData {
  date: string;
  value: number;
  level: number;
}

interface ImmersionHeatmapProps {
  username: string;
}

interface LogData {
  _id: string;
  date: string | Date;
  time?: number;
  xp?: number;
}

const ImmersionHeatmap: React.FC<ImmersionHeatmapProps> = ({ username }) => {
  const { timezone } = useTimezone();

  // Get logs for the past year
  const { data: logs, isLoading } = useQuery({
    queryKey: ['heatmap-logs', username],
    queryFn: () => getUserLogsFn(username, { limit: 1000 }),
    enabled: !!username,
  });

  const heatmapData = useMemo(() => {
    if (!logs || !Array.isArray(logs)) return [];

    // Create a map to store daily XP totals
    const dailyData = new Map<string, number>();

    // Get date 24 weeks ago (168 days) in user's timezone
    const now = new Date();
    const todayInUserTz = convertToUserTimezone(now, timezone);
    const twentyFourWeeksAgo = new Date(todayInUserTz);
    twentyFourWeeksAgo.setDate(twentyFourWeeksAgo.getDate() - (24 * 7 - 1));

    // Process logs and group by date in user's timezone
    logs.forEach((log: LogData) => {
      const logDateInUserTz = convertToUserTimezone(
        new Date(log.date),
        timezone
      );
      if (logDateInUserTz >= twentyFourWeeksAgo) {
        const dateKey = `${logDateInUserTz.getFullYear()}-${String(logDateInUserTz.getMonth() + 1).padStart(2, '0')}-${String(logDateInUserTz.getDate()).padStart(2, '0')}`;
        const currentTotal = dailyData.get(dateKey) || 0;
        const xpValue = Math.max(0, Number(log.xp) || 0);
        dailyData.set(dateKey, currentTotal + xpValue);
      }
    });

    const maxDailyXp = dailyData.size
      ? Math.max(...Array.from(dailyData.values()))
      : 0;

    // Generate heatmap data for 24 weeks (168 days) in user's timezone
    const heatmapData: HeatmapData[] = [];

    for (let i = 24 * 7 - 1; i >= 0; i--) {
      const date = new Date(todayInUserTz);
      date.setDate(date.getDate() - i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const value = dailyData.get(dateKey) || 0;

      // Determine intensity level (0-4) based on relative XP for the window
      let level = 0;
      if (value > 0) {
        if (maxDailyXp <= 0) {
          level = 1;
        } else {
          const ratio = value / maxDailyXp;
          if (ratio >= 0.8) level = 4;
          else if (ratio >= 0.55) level = 3;
          else if (ratio >= 0.3) level = 2;
          else level = 1;
        }
      }

      heatmapData.push({
        date: dateKey,
        value,
        level,
      });
    }

    return heatmapData;
  }, [logs, timezone]);

  const getIntensityClass = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-base-300';
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

  const formatTooltip = (data: HeatmapData) => {
    const date = new Date(data.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone, // Use user's timezone for display
    });
    return `${formattedDate}: ${data.value} XP`;
  };

  // Group data by weeks for GitHub-style layout
  const weeks = useMemo(() => {
    const weeksData = [];
    for (let i = 0; i < heatmapData.length; i += 7) {
      weeksData.push(heatmapData.slice(i, i + 7));
    }
    return weeksData;
  }, [heatmapData]);

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex justify-center items-center h-20">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Heatmap grid - 24 weeks in GitHub style */}
      <div className="w-full">
        <div className="flex justify-between">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((data, dayIndex) => {
                if (!data) {
                  return (
                    <div
                      key={dayIndex}
                      className="w-3 h-3 bg-base-300 rounded-sm"
                    ></div>
                  );
                }

                return (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm tooltip tooltip-left md:tooltip-top ${getIntensityClass(data.level)}`}
                    data-tip={formatTooltip(data)}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 text-xs text-base-content/60">
        <span>Less</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-3 h-3 rounded-sm ${getIntensityClass(level)}`}
            ></div>
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
};

export default ImmersionHeatmap;
