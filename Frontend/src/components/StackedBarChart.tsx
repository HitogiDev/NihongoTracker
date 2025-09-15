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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

interface StatsByType {
  type: string;
  count: number;
  totalTimeHours: number;
  totalXp: number;
  dates: Array<{
    date: Date;
    xp: number;
    time?: number;
    episodes?: number;
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

    // Group all dates from all types and sort them
    const allDates = new Set<string>();
    filteredData.forEach((stat) => {
      stat.dates.forEach((dateEntry) => {
        const date = new Date(dateEntry.date);
        let dateKey: string;

        // Format based on timeframe
        switch (timeframe) {
          case 'today':
            dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            break;
          case 'week': {
            // Get week start (Monday)
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + 1);
            dateKey = weekStart.toISOString().split('T')[0];
            break;
          }
          case 'month':
          default:
            dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'year':
            dateKey = date.getFullYear().toString();
            break;
        }
        allDates.add(dateKey);
      });
    });

    const sortedDates = Array.from(allDates).sort();

    // Create datasets for each media type
    const datasets = filteredData.map((stat) => {
      const data = sortedDates.map((dateKey) => {
        // Find entries for this date period
        const matchingEntries = stat.dates.filter((dateEntry) => {
          const date = new Date(dateEntry.date);
          let entryDateKey: string;

          switch (timeframe) {
            case 'today':
              entryDateKey = date.toISOString().split('T')[0];
              break;
            case 'week': {
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay() + 1);
              entryDateKey = weekStart.toISOString().split('T')[0];
              break;
            }
            case 'month':
            default:
              entryDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            case 'year':
              entryDateKey = date.getFullYear().toString();
              break;
          }
          return entryDateKey === dateKey;
        });

        // Sum up the values for this period
        if (metric === 'xp') {
          return matchingEntries.reduce((sum, entry) => sum + entry.xp, 0);
        } else {
          return matchingEntries.reduce(
            (sum, entry) => sum + (entry.time || 0),
            0
          );
        }
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
        case 'today':
          return new Date(dateKey).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        case 'week': {
          const weekDate = new Date(dateKey);
          return `Week of ${weekDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}`;
        }
        case 'month':
        default: {
          const [year, month] = dateKey.split('-');
          return new Date(
            parseInt(year),
            parseInt(month) - 1
          ).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });
        }
        case 'year':
          return dateKey;
      }
    });

    return {
      labels,
      datasets,
    };
  }, [statsData, selectedType, metric, timeframe]);

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
              return `${label}: ${value.toLocaleString()} XP`;
            } else {
              return `${label}: ${value} minutes`;
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
              return typeof value === 'number' ? `${value}m` : value;
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
