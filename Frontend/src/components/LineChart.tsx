import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');
  const lineColors = useThemeColors(1);
  const fillColors = useThemeColors(0.16);

  return (
    <div className="w-full h-full min-h-[350px]">
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
                  color: lineColors.baseContent,
                  font: { size: 12 },
                },
              },
              zoom: {
                pan: { enabled: true, mode: 'x' },
                zoom: {
                  wheel: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x',
                  onZoomComplete: ({ chart }) => {
                    chart.update('none');
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, color: lineColors.baseContent },
                grid: { display: false },
                ticks: { color: lineColors.baseContent, maxTicksLimit: 10 },
              },
              y: {
                grid: { color: fillColors.baseContent },
                ticks: { color: lineColors.baseContent },
              },
            },
            elements: {
              line: { tension: 0.3, borderWidth: 2 },
              point: { radius: 3, hoverRadius: 4 },
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
              d="M13 16h-1v-4h-1m1-4h-.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{t('charts.noData')}</span>
        </div>
      )}
    </div>
  );
}

export default LineChart;
