import { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useTranslation } from 'react-i18next';
import { getMediaTypeColor } from '../constants/mediaColors';
import { useThemeColors } from '../hooks/useThemeColors';
import { getLogTypeLabelKey } from '../utils/logTypes';
import { numberWithCommas } from '../utils/utils';

ChartJS.register(LinearScale, PointElement, Title, Tooltip, Legend);

interface DifficultySpeedPoint {
  date: Date;
  type: string;
  difficulty: number;
  charsPerHour: number;
}

interface DifficultySpeedChartProps {
  data?: DifficultySpeedPoint[];
}

interface ScatterPoint {
  x: number;
  y: number;
}

const READING_TYPES = [
  'light-novel',
  'reading',
  'manga',
  'vn',
  'game',
  'book',
];

export default function DifficultySpeedChart({
  data = [],
}: DifficultySpeedChartProps) {
  const { t } = useTranslation('stats');
  const { t: tCommon } = useTranslation('common');
  const themeColors = useThemeColors(1);
  const gridColors = useThemeColors(0.16);

  const chartData = useMemo<ChartData<'scatter', ScatterPoint[]>>(() => {
    const datasets = READING_TYPES.map((type) => {
      const color = getMediaTypeColor(type);
      const labelKey = getLogTypeLabelKey(type);

      return {
        label: labelKey ? tCommon(labelKey) : type,
        data: data
          .filter((entry) => entry.type === type)
          .map((entry) => ({
            x: entry.difficulty,
            y: entry.charsPerHour,
          })),
        backgroundColor: color,
        borderColor: color,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 1,
        pointHitRadius: 12,
      };
    }).filter((dataset) => dataset.data.length > 0);

    return { datasets };
  }, [data, tCommon]);

  const chartOptions = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: themeColors.baseContent,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw as ScatterPoint;
              return `${context.dataset.label}: ${t('charts.tooltipDifficulty', {
                value: point.x.toFixed(1),
              })}, ${t('charts.tooltipSpeed', {
                value: numberWithCommas(Math.round(point.y)),
              })}`;
            },
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          title: {
            display: true,
            text: t('charts.difficultyAxis'),
            color: themeColors.baseContent,
          },
          ticks: {
            color: themeColors.baseContent,
            callback: (value) => `${value}%`,
          },
          grid: { color: gridColors.baseContent },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: t('charts.readingSpeedAxis'),
            color: themeColors.baseContent,
          },
          ticks: { color: themeColors.baseContent },
          grid: { color: gridColors.baseContent },
        },
      },
    }),
    [gridColors.baseContent, t, themeColors.baseContent]
  );

  if (data.length === 0) {
    return <div className="alert alert-info">{t('speed.empty')}</div>;
  }

  return (
    <div className="w-full h-full min-h-[350px]">
      <Scatter data={chartData} options={chartOptions} />
    </div>
  );
}
