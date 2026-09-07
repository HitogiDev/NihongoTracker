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
import { Activity, Brain, Clock, Gauge, TimerOff } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { ITextSessionHistoryEntry } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';
import Modal from '../ui/Modal';

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
  entry: ITextSessionHistoryEntry | null;
  onClose: () => void;
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

function SessionIntelligenceModal({ entry, onClose }: Props) {
  const { t } = useTranslation('texthooker');
  const lineColors = useThemeColors(1);
  const fillColors = useThemeColors(0.16);
  const intelligence = entry?.intelligence;

  const chartData = intelligence
    ? {
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
            borderWidth: 2,
            fill: true,
            tension: 0.3,
          },
        ],
      }
    : null;

  return (
    <Modal
      open={Boolean(entry)}
      onClose={onClose}
      size="xl"
      title={t('hooker.intelligence.title')}
    >
      {entry && intelligence && (
        <div className="space-y-5">
          <p className="text-sm text-base-content/70">
            {t('hooker.intelligence.estimateNote')}
          </p>

          {intelligence.detectionMode === 'off' ? (
            <div role="alert" className="alert alert-soft alert-info">
              <Brain className="w-5 h-5" />
              <span>{t('hooker.intelligence.attentionDisabled')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="surface-muted p-3">
                <Brain className="w-5 h-5 text-primary mb-2" />
                <div className="text-xs text-base-content/70">
                  {t('hooker.intelligence.focus')}
                </div>
                <div className="text-xl font-bold">
                  {intelligence.focusPercentage}%
                </div>
              </div>
              <div className="surface-muted p-3">
                <Clock className="w-5 h-5 text-success mb-2" />
                <div className="text-xs text-base-content/70">
                  {t('hooker.intelligence.focusedTime')}
                </div>
                <div className="text-xl font-bold">
                  {formatDuration(intelligence.focusedSeconds)}
                </div>
              </div>
              <div className="surface-muted p-3">
                <Activity className="w-5 h-5 text-warning mb-2" />
                <div className="text-xs text-base-content/70">
                  {t('hooker.intelligence.distractedTime')}
                </div>
                <div className="text-xl font-bold">
                  {formatDuration(intelligence.distractedSeconds)}
                </div>
              </div>
              <div className="surface-muted p-3">
                <Activity className="w-5 h-5 text-info mb-2" />
                <div className="text-xs text-base-content/70">
                  {t('hooker.intelligence.distractions')}
                </div>
                <div className="text-xl font-bold">
                  {intelligence.distractionCount}
                </div>
              </div>
              <div className="surface-muted p-3">
                <TimerOff className="w-5 h-5 text-base-content/60 mb-2" />
                <div className="text-xs text-base-content/70">
                  {t('hooker.intelligence.afkExcluded')}
                </div>
                <div className="text-xl font-bold">
                  {formatDuration(intelligence.afkSeconds)}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              [
                t('hooker.intelligence.firstThirty'),
                intelligence.firstThirtyMinutesSpeed,
              ],
              [
                t('hooker.intelligence.lastThirty'),
                intelligence.lastThirtyMinutesSpeed,
              ],
              [
                t('hooker.intelligence.peakSpeed'),
                intelligence.peakReadingSpeed,
              ],
              [
                t('hooker.intelligence.longestDistraction'),
                formatDuration(intelligence.longestDistractionSeconds),
              ],
            ].map(([label, value], index) => (
              <div key={String(label)} className="surface p-3">
                <div className="flex items-center gap-2 text-xs text-base-content/70">
                  {index < 3 && <Gauge className="w-4 h-4" />}
                  {label}
                </div>
                <div className="mt-1 font-semibold">
                  {index < 3
                    ? t('hooker.intelligence.speedValue', { value })
                    : value}
                </div>
              </div>
            ))}
          </div>

          <div className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h4 className="font-semibold">
                {t('hooker.intelligence.charactersPerMinute')}
              </h4>
              <span className="text-xs text-base-content/60">
                {intelligence.detectionMode === 'automatic' &&
                intelligence.baselineIntervalSeconds !== null
                  ? t('hooker.intelligence.autoSummary', {
                      baseline: Math.round(
                        intelligence.baselineIntervalSeconds
                      ),
                      threshold: intelligence.distractionThresholdSeconds,
                    })
                  : t(`hooker.intelligence.mode.${intelligence.detectionMode}`)}
              </span>
            </div>
            <div className="h-64 sm:h-72">
              {chartData && (
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
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-base-content/70">
              <span className="flex items-center gap-1.5">
                <span className="status status-primary" />
                {t('hooker.intelligence.focused')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="status status-warning" />
                {t('hooker.intelligence.distracted')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="status" />
                {t('hooker.intelligence.afk')}
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default SessionIntelligenceModal;
