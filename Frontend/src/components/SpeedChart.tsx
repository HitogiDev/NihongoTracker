import { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartArea,
  ScriptableContext,
} from 'chart.js';
import { ILog } from '../types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type TimeframeType = 'total' | 'today' | 'week' | 'month' | 'year';
type ReadingType = 'reading' | 'vn' | 'manga';

// Updated to include the readingSpeedData format from IUserStats
interface SpeedChartProps {
  timeframe?: TimeframeType;
  readingData?: ILog[];
  readingSpeedData?: Array<{
    date: Date;
    type: string;
    time: number;
    chars?: number;
    pages?: number;
    charsPerHour?: number | null;
  }>;
}

// Define specific types instead of using 'any'
interface ReadingDataItem {
  date: string;
  speed: number;
}

type FilteredData = {
  [type in ReadingType]?: ReadingDataItem[];
};

function SpeedChart({
  timeframe: externalTimeframe,
  readingData,
  readingSpeedData,
}: SpeedChartProps) {
  // Use state to manage the timeframe
  const [timeframe, setTimeframe] = useState<TimeframeType>('total');
  const [filteredData, setFilteredData] = useState<FilteredData>({});
  const readingTypes = useMemo<ReadingType[]>(
    () => ['reading', 'vn', 'manga'],
    []
  );

  useEffect(() => {
    if (externalTimeframe) {
      setTimeframe(externalTimeframe);
    }
  }, [externalTimeframe]);

  useEffect(() => {
    const now = new Date();
    const filtered: FilteredData = {};

    // Initialize empty arrays for each reading type
    readingTypes.forEach((type) => {
      filtered[type] = [];
    });

    // If readingSpeedData is provided, use it (already pre-processed)
    if (readingSpeedData && readingSpeedData.length > 0) {
      readingSpeedData.forEach((item) => {
        // Only process data for the reading types we're interested in
        if (!readingTypes.includes(item.type as ReadingType)) return;

        // Format date string
        const itemDate = new Date(item.date);
        // Format date as YYYY-MM-DD for consistent comparison
        const dateStr = itemDate.toISOString().split('T')[0];
        // For year and total views, use YYYY-MM format for grouping by month
        const monthStr = `${itemDate.getFullYear()}-${String(
          itemDate.getMonth() + 1
        ).padStart(2, '0')}`;

        // Filter based on timeframe
        let include = false;
        switch (timeframe) {
          case 'today':
            include = itemDate.toDateString() === now.toDateString();
            break;
          case 'week': {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            include = itemDate >= startOfWeek;
            break;
          }
          case 'month':
            include =
              itemDate.getMonth() === now.getMonth() &&
              itemDate.getFullYear() === now.getFullYear();
            break;
          case 'year':
            include = itemDate.getFullYear() === now.getFullYear();
            break;
          case 'total':
            include = true;
            break;
        }

        if (include) {
          const type = item.type as ReadingType;
          // Use charsPerHour if available, otherwise calculate speed
          let speed = item.charsPerHour || 0;
          if (!speed && item.chars && item.time) {
            // Calculate characters per hour (time is in seconds)
            speed = item.chars / (item.time / 3600);
          }

          filtered[type]?.push({
            date:
              timeframe === 'year' || timeframe === 'total'
                ? monthStr
                : dateStr,
            speed: Math.round(speed),
          });
        }
      });
    }
    // If readingData is provided, process logs and calculate reading speed
    else if (readingData && readingData.length > 0) {
      readingData.forEach((log) => {
        // Only process logs that have the types we're interested in
        if (!readingTypes.includes(log.type as ReadingType)) return;

        // Skip if no characters or time data
        if (!log.chars || !log.time || log.time <= 0) return;

        // Calculate reading speed (chars per hour)
        const speed = (log.chars / (log.time / 60)) * 60; // Convert chars per minute to chars per hour

        // Format date as YYYY-MM-DD for consistent comparison
        const logDate = new Date(log.date);
        const dateStr = logDate.toISOString().split('T')[0];

        // For year and total views, we'll use YYYY-MM format for grouping by month
        const monthStr = `${logDate.getFullYear()}-${String(
          logDate.getMonth() + 1
        ).padStart(2, '0')}`;

        // Filter based on timeframe
        let include = false;
        switch (timeframe) {
          case 'today':
            include = logDate.toDateString() === now.toDateString();
            break;
          case 'week': {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            include = logDate >= startOfWeek;
            break;
          }
          case 'month':
            include =
              logDate.getMonth() === now.getMonth() &&
              logDate.getFullYear() === now.getFullYear();
            break;
          case 'year':
            include = logDate.getFullYear() === now.getFullYear();
            break;
          case 'total':
            include = true;
            break;
        }

        if (include) {
          const type = log.type as ReadingType;
          filtered[type]?.push({
            date:
              timeframe === 'year' || timeframe === 'total'
                ? monthStr
                : dateStr,
            speed: Math.round(speed),
          });
        }
      });
    }

    // Group by date/month and calculate average speed
    readingTypes.forEach((type) => {
      const dateMap = new Map<string, { total: number; count: number }>();

      filtered[type]?.forEach((item) => {
        if (!dateMap.has(item.date)) {
          dateMap.set(item.date, { total: item.speed, count: 1 });
        } else {
          const current = dateMap.get(item.date)!;
          dateMap.set(item.date, {
            total: current.total + item.speed,
            count: current.count + 1,
          });
        }
      });

      // Convert map to array of averaging speeds
      filtered[type] = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          speed: Math.round(data.total / data.count),
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    });

    setFilteredData(filtered);
  }, [timeframe, readingData, readingSpeedData, readingTypes]);

  // Get all unique dates across all reading types
  const getAllDates = () => {
    const allDatesSet = new Set<string>();

    readingTypes.forEach((type) => {
      if (filteredData[type]) {
        filteredData[type]?.forEach((item) => {
          allDatesSet.add(item.date);
        });
      }
    });

    const sortedDates = Array.from(allDatesSet).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    // Format dates for display when viewing monthly data
    if (timeframe === 'total' || timeframe === 'year') {
      return sortedDates.map((dateStr) => {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
        }).format(date);
      });
    }

    return sortedDates;
  };

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

  const chartData = {
    labels: getAllDates(),
    datasets: readingTypes.map((type, index) => {
      const colors = [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
      ];

      return {
        label:
          type === 'vn'
            ? 'Visual Novel'
            : type.charAt(0).toUpperCase() + type.slice(1),
        data: (() => {
          // Create a map of dates to speeds with null gaps filled in
          const allDates = getAllDates();
          const result = [];
          let lastValidValue = null;

          for (const date of allDates) {
            // For year and total views, we need to match the month format
            let entry;
            if (timeframe === 'total' || timeframe === 'year') {
              // Find the entry by comparing the formatted month strings
              const monthYear = date; // Already formatted by getAllDates
              entry = filteredData[type]?.find((item) => {
                const [year, month] = item.date.split('-');
                const itemDate = new Date(parseInt(year), parseInt(month) - 1);
                return (
                  new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'short',
                  }).format(itemDate) === monthYear
                );
              });
            } else {
              entry = filteredData[type]?.find((item) => item.date === date);
            }

            const currentValue = entry ? entry.speed : null;

            // If we have a current value, use it and update lastValidValue
            if (currentValue !== null) {
              result.push(currentValue);
              lastValidValue = currentValue;
            }
            // Otherwise use the last valid value if we have one
            else if (lastValidValue !== null) {
              result.push(lastValidValue);
            }
            // If we don't have a last valid value, use 0 instead of null
            else {
              result.push(0);
            }
          }

          return result;
        })(),
        borderColor: colors[index % colors.length],
        backgroundColor: function (context: ScriptableContext<'line'>) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return undefined;
          return createGradient(ctx, chartArea, colors[index % colors.length]);
        },
        fill: true,
        pointRadius: 3,
        borderWidth: 2,
        tension: 0.1,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Reading Speed (${timeframe})`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Characters per hour',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
    },
  };

  return (
    <div className="w-full h-full">
      {!externalTimeframe && (
        <div className="join mb-4">
          <button
            className={`btn join-item ${
              timeframe === 'today' ? 'btn-primary' : ''
            }`}
            onClick={() => setTimeframe('today')}
          >
            Today
          </button>
          <button
            className={`btn join-item ${
              timeframe === 'week' ? 'btn-primary' : ''
            }`}
            onClick={() => setTimeframe('week')}
          >
            This Week
          </button>
          <button
            className={`btn join-item ${
              timeframe === 'month' ? 'btn-primary' : ''
            }`}
            onClick={() => setTimeframe('month')}
          >
            This Month
          </button>
          <button
            className={`btn join-item ${
              timeframe === 'year' ? 'btn-primary' : ''
            }`}
            onClick={() => setTimeframe('year')}
          >
            This Year
          </button>
          <button
            className={`btn join-item ${
              timeframe === 'total' ? 'btn-primary' : ''
            }`}
            onClick={() => setTimeframe('total')}
          >
            All Time
          </button>
        </div>
      )}
      {Object.values(filteredData).some((data) => data && data.length > 0) ? (
        <div className="w-full h-full">
          <Line data={chartData} options={options} />
        </div>
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
  );
}

export default SpeedChart;
