import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { ITextSessionIntelligence } from '../../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Props = {
  intelligence: ITextSessionIntelligence;
};

function SessionIntelligenceChart({ intelligence }: Props) {
  const { t } = useTranslation('texthooker');
  const lineColors = useThemeColors(1);
  const fillColors = useThemeColors(0.16);
  const chartData = {
    labels: intelligence.charactersPerMinute.map((_characters, index) =>
      t('hooker.intelligence.minuteLabel', { minute: index + 1 })
    ),
    datasets: [
      {
        label: t('hooker.intelligence.charactersPerMinute'),
        data: intelligence.charactersPerMinute,
        borderColor: lineColors.primary,
        backgroundColor: fillColors.primary,
        pointBackgroundColor: intelligence.charactersPerMinute.map(
          (_characters, index) => {
            const second = index * 60;
            const period = intelligence.periods.find(
              (candidate) =>
                second < candidate.endSecond &&
                second + 60 > candidate.startSecond
            );
            if (period?.type === 'afk') return lineColors.baseContent;
            if (period?.type === 'distracted') return lineColors.warning;
            return lineColors.primary;
          }
        ),
        pointRadius: 3,
        pointHoverRadius: 4,
        pointBorderWidth: 0,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: lineColors.baseContent,
              maxTicksLimit: 10,
            },
          },
          y: {
            beginAtZero: true,
            ticks: { color: lineColors.baseContent, precision: 0 },
            grid: { color: fillColors.baseContent },
          },
        },
      }}
    />
  );
}

export default SessionIntelligenceChart;
