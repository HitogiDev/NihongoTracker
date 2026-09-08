import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Bar } from 'react-chartjs-2';
import { MEDIA_TYPE_COLORS } from '../constants/mediaColors';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTimezone } from '../hooks/useTimezone';
import { convertToUserTimezone } from '../utils/timezone';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

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

interface StatsByType {
  type: string;
  count: number;
  totalTimeHours: number;
  totalXp: number;
  dates: Array<{
    date: Date | string;
    unknownDate?: boolean;
    xp: number;
    time?: number;
    episodes?: number;
    localDate?: LocalDateInfo;
  }>;
}

interface StackedBarChartProps {
  statsData?: StatsByType[];
  selectedType: string;
  metric: 'xp' | 'hours';
  timeframe: 'today' | 'week' | 'month' | 'year' | 'total';
  showTitle?: boolean;
}

const typeColors = MEDIA_TYPE_COLORS;

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  statsData,
  selectedType,
  metric,
  timeframe,
  showTitle = true,
}) => {
  const { t } = useTranslation('stats');
  const { t: tCommon } = useTranslation('common');
  const lineColors = useThemeColors(1);
  const fillColors = useThemeColors(0.16);
  const { timezone } = useTimezone();

  const chartData = (() => {
    if (!statsData || statsData.length === 0) return null;

    // Filter data based on selected type
    const filteredData =
      selectedType === 'all'
        ? statsData.filter(
            (stat) => stat.totalXp > 0 || stat.totalTimeHours > 0
          )
        : statsData.filter(
            (stat) =>
              stat.type === selectedType &&
              (stat.totalXp > 0 || stat.totalTimeHours > 0)
          );

    if (filteredData.length === 0) return null;

    const pad = (value: number) => value.toString().padStart(2, '0');

    const toUtcDate = (local: LocalDateInfo) => new Date(local.utcMillis);

    const getWeekStartKey = (local: LocalDateInfo): string => {
      const weekStart = toUtcDate(local);
      const dayIndex = weekStart.getUTCDay();
      const diff = dayIndex === 0 ? -6 : 1 - dayIndex; // Monday start
      weekStart.setUTCDate(weekStart.getUTCDate() + diff);
      return `${weekStart.getUTCFullYear()}-${pad(weekStart.getUTCMonth() + 1)}-${pad(weekStart.getUTCDate())}`;
    };

    const getDateKey = (local: LocalDateInfo): string => {
      switch (timeframe) {
        case 'today':
        case 'month':
          return local.dayKey;
        case 'week':
          return getWeekStartKey(local);
        case 'year':
          return local.monthKey;
        default:
          return local.monthKey;
      }
    };

    const allDates = new Set<string>();
    const aggregatedStats = filteredData.map((stat) => {
      const grouped = new Map<string, { xp: number; minutes: number }>();

      stat.dates.forEach((dateEntry) => {
        if (dateEntry.unknownDate) {
          return;
        }

        if (!dateEntry.localDate) {
          return;
        }

        const dateKey = getDateKey(dateEntry.localDate);
        allDates.add(dateKey);

        const existing = grouped.get(dateKey);
        const minutesIncrement =
          typeof dateEntry.time === 'number' ? dateEntry.time : 0;

        if (existing) {
          existing.xp += dateEntry.xp;
          existing.minutes += minutesIncrement;
        } else {
          grouped.set(dateKey, {
            xp: dateEntry.xp,
            minutes: minutesIncrement,
          });
        }
      });

      return { stat, grouped };
    });

    let sortedDates = Array.from(allDates).sort();

    if (timeframe === 'month') {
      const nowLocal = convertToUserTimezone(new Date(), timezone);
      const currentYearMonth = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth() + 1)}`;

      let monthDates = sortedDates.filter((key) =>
        key.startsWith(`${currentYearMonth}-`)
      );

      if (monthDates.length === 0 && sortedDates.length > 0) {
        const fallbackYearMonth = sortedDates[sortedDates.length - 1].slice(
          0,
          7
        );
        monthDates = sortedDates.filter((key) =>
          key.startsWith(`${fallbackYearMonth}-`)
        );
      }

      if (monthDates.length === 0) {
        monthDates = [];
      }

      const referenceYearMonth = monthDates.length
        ? monthDates[0].slice(0, 7)
        : currentYearMonth;

      const [refYearStr, refMonthStr] = referenceYearMonth.split('-');
      const refYear = parseInt(refYearStr, 10) || nowLocal.getFullYear();
      const refMonthIndex =
        (parseInt(refMonthStr, 10) || nowLocal.getMonth() + 1) - 1;
      const yearMonthKey = `${refYear.toString().padStart(4, '0')}-${pad(refMonthIndex + 1)}`;
      const daysInMonth = new Date(refYear, refMonthIndex + 1, 0).getDate();

      const monthSet = new Set(monthDates);

      for (let day = 1; day <= daysInMonth; day++) {
        const dayKey = `${yearMonthKey}-${pad(day)}`;
        if (!monthSet.has(dayKey)) {
          monthDates.push(dayKey);
          monthSet.add(dayKey);
        }
      }

      monthDates.sort();
      sortedDates = monthDates;
    }

    const datasets = aggregatedStats.map(({ stat, grouped }) => {
      const data = sortedDates.map((dateKey) => {
        const aggregated = grouped.get(dateKey);
        if (!aggregated) return 0;

        if (metric === 'xp') {
          return aggregated.xp;
        }

        return aggregated.minutes / 60;
      });

      return {
        label:
          stat.type === 'vn'
            ? 'Visual Novel'
            : stat.type === 'game'
              ? 'Video Game'
              : stat.type.charAt(0).toUpperCase() + stat.type.slice(1),
        data,
        backgroundColor: typeColors[stat.type] || typeColors.other,
      };
    });

    // Format labels from precomputed keys to avoid browser-timezone shifts.
    const monthNames = [
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

    const formatMonthDayLabel = (key: string) => {
      const [yearStr, monthStr, dayStr] = key.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);

      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        month < 1 ||
        month > 12
      ) {
        return key;
      }

      return `${monthNames[month - 1]} ${day}`;
    };

    const labels = sortedDates.map((dateKey) => {
      switch (timeframe) {
        case 'today':
          return formatMonthDayLabel(dateKey);
        case 'week':
          return `Week of ${formatMonthDayLabel(dateKey)}`;
        case 'month': {
          const parts = dateKey.split('-');
          const day = parts[2] ? parseInt(parts[2], 10) : NaN;
          return Number.isFinite(day) ? day.toString() : dateKey;
        }
        case 'year':
          return dateKey;
        default: {
          const [yearStr, monthStr] = dateKey.split('-');
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);

          if (!Number.isFinite(year) || !Number.isFinite(month)) {
            return dateKey;
          }

          if (month < 1 || month > 12) {
            return dateKey;
          }

          return `${monthNames[month - 1]} ${year}`;
        }
      }
    });

    return {
      labels,
      datasets,
    };
  })();

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: lineColors.baseContent,
          font: {
            size: 12,
          },
          boxWidth: 28,
          boxHeight: 10,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: lineColors.base100,
        titleColor: lineColors.baseContent,
        bodyColor: lineColors.baseContent,
        borderColor: fillColors.baseContent,
        borderWidth: 1,
        callbacks: {
          label: function (context) {
            const value = context.parsed.y;
            const label = context.dataset.label || '';

            if (metric === 'xp') {
              return `${label}: ${value?.toLocaleString() ?? 0} XP`;
            } else {
              return `${label}: ${value?.toFixed(1) ?? '0.0'} hours`;
            }
          },
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
          onZoomComplete: ({ chart }) => {
            chart.update('none');
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
        ticks: {
          color: lineColors.baseContent,
          autoSkip: true,
          maxTicksLimit: 10,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: fillColors.baseContent,
        },
        ticks: {
          color: lineColors.baseContent,
          callback: function (value) {
            if (metric === 'xp') {
              return typeof value === 'number' ? value.toLocaleString() : value;
            } else {
              return typeof value === 'number' ? `${value.toFixed(1)}h` : value;
            }
          },
        },
      },
    },
    interaction: {
      mode: 'index',
      axis: 'xy',
      intersect: false,
    },
  };

  if (!chartData) {
    return (
      <div className="w-full h-full min-h-[350px]">
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
            <span>{t('stacked.noData')}</span>
          </div>
        </div>
    );
  }

  const typeLabel =
    selectedType === 'all'
      ? tCommon('allMediaTypes')
      : selectedType === 'vn'
        ? 'Visual Novel'
        : selectedType === 'game'
          ? 'Video Game'
          : selectedType.charAt(0).toUpperCase() + selectedType.slice(1);

  const timeframeLabel =
    timeframe === 'today'
      ? `Hourly ${metric === 'xp' ? 'XP' : 'Time'} - Today`
      : timeframe === 'week'
        ? `Daily ${metric === 'xp' ? 'XP' : 'Time'} - This Week`
        : timeframe === 'month'
          ? `Daily ${metric === 'xp' ? 'XP' : 'Time'} - Current Month`
          : timeframe === 'year'
            ? `${metric === 'xp' ? 'XP' : 'Time'} Over the Year`
            : `Total ${metric === 'xp' ? 'XP' : 'Time'} Over Time`;

  return (
    <div className="w-full h-full">
      <div className="h-full w-full">
        {showTitle && (
          <div className="flex items-center justify-between mb-6 px-4">
            <div>
              <h2 className="text-2xl font-bold text-primary mb-2">
                {t('stacked.activity')}
              </h2>
              <p className="text-sm text-base-content mb-4">
                {typeLabel} - {timeframeLabel}
              </p>
            </div>
          </div>
        )}

        <div className="w-full h-full min-h-[350px]">
          <Bar data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
};

export default StackedBarChart;
