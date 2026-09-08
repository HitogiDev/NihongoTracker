import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Legend,
  LinearScale,
  Title,
  Tooltip,
  TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useThemeColors } from '../hooks/useThemeColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartProps {
  data: ChartData<'bar', number[]>;
  options?: Partial<ChartOptions<'bar'>>;
}

function BarChart({ data, options }: BarChartProps) {
  const lineColors = useThemeColors(1);
  const fillColors = useThemeColors(0.16);
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: lineColors.baseContent,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value?.toLocaleString() ?? 0}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
        },
        grid: { color: fillColors.baseContent },
        ticks: { color: lineColors.baseContent },
      },
      x: {
        title: {
          display: true,
        },
        grid: { display: false },
        ticks: { color: lineColors.baseContent },
      },
    },
    ...options,
  };

  return <Bar options={defaultOptions} data={data} />;
}

export default BarChart;
