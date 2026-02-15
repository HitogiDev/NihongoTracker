import { Line } from 'react-chartjs-2';

import {
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  Point,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { useThemeColors } from '../hooks/useThemeColors';
import { useState, useEffect } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

function LineChart({
  data,
}: {
  data: ChartData<'line', (number | Point | null)[]>;
}) {
  const themeColors = useThemeColors(1); // Get full opacity colors
  const [colorsReady, setColorsReady] = useState(false);

  // Wait for theme colors to load properly (not default fallbacks)
  useEffect(() => {
    if (themeColors.baseContent && !themeColors.baseContent.startsWith('#')) {
      setColorsReady(true);
    }
  }, [themeColors.baseContent]);

  // Create different opacity versions from the same base colors with fallbacks
  const { baseContent, gridColor } = (() => {
    const base = themeColors.baseContent || 'oklch(0.6 0 0)'; // Fallback to neutral gray

    // Handle both oklch and other color formats
    let baseContent: string;
    let gridColor: string;

    if (base.includes('oklch')) {
      baseContent = base.replace(/\/?\s*[\d.]+\)$/, ' / 0.7)');
      gridColor = base.replace(/\/?\s*[\d.]+\)$/, ' / 0.05)');
    } else {
      // Fallback for other color formats
      baseContent = base.replace(/,?\s*[\d.]+\)$/, ', 0.7)');
      gridColor = base.replace(/,?\s*[\d.]+\)$/, ', 0.05)');
    }

    return { baseContent, gridColor };
  })();

  // Don't render until colors are loaded to prevent flash
  if (!colorsReady) {
    return (
      <div
        className="bg-base-50 p-4 flex items-center justify-center mx-4"
        style={{ height: '350px' }}
      >
        <span className="loading loading-spinner text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-base-content/30 mx-4">
      <div className="bg-base-50 p-4" style={{ height: '350px' }}>
        {data ? (
          <Line
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false, axis: 'xy' },
              plugins: {
                legend: {
                  position: 'right',
                  labels: {
                    color: baseContent || 'oklch(0.6 0 0)',
                    font: {
                      size: 12,
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
                  title: {
                    display: true,
                    color: baseContent || 'oklch(0.6 0 0)',
                  },
                  grid: {
                    color: gridColor || 'oklch(0.6 0 0 / 0.05)',
                  },
                  ticks: {
                    color: baseContent || 'oklch(0.6 0 0)',
                  },
                },
                y: {
                  grid: {
                    color: gridColor || 'oklch(0.6 0 0 / 0.05)',
                  },
                  ticks: {
                    color: baseContent || 'oklch(0.6 0 0)',
                  },
                },
              },
            }}
            data={data}
          />
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
  );
}

export default LineChart;
