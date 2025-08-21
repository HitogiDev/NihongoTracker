import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserLogsFn } from '../api/trackerApi';

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
}

const ImmersionHeatmap: React.FC<ImmersionHeatmapProps> = ({ username }) => {
  // Get logs for the past year
  const { data: logs, isLoading } = useQuery({
    queryKey: ['heatmap-logs', username],
    queryFn: () => getUserLogsFn(username, { limit: 1000 }),
    enabled: !!username,
  });

  const heatmapData = useMemo(() => {
    if (!logs || !Array.isArray(logs)) return [];

    // Create a map to store daily totals
    const dailyData = new Map<string, number>();

    // Get date 24 weeks ago (168 days)
    const twentyFourWeeksAgo = new Date();
    twentyFourWeeksAgo.setDate(twentyFourWeeksAgo.getDate() - (24 * 7 - 1));

    // Process logs and group by date
    logs.forEach((log: LogData) => {
      const logDate = new Date(log.date);
      if (logDate >= twentyFourWeeksAgo) {
        const dateKey = logDate.toISOString().split('T')[0];
        const currentTotal = dailyData.get(dateKey) || 0;
        const timeValue = log.time || 0;
        dailyData.set(dateKey, currentTotal + timeValue);
      }
    });

    // Generate heatmap data for 24 weeks (168 days)
    const heatmapData: HeatmapData[] = [];
    const today = new Date();

    for (let i = 24 * 7 - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const value = dailyData.get(dateKey) || 0;

      // Determine intensity level (0-4)
      let level = 0;
      if (value > 0) level = 1;
      if (value >= 30) level = 2;
      if (value >= 60) level = 3;
      if (value >= 120) level = 4;

      heatmapData.push({
        date: dateKey,
        value,
        level,
      });
    }

    return heatmapData;
  }, [logs]);

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
    });
    return `${formattedDate}: ${data.value} minutes`;
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
                    className={`w-3 h-3 rounded-sm tooltip tooltip-top ${getIntensityClass(data.level)}`}
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
