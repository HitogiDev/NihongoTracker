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
}

export default function ProgressChart({
  logs,
  statsData,
  selectedType = 'all',
  timeframe: externalTimeframe,
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
  let xpValues: number[] = [];

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

        // Accumulate XP values
        if (!allDatesMap[dateKey]) {
          allDatesMap[dateKey] = 0;
        }
        allDatesMap[dateKey] += dateEntry.xp;
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
      xpValues = hourValues;
    } else if (timeframe === 'week') {
      // Format for days in a week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayValues: number[] = [];

      dayNames.forEach((day) => {
        dayValues.push(allDatesMap[day] || 0);
      });

      labels = dayNames;
      xpValues = dayValues;
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
      xpValues = dayValues;
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
      xpValues = monthValues;
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

      xpValues = sortedKeys.map((key) => allDatesMap[key]);
    }
  } else if (logs) {
    // Original logic for ILog[] data
    const filteredLogs = filterLogsByTimeframe(logs, timeframe);

    if (timeframe === 'today') {
      const xpByHour: { [key: string]: number } = {};

      for (let i = 0; i < 24; i++) {
        xpByHour[i.toString()] = 0;
      }

      filteredLogs.forEach((log) => {
        const logDateInUserTz = convertToUserTimezone(
          new Date(log.date),
          timezone
        );
        const hour = logDateInUserTz.getHours();
        xpByHour[hour.toString()] += log.xp;
      });

      labels = Object.keys(xpByHour)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((hour) => `${hour}:00`);
      xpValues = Object.keys(xpByHour)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((hour) => xpByHour[hour]);
    } else if (timeframe === 'week') {
      const xpByDay: { [key: string]: number } = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      dayNames.forEach((day) => {
        xpByDay[day] = 0;
      });

      filteredLogs.forEach((log) => {
        const logDateInUserTz = convertToUserTimezone(
          new Date(log.date),
          timezone
        );
        const dayOfWeek = logDateInUserTz.getDay();
        const dayName = dayNames[dayOfWeek];
        xpByDay[dayName] += log.xp;
      });

      labels = dayNames;
      xpValues = dayNames.map((day) => xpByDay[day]);
    } else if (timeframe === 'month') {
      const xpByDate = getXpByDate(filteredLogs);
      const dates = Object.keys(xpByDate).sort();
      labels = dates.map((date) => new Date(date).getDate().toString());
      xpValues = dates.map((date) => xpByDate[date]);
    } else if (timeframe === 'year') {
      const xpByMonth: { [key: string]: number } = {};
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
        if (!xpByMonth[monthIndex.toString()]) {
          xpByMonth[monthIndex.toString()] = 0;
        }
        xpByMonth[monthIndex.toString()] += log.xp;
      });

      const monthIndices = Object.keys(xpByMonth)
        .map(Number)
        .sort((a, b) => a - b);

      labels = monthIndices.map((monthIdx) => months[monthIdx]);
      xpValues = monthIndices.map((monthIdx) => xpByMonth[monthIdx.toString()]);
    } else {
      const xpByMonthYear: { [key: string]: number } = {};

      filteredLogs.forEach((log) => {
        const date = new Date(log.date);
        const yearMonth = `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, '0')}`;

        if (!xpByMonthYear[yearMonth]) {
          xpByMonthYear[yearMonth] = 0;
        }
        xpByMonthYear[yearMonth] += log.xp;
      });

      const sortedKeys = Object.keys(xpByMonthYear).sort();
      labels = sortedKeys;
      xpValues = sortedKeys.map((key) => xpByMonthYear[key]);
    }
  }

  // Check if there's actual data (sum of all values > 0)
  const hasData: boolean = xpValues.some((value) => value > 0);

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

  function getXpByDate(logs: ILog[]) {
    const xpByDate: { [key: string]: number } = {};

    logs.forEach((log) => {
      const logDateInUserTz = convertToUserTimezone(
        new Date(log.date),
        timezone
      );
      const dateStr = logDateInUserTz.toISOString().split('T')[0];
      if (!xpByDate[dateStr]) {
        xpByDate[dateStr] = 0;
      }
      xpByDate[dateStr] += log.xp;
    });

    return xpByDate;
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
        label: 'XP Earned',
        data: xpValues,
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
                {timeframe === 'today'
                  ? 'Hourly XP - Today'
                  : timeframe === 'week'
                    ? 'Daily XP - This Week'
                    : timeframe === 'month'
                      ? 'Daily XP - Current Month'
                      : timeframe === 'year'
                        ? 'XP Earned Over the Year'
                        : 'Total XP Earned Over Time'}
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

        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-base-300 mx-4">
          <div
            className="bg-base-50 p-4"
            style={{ width: '2000px', height: '350px' }}
          >
            {hasData ? (
              <LineChart data={consistencyData} />
            ) : (
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>No data available for the selected timeframe.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
