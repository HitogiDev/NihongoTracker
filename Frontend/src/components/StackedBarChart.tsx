import React, { useMemo, useState, useEffect } from 'react';
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
}

const typeColors: { [key: string]: string } = {
  reading: 'rgba(255, 99, 132, 1)',
  anime: 'rgba(54, 162, 235, 1)',
  vn: 'rgba(255, 206, 86, 1)',
  video: 'rgba(75, 192, 192, 1)',
  manga: 'rgba(153, 102, 255, 1)',
  audio: 'rgba(255, 159, 64, 1)',
  movie: 'rgba(255, 87, 34, 1)',
  'tv show': 'rgba(76, 175, 80, 1)',
  other: 'rgba(99, 99, 132, 1)',
};

const StackedBarChart: React.FC<StackedBarChartProps> = ({
  statsData,
  selectedType,
  metric,
  timeframe,
}) => {
  const themeColors = useThemeColors(1);
  const [colorsReady, setColorsReady] = useState(false);
  const { timezone } = useTimezone();

  useEffect(() => {
    if (themeColors.baseContent && !themeColors.baseContent.startsWith('#')) {
      setColorsReady(true);
    }
  }, [themeColors.baseContent]);

  const { baseContent, gridColor } = useMemo(() => {
    const base = themeColors.baseContent || 'oklch(0.6 0 0)';

    let baseContent: string;
    let gridColor: string;

    if (base.includes('oklch')) {
      baseContent = base.replace(/\/?\s*[\d.]+\)$/, ' / 0.7)');
      gridColor = base.replace(/\/?\s*[\d.]+\)$/, ' / 0.05)');
    } else {
      baseContent = base.replace(/,?\s*[\d.]+\)$/, ', 0.7)');
      gridColor = base.replace(/,?\s*[\d.]+\)$/, ', 0.05)');
    }

    return { baseContent, gridColor };
  }, [themeColors.baseContent]);

  const chartData = useMemo(() => {
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
            : stat.type.charAt(0).toUpperCase() + stat.type.slice(1),
        data,
        backgroundColor: typeColors[stat.type] || 'rgba(99, 99, 132, 1)',
      };
    });

    // Format labels for display
    const labels = sortedDates.map((dateKey) => {
      switch (timeframe) {
        case 'today': {
          const [year, month, day] = dateKey
            .split('-')
            .map((v) => parseInt(v, 10));
          const displayDate = new Date(
            Date.UTC(year, (month || 1) - 1, day || 1)
          );
          return displayDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        }
        case 'week': {
          const [year, month, day] = dateKey
            .split('-')
            .map((v) => parseInt(v, 10));
          const weekDate = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
          return `Week of ${weekDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}`;
        }
        case 'month': {
          const parts = dateKey.split('-');
          const day = parts[2] ? parseInt(parts[2], 10) : NaN;
          return Number.isFinite(day) ? day.toString() : dateKey;
        }
        case 'year':
          return dateKey;
        default: {
          const [year, month] = dateKey.split('-');
          const displayDate = new Date(
            Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1)
          );
          return displayDate.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });
        }
      }
    });

    return {
      labels,
      datasets,
    };
  }, [statsData, selectedType, metric, timeframe, timezone]);

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: selectedType === 'all',
        position: 'top',
        labels: {
          color: baseContent || 'oklch(0.6 0 0)',
          font: {
            size: 12,
          },
          boxWidth: 15,
          boxHeight: 15,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: themeColors.base100 || '#fff',
        titleColor: baseContent || 'oklch(0.6 0 0)',
        bodyColor: baseContent || 'oklch(0.6 0 0)',
        borderColor: gridColor || 'oklch(0.6 0 0 / 0.1)',
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
          color: gridColor || 'oklch(0.6 0 0 / 0.05)',
        },
        ticks: {
          color: baseContent || 'oklch(0.6 0 0)',
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: gridColor || 'oklch(0.6 0 0 / 0.05)',
        },
        ticks: {
          color: baseContent || 'oklch(0.6 0 0)',
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
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  // Don't render until colors are loaded to prevent flash
  if (!colorsReady) {
    return (
      <div className="flex items-center justify-center h-full min-h-[350px]">
        <div className="text-center">
          <span className="loading loading-spinner text-primary" />
        </div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full text-base-content/60">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>No data available for the selected timeframe</p>
          <p className="text-sm mt-1">
            Try selecting a different time range or media type
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="h-full w-full">
        <div className="flex items-center justify-between mb-6 px-4">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              Progress Timeline
            </h2>
            <p className="text-sm text-base-content mb-4">
              {selectedType === 'all'
                ? 'All Media Types'
                : selectedType.charAt(0).toUpperCase() +
                  selectedType.slice(1)}{' '}
              - {metric === 'xp' ? 'XP' : 'Hours'} Progress Over Time
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-base-content/30 mx-4">
          <div className="bg-base-50 p-4" style={{ height: '350px' }}>
            <Bar data={chartData} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StackedBarChart;
