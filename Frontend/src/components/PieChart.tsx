import {
  ArcElement,
  Chart as ChartJS,
  ChartData,
  Legend,
  Tooltip,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

type PieValueFormat = 'default' | 'hours' | 'xp' | 'logs';

function formatHoursMinutes(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${minutes}m`;
}

function PieChart({
  data,
  valueFormat = 'default',
}: {
  data: ChartData<'pie', number[]>;
  valueFormat?: PieValueFormat;
}) {
  return (
    <Pie
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value =
                  typeof context.parsed === 'number' ? context.parsed : 0;

                if (valueFormat === 'hours') {
                  return `${label} ${formatHoursMinutes(value)}`;
                }

                if (valueFormat === 'xp') {
                  return `${label} ${value} XP`;
                }

                if (valueFormat === 'logs') {
                  return `${label} ${value} ${value === 1 ? 'log' : 'logs'}`;
                }

                return `${label} ${value}`;
              },
            },
          },
        },
      }}
      data={data}
    />
  );
}

export default PieChart;
