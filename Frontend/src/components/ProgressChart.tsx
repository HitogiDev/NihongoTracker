import { ILog } from '../types';
import { ChartArea, ScriptableContext } from 'chart.js';
import LineChart from './LineChart';
import BarChart from './BarChart';
import { useEffect, useState } from 'react';
import { useTimezone } from '../hooks/useTimezone';
import { useThemeColors } from '../hooks/useThemeColors';
import { convertToUserTimezone } from '../utils/timezone';

interface LocalDateInfo {
  iso: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayKey: string;
  monthKey: string;
  utcMillis: number;
}

interface ProgressChartProps {
  logs?: ILog[];
  statsData?: Array<{
    type: string;
    count: number;
    totalXp: number;
    totalTimeMinutes: number;
    totalTimeHours: number;
    untrackedCount: number;
    dates: Array<{
      date: Date | string;
      unknownDate?: boolean;
      xp: number;
      time?: number;
      episodes?: number;
      localDate?: LocalDateInfo;
    }>;
  }>;
  selectedType?: string;
  timeframe?: 'today' | 'week' | 'month' | 'year' | 'total';
  metric?: 'xp' | 'hours';
  chartType?: 'line' | 'bar';
  showTitle?: boolean;
}

const MEDIA_TYPE_COLORS: Record<string, string> = {
  vn: '#3a70e4',
  game: '#59c94e',
  anime: '#26b2f2',
  video: '#2cc9a4',
  'tv show': '#f8b420',
  manga: '#ee4466',
  reading: '#b34ce6',
  movie: '#f77118',
  audio: '#f2a15a',
  other: '#10b785',
};

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace('#', '');

  if (hexColor.startsWith('rgba(')) {
    return hexColor.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  if (hexColor.startsWith('rgb(')) {
    return hexColor.replace(/^rgb\(/, 'rgba(').replace(')', `, ${alpha})`);
  }

  if (hexColor.startsWith('hsla(')) {
    return hexColor.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  if (hexColor.startsWith('hsl(')) {
    return hexColor.replace(/^hsl\(/, 'hsla(').replace(')', `, ${alpha})`);
  }

  if (hexColor.startsWith('oklch(')) {
    if (hexColor.includes('/')) {
      return hexColor.replace(/\/\s*[\d.]+\)$/, `/ ${alpha})`);
    }
    return hexColor.replace(')', ` / ${alpha})`);
  }

  if (normalized.length !== 6) {
    return hexColor;
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getProgressColor(selectedType: string, primaryColor: string) {
  if (selectedType === 'all') {
    return primaryColor;
  }
  return MEDIA_TYPE_COLORS[selectedType] || MEDIA_TYPE_COLORS.other;
}

export default function ProgressChart({
  logs,
  statsData,
  selectedType = 'all',
  timeframe: externalTimeframe,
  metric = 'xp',
  chartType = 'line',
  showTitle = true,
}: ProgressChartProps) {
  const { timezone } = useTimezone();
  const themeColors = useThemeColors(1);
  const [timeframe, setTimeframe] = useState<
    'today' | 'week' | 'month' | 'year' | 'total'
  >('total');

  useEffect(() => {
    if (externalTimeframe) {
      setTimeframe(externalTimeframe);
    }
  }, [externalTimeframe]);

  // Process data based on which data source is provided
  let labels: string[] = [];
  let metricValues: number[] = [];

  const getUtcDateFromLocal = (local: LocalDateInfo) =>
    new Date(local.utcMillis);

  if (statsData) {
    // Process data from statsData (IUserStats format)
    const relevantStats =
      selectedType === 'all'
        ? statsData
        : statsData.filter((stat) => stat.type === selectedType);

    // Collect all dates across all types
    const allDatesMap: { [key: string]: number } = {};

    // Fill with data
    relevantStats.forEach((typeStat) => {
      typeStat.dates.forEach((dateEntry) => {
        if (dateEntry.unknownDate) {
          return;
        }

        if (!dateEntry.localDate) {
          return;
        }

        const local = dateEntry.localDate;
        let dateKey: string;

        if (timeframe === 'today') {
          dateKey = `${local.hour}`;
        } else if (timeframe === 'week') {
          const dateObj = getUtcDateFromLocal(local);
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          dateKey = dayNames[dateObj.getUTCDay()];
        } else if (timeframe === 'month') {
          dateKey = `${local.day}`;
        } else if (timeframe === 'year') {
          dateKey = `${local.month - 1}`;
        } else {
          dateKey = local.monthKey;
        }

        if (!allDatesMap[dateKey]) {
          allDatesMap[dateKey] = 0;
        }
        if (metric === 'xp') {
          allDatesMap[dateKey] += dateEntry.xp;
        } else {
          allDatesMap[dateKey] += (dateEntry.time || 0) / 60;
        }
      });
    });

    // Sort and format labels and data based on timeframe
    if (timeframe === 'today') {
      // Format for hours in a day
      const hourLabels: string[] = [];
      const hourValues: number[] = [];

      for (let i = 0; i < 24; i++) {
        hourLabels.push(`${i}:00`);
        hourValues.push(allDatesMap[i.toString()] || 0);
      }

      labels = hourLabels;
      metricValues = hourValues;
    } else if (timeframe === 'week') {
      // Format for days in a week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayValues: number[] = [];

      dayNames.forEach((day) => {
        dayValues.push(allDatesMap[day] || 0);
      });

      labels = dayNames;
      metricValues = dayValues;
    } else if (timeframe === 'month') {
      // Format for days in current month
      const currentLocal = convertToUserTimezone(new Date(), timezone);
      const daysInMonth = new Date(
        currentLocal.getFullYear(),
        currentLocal.getMonth() + 1,
        0
      ).getDate();

      const dayLabels: string[] = [];
      const dayValues: number[] = [];

      for (let i = 1; i <= daysInMonth; i++) {
        dayLabels.push(i.toString());
        dayValues.push(allDatesMap[i.toString()] || 0);
      }

      labels = dayLabels;
      metricValues = dayValues;
    } else if (timeframe === 'year') {
      // Format for months in a year
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      const monthLabels: string[] = [];
      const monthValues: number[] = [];

      for (let i = 0; i < 12; i++) {
        monthLabels.push(months[i]);
        monthValues.push(allDatesMap[i.toString()] || 0);
      }

      labels = monthLabels;
      metricValues = monthValues;
    } else {
      // Format for total (year-month)
      const sortedKeys = Object.keys(allDatesMap).sort();

      // Convert year-month keys to readable format
      labels = sortedKeys.map((key) => {
        const [year, month] = key.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'short',
          }
        );
      });

      metricValues = sortedKeys.map((key) => allDatesMap[key]);
    }
  } else if (logs) {
    // Original logic for ILog[] data
    const filteredLogs = filterLogsByTimeframe(logs, timeframe);

    if (timeframe === 'today') {
      const metricByHour: { [key: string]: number } = {};

      for (let i = 0; i < 24; i++) {
        metricByHour[i.toString()] = 0;
      }

      filteredLogs.forEach((log) => {
        const logDateInUserTz = convertToUserTimezone(
          new Date(log.date),
          timezone
        );
        const hour = logDateInUserTz.getHours();
        if (metric === 'xp') {
          metricByHour[hour.toString()] += log.xp;
        } else {
          metricByHour[hour.toString()] += (log.time || 0) / 60; // Convert minutes to hours
        }
      });

      labels = Object.keys(metricByHour)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((hour) => `${hour}:00`);
      metricValues = Object.keys(metricByHour)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((hour) => metricByHour[hour]);
    } else if (timeframe === 'week') {
      const metricByDay: { [key: string]: number } = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      dayNames.forEach((day) => {
        metricByDay[day] = 0;
      });

      filteredLogs.forEach((log) => {
        const logDateInUserTz = convertToUserTimezone(
          new Date(log.date),
          timezone
        );
        const dayOfWeek = logDateInUserTz.getDay();
        const dayName = dayNames[dayOfWeek];
        if (metric === 'xp') {
          metricByDay[dayName] += log.xp;
        } else {
          metricByDay[dayName] += (log.time || 0) / 60; // Convert minutes to hours
        }
      });

      labels = dayNames;
      metricValues = dayNames.map((day) => metricByDay[day]);
    } else if (timeframe === 'month') {
      const metricByDate = getMetricByDate(filteredLogs);
      const dates = Object.keys(metricByDate).sort();
      labels = dates.map((date) => new Date(date).getDate().toString());
      metricValues = dates.map((date) => metricByDate[date]);
    } else if (timeframe === 'year') {
      const metricByMonth: { [key: string]: number } = {};
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      filteredLogs.forEach((log) => {
        const logDateInUserTz = convertToUserTimezone(
          new Date(log.date),
          timezone
        );
        const monthIndex = logDateInUserTz.getMonth();
        if (!metricByMonth[monthIndex.toString()]) {
          metricByMonth[monthIndex.toString()] = 0;
        }
        if (metric === 'xp') {
          metricByMonth[monthIndex.toString()] += log.xp;
        } else {
          metricByMonth[monthIndex.toString()] += (log.time || 0) / 60; // Convert minutes to hours
        }
      });

      const monthIndices = Object.keys(metricByMonth)
        .map(Number)
        .sort((a, b) => a - b);

      labels = monthIndices.map((monthIdx) => months[monthIdx]);
      metricValues = monthIndices.map(
        (monthIdx) => metricByMonth[monthIdx.toString()]
      );
    } else {
      const metricByMonthYear: { [key: string]: number } = {};

      filteredLogs.forEach((log) => {
        const date = new Date(log.date);
        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;

        if (!metricByMonthYear[yearMonth]) {
          metricByMonthYear[yearMonth] = 0;
        }
        if (metric === 'xp') {
          metricByMonthYear[yearMonth] += log.xp;
        } else {
          metricByMonthYear[yearMonth] += (log.time || 0) / 60; // Convert minutes to hours
        }
      });

      const sortedKeys = Object.keys(metricByMonthYear).sort();
      labels = sortedKeys;
      metricValues = sortedKeys.map((key) => metricByMonthYear[key]);
    }
  }

  // Check if there's actual data (sum of all values > 0)
  const hasData: boolean = metricValues.some((value) => value > 0);

  function filterLogsByTimeframe(logs: ILog[], timeframe: string) {
    const now = new Date();
    const nowInUserTz = convertToUserTimezone(now, timezone);

    return logs.filter((log) => {
      if (log.unknownDate) {
        return false;
      }

      const logDateInUserTz = convertToUserTimezone(
        new Date(log.date),
        timezone
      );

      if (timeframe === 'today') {
        return logDateInUserTz.toDateString() === nowInUserTz.toDateString();
      } else if (timeframe === 'week') {
        const startOfWeek = new Date(nowInUserTz);
        startOfWeek.setDate(nowInUserTz.getDate() - nowInUserTz.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return logDateInUserTz >= startOfWeek;
      } else if (timeframe === 'month') {
        return (
          logDateInUserTz.getMonth() === nowInUserTz.getMonth() &&
          logDateInUserTz.getFullYear() === nowInUserTz.getFullYear()
        );
      } else if (timeframe === 'year') {
        return logDateInUserTz.getFullYear() === nowInUserTz.getFullYear();
      } else {
        return true;
      }
    });
  }

  function getMetricByDate(logs: ILog[]) {
    const metricByDate: { [key: string]: number } = {};

    logs.forEach((log) => {
      const logDateInUserTz = convertToUserTimezone(
        new Date(log.date),
        timezone
      );
      const dateStr = logDateInUserTz.toISOString().split('T')[0];
      if (!metricByDate[dateStr]) {
        metricByDate[dateStr] = 0;
      }
      if (metric === 'xp') {
        metricByDate[dateStr] += log.xp;
      } else {
        metricByDate[dateStr] += (log.time || 0) / 60; // Convert minutes to hours
      }
    });

    return metricByDate;
  }

  function createGradient(
    ctx: CanvasRenderingContext2D,
    chartArea: ChartArea,
    color: string
  ) {
    const { top, bottom } = chartArea;
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, withAlpha(color, 0.55));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  }

  const datasetLabel = metric === 'xp' ? 'XP Earned' : 'Time Spent (hours)';
  const progressColor = getProgressColor(selectedType, themeColors.primary);

  const lineData = {
    labels: labels,
    datasets: [
      {
        label: datasetLabel,
        data: metricValues,
        fill: true,
        spanGaps: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 2,
        pointHitRadius: 12,
        pointBackgroundColor: 'rgba(0, 0, 0, 0)',
        pointBorderColor: progressColor,
        pointHoverBackgroundColor: progressColor,
        pointHoverBorderColor: progressColor,
        borderColor: progressColor,
        borderWidth: 3,
        backgroundColor: function (context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return undefined;
          return createGradient(ctx, chartArea, progressColor);
        },
        tension: 0.35,
        cubicInterpolationMode: 'monotone' as const,
      },
    ],
  };

  const barData = {
    labels: labels,
    datasets: [
      {
        label: datasetLabel,
        data: metricValues,
        backgroundColor: withAlpha(progressColor, 0.35),
        borderColor: progressColor,
        borderWidth: 1,
      },
    ],
  };

  const typeLabel =
    logs && !statsData
      ? 'This Media'
      : selectedType === 'all'
        ? 'All Media Types'
        : selectedType === 'game'
          ? 'Video Game'
          : selectedType.charAt(0).toUpperCase() + selectedType.slice(1);

  return (
    <div className="w-full h-full">
      <div className="h-full w-full">
        <div className="flex items-center justify-between mb-6 px-4">
          <div>
            {showTitle && (
              <h2 className="text-2xl font-bold text-primary mb-2">Activity</h2>
            )}
            {hasData ? (
              <p className="text-sm text-base-content mb-4">
                {typeLabel} -
                {timeframe === 'today'
                  ? ` Hourly ${metric === 'xp' ? 'XP' : 'Time'} - Today`
                  : timeframe === 'week'
                    ? ` Daily ${metric === 'xp' ? 'XP' : 'Time'} - This Week`
                    : timeframe === 'month'
                      ? ` Daily ${metric === 'xp' ? 'XP' : 'Time'} - Current Month`
                      : timeframe === 'year'
                        ? `${metric === 'xp' ? 'XP' : 'Time'} Over the Year`
                        : ` Total ${metric === 'xp' ? 'XP' : 'Time'} Over Time`}
              </p>
            ) : null}
          </div>
          {!externalTimeframe && (
            <div>
              <select
                value={timeframe}
                onChange={(e) =>
                  setTimeframe(
                    e.target.value as
                      | 'today'
                      | 'week'
                      | 'month'
                      | 'year'
                      | 'total'
                  )
                }
                className="select select-bordered"
              >
                <option value="total">Total</option>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="today">Today</option>
              </select>
            </div>
          )}
        </div>
        {chartType === 'line' ? (
          <LineChart data={lineData} />
        ) : (
          <div className="rounded-lg border border-base-content/30 mx-4">
            <div className="bg-base-50 p-4" style={{ height: '350px' }}>
              <BarChart
                data={barData}
                options={{
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
