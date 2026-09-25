import { useMemo, useState } from 'react';
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
import zoomPlugin from 'chartjs-plugin-zoom';
import { useTranslation } from 'react-i18next';
import { getMediaTypeColor } from '../constants/mediaColors';
import { useThemeColors } from '../hooks/useThemeColors';
import { getLogTypeLabelKey } from '../utils/logTypes';
import { numberWithCommas } from '../utils/utils';

ChartJS.register(LinearScale, PointElement, Title, Tooltip, Legend, zoomPlugin);

interface DifficultySpeedPoint {
  date: Date;
  type: string;
  mediaId?: string;
  mediaTitle?: string;
  difficulty: number;
  charsPerHour: number;
}

interface DifficultySpeedChartProps {
  data?: DifficultySpeedPoint[];
}

interface ScatterPoint {
  x: number;
  y: number;
  type: string;
  mediaTitle: string;
  logCount: number;
}

type ViewMode = 'log' | 'media';

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
  const [viewMode, setViewMode] = useState<ViewMode>('log');
  const themeColors = useThemeColors(1);
  const gridColors = useThemeColors(0.16);

  const points = useMemo<ScatterPoint[]>(() => {
    if (viewMode === 'log') {
      return data.map((entry) => ({
        x: entry.difficulty,
        y: entry.charsPerHour,
        type: entry.type,
        mediaTitle: entry.mediaTitle || t('charts.unknownMedia'),
        logCount: 1,
      }));
    }

    const mediaGroups = new Map<
      string,
      {
        difficulty: number;
        type: string;
        mediaTitle: string;
        totalSpeed: number;
        count: number;
      }
    >();

    data.forEach((entry) => {
      const mediaTitle = entry.mediaTitle || t('charts.unknownMedia');
      const groupKey = `${entry.mediaId || mediaTitle}:${entry.type}:${entry.difficulty}`;
      const current = mediaGroups.get(groupKey);

      if (current) {
        current.totalSpeed += entry.charsPerHour;
        current.count += 1;
      } else {
        mediaGroups.set(groupKey, {
          difficulty: entry.difficulty,
          type: entry.type,
          mediaTitle,
          totalSpeed: entry.charsPerHour,
          count: 1,
        });
      }
    });

    return Array.from(mediaGroups.values()).map((group) => ({
      x: group.difficulty,
      y: group.totalSpeed / group.count,
      type: group.type,
      mediaTitle: group.mediaTitle,
      logCount: group.count,
    }));
  }, [data, t, viewMode]);

  const chartData = useMemo<ChartData<'scatter', ScatterPoint[]>>(() => {
    const datasets = READING_TYPES.map((type) => {
      const color = getMediaTypeColor(type);
      const labelKey = getLogTypeLabelKey(type);

      return {
        label: labelKey ? tCommon(labelKey) : type,
        data: points.filter((point) => point.type === type),
        backgroundColor: color,
        borderColor: color,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderWidth: 1,
        pointHitRadius: 12,
      };
    }).filter((dataset) => dataset.data.length > 0);

    return { datasets };
  }, [points, tCommon]);

  const chartOptions = useMemo<ChartOptions<'scatter'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
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
              const logCount =
                viewMode === 'media' && point.logCount > 1
                  ? ` (${t('charts.tooltipLogCount', { count: point.logCount })})`
                  : '';
              return `${t('charts.tooltipMedia', { value: point.mediaTitle })}${logCount}: ${t('charts.tooltipDifficulty', {
                value: point.x.toFixed(1),
              })}, ${t('charts.tooltipSpeed', {
                value: numberWithCommas(Math.round(point.y)),
              })}`;
            },
          },
        },
        zoom: {
          limits: {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 'original' },
          },
          pan: { enabled: true, mode: 'xy' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'xy',
            onZoomComplete: ({ chart }) => {
              chart.update('none');
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
            precision: 0,
            callback: (value) => `${Math.round(Number(value))}%`,
          },
          grid: { color: gridColors.baseContent },
        },
        y: {
          min: 0,
          beginAtZero: true,
          title: {
            display: true,
            text: t('charts.readingSpeedAxis'),
            color: themeColors.baseContent,
          },
          ticks: {
            color: themeColors.baseContent,
            callback: (value) => numberWithCommas(Math.round(Number(value))),
          },
          grid: { color: gridColors.baseContent },
        },
      },
    }),
    [gridColors.baseContent, t, themeColors.baseContent, viewMode]
  );

  if (data.length === 0) {
    return <div className="alert alert-info">{t('speed.empty')}</div>;
  }

  return (
    <div className="w-full h-full min-h-[350px]">
      <div className="join mb-4">
        <button
          className={`join-item btn btn-sm ${
            viewMode === 'log' ? 'btn-primary' : ''
          }`}
          onClick={() => setViewMode('log')}
          aria-pressed={viewMode === 'log'}
        >
          {t('charts.byLog')}
        </button>
        <button
          className={`join-item btn btn-sm ${
            viewMode === 'media' ? 'btn-primary' : ''
          }`}
          onClick={() => setViewMode('media')}
          aria-pressed={viewMode === 'media'}
        >
          {t('charts.byMediaAverage')}
        </button>
      </div>
      <div className="h-[calc(100%-3rem)] min-h-[300px]">
        <Scatter data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
