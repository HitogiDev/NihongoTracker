import { ILog } from '../types';
import { ChartArea, ScriptableContext } from 'chart.js';
import LineChart from './LineChart';
import { useEffect, useState } from 'react';
import { useTimezone } from '../hooks/useTimezone';
import { convertToUserTimezone } from '../utils/timezone';

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
      date: Date;
      xp: number;
      time?: number;
      episodes?: number;
    }>;
  }>;
  selectedType?: string;
  timeframe?: 'today' | 'week' | 'month' | 'year' | 'total';
  metric?: 'xp' | 'hours';
}

export default function ProgressChart({
  logs,
  statsData,
  selectedType = 'all',
  timeframe: externalTimeframe,
  metric = 'xp',
}: ProgressChartProps) {
  const { timezone } = useTimezone();
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
        const date = new Date(dateEntry.date);

        // Format date based on timeframe
        let dateKey: string;
        if (timeframe === 'today') {
          dateKey = `${date.getHours()}`;
        } else if (timeframe === 'week') {
          const weekDay = date.getDay();
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          dateKey = dayNames[weekDay];
        } else if (timeframe === 'month') {
          dateKey = `${date.getDate()}`;
        } else if (timeframe === 'year') {
          dateKey = `${date.getMonth()}`;
        } else {
          // total
          dateKey = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, '0')}`;
        }

        // Accumulate values based on metric
        if (!allDatesMap[dateKey]) {
          allDatesMap[dateKey] = 0;
        }
        if (metric === 'xp') {
          allDatesMap[dateKey] += dateEntry.xp;
        } else {
          allDatesMap[dateKey] += dateEntry.time || 0;
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
      const currentDate = new Date();
      const daysInMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
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
          metricByHour[hour.toString()] += log.time || 0;
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
          metricByDay[dayName] += log.time || 0;
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
          metricByMonth[monthIndex.toString()] += log.time || 0;
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
          metricByMonthYear[yearMonth] += log.time || 0;
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
        metricByDate[dateStr] += log.time || 0;
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
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(50, 170, 250, 0)');
    return gradient;
  }

  const consistencyData = {
    labels: labels,
    datasets: [
      {
        label: metric === 'xp' ? 'XP Earned' : 'Time Spent (minutes)',
        data: metricValues,
        fill: true,
        pointRadius: 3,
        borderColor: 'rgb(50, 170, 250)',
        backgroundColor: function (context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return undefined;
          return createGradient(ctx, chartArea, 'rgba(50, 170, 250, 1)');
        },
        tension: 0.1,
      },
    ],
  };

  return (
    <div className="w-full h-full">
      <div className="h-full w-full">
        <div className="flex items-center justify-between mb-6 px-4">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-2">Progress</h2>
            {hasData ? (
              <p className="text-sm text-base-content mb-4">
                {selectedType === 'all'
                  ? 'All Media Types'
                  : selectedType.charAt(0).toUpperCase() +
                    selectedType.slice(1)}{' '}
                -
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
        <LineChart data={consistencyData} />
      </div>
    </div>
  );
}
