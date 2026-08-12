import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Share2 } from 'lucide-react';
import {
  getRankingSummaryFn,
  getRankingHistoryFn,
  getUserAchievementsFn,
  getUserLogsFn,
} from '../api/trackerApi';
import ShareStatsModal from './ShareStatsModal';

interface ProfileStatsBandProps {
  username: string;
}

// Fritsch–Carlson monotone cubic interpolation → SVG path, matching the
// `cubicInterpolationMode: 'monotone'` curve the Chart.js stats charts use.
function monotonePath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`;

  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    slope[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slope[0];
  tangents[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] =
      slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  // Enforce monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slope[i];
    const b = tangents[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      tangents[i] = t * a * slope[i];
      tangents[i + 1] = t * b * slope[i];
    }
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const x1 = pts[i].x + dx[i] / 3;
    const y1 = pts[i].y + (tangents[i] * dx[i]) / 3;
    const x2 = pts[i + 1].x - dx[i] / 3;
    const y2 = pts[i + 1].y - (tangents[i + 1] * dx[i]) / 3;
    d += ` C ${x1} ${y1}, ${x2} ${y2}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

const SECTION_COLLAPSE_KEY = 'profileStatsBand.collapsed';
const RANK_MODE_KEY = 'profileStatsBand.rankMode';
type RankMode = 'monthly' | 'global';

function formatTotalTime(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function ProfileStatsBand({ username }: ProfileStatsBandProps) {
  const { t } = useTranslation('profile');
  const { formatNumber, formatDate } = useDateFormatting();
  const location = useLocation();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    // Collapsed by default — only expanded if the user explicitly opened it before.
    return window.localStorage.getItem(SECTION_COLLAPSE_KEY) !== '0';
  });
  const [rankMode, setRankMode] = useState<RankMode>(() => {
    if (typeof window === 'undefined') return 'monthly';
    return window.localStorage.getItem(RANK_MODE_KEY) === 'global'
      ? 'global'
      : 'monthly';
  });

  const [shareOpen, setShareOpen] = useState(false);

  // Graph shows only on the overview tab (the index route: /user/:username)
  const isOverview =
    location.pathname.replace(/\/$/, '') === `/user/${username}`;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SECTION_COLLAPSE_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  const selectRankMode = (mode: RankMode) => {
    setRankMode(mode);
    setHoverIndex(null);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RANK_MODE_KEY, mode);
    }
  };

  // Shares the query key (and therefore the cached response) with ImmersionHeatmap
  const { data: logs } = useQuery({
    queryKey: ['heatmap-logs', username],
    queryFn: () => getUserLogsFn(username, { limit: 0 }),
    enabled: !!username,
  });

  const { data: rankingSummary } = useQuery({
    queryKey: ['rankingSummary', username],
    queryFn: () => getRankingSummaryFn(username),
    staleTime: 1000 * 60 * 5,
    enabled: !!username,
  });

  const { data: rankingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['rankingHistory', username],
    queryFn: () => getRankingHistoryFn(username),
    staleTime: 1000 * 60 * 5,
    enabled: !!username && isOverview,
  });

  // Shares the query key with AchievementShowcaseWidget on the profile page
  const { data: achievements } = useQuery({
    queryKey: ['userAchievements', username],
    queryFn: () => getUserAchievementsFn(username),
    staleTime: 5 * 60 * 1000,
    enabled: !!username,
  });

  const { totalMinutes, totalXp } = useMemo(() => {
    let totalMinutes = 0;
    let totalXp = 0;

    for (const log of logs ?? []) {
      totalMinutes += Math.max(0, Number(log.time) || 0);
      totalXp += Math.max(0, Number(log.xp) || 0);
    }

    return { totalMinutes, totalXp };
  }, [logs]);

  const earnedAchievements =
    achievements?.filter((a) => a.isEarned).length ?? 0;

  // ── Ranking-position graph geometry ──────────────────────────────────────
  const chartWidth = 300;
  const chartHeight = 56;
  const padY = 6;
  // Monthly view shows only the current calendar month; global spans all history.
  const history = useMemo(() => {
    const all = rankingHistory ?? [];
    if (rankMode !== 'monthly') return all;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return all.filter((h) => {
      const d = new Date(h.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [rankingHistory, rankMode]);

  const positions = history.map((h) =>
    rankMode === 'global' ? h.globalPosition : h.monthlyPosition
  );
  const minPos = positions.length ? Math.min(...positions) : 0;
  const maxPos = positions.length ? Math.max(...positions) : 0;
  const posRange = Math.max(1, maxPos - minPos);
  // Rank 1 (best) at the top: smaller position → smaller y
  const points = positions.map((pos, index) => {
    const x =
      positions.length > 1
        ? (index / (positions.length - 1)) * chartWidth
        : chartWidth / 2;
    const y = padY + ((pos - minPos) / posRange) * (chartHeight - 2 * padY);
    return { x, y };
  });
  const linePath = monotonePath(points);
  const hasHistory = positions.length >= 2;

  const handleChartHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || positions.length < 2) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (positions.length - 1));
    setHoverIndex(Math.min(positions.length - 1, Math.max(0, index)));
  };

  const hoverPoint = hoverIndex !== null ? history[hoverIndex] : null;
  const hoverPos = hoverIndex !== null ? positions[hoverIndex] : null;
  const hoverDate = hoverPoint
    ? formatDate(hoverPoint.date, {
        hour: undefined,
        minute: undefined,
        timeZoneName: undefined,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const compactGlobal = rankingSummary?.position
    ? `#${formatNumber(rankingSummary.position)}`
    : '—';
  const compactMonthly = rankingSummary?.monthly?.position
    ? `#${formatNumber(rankingSummary.monthly.position)}`
    : '—';

  return (
    <div className="card w-full surface">
      <div className="card-body w-full p-4 sm:p-6 flex flex-col gap-3">
        {/* Header row — always visible, toggles the whole section */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="flex items-center gap-1.5 card-title text-base-content/80 hover:text-base-content transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
            {t('stats.title')}
          </button>
          <div className="flex items-center gap-3">
            {collapsed && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-base-content/60">
                  Global{' '}
                  <span className="font-bold text-base-content">
                    {compactGlobal}
                  </span>
                </span>
                <span className="text-base-content/60">
                  Monthly{' '}
                  <span className="font-bold text-base-content">
                    {compactMonthly}
                  </span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="btn btn-ghost btn-xs gap-1.5 text-base-content/70 hover:text-base-content"
              title={t('stats.shareTitle')}
            >
              <Share2 className="w-3.5 h-3.5" />
              {t('stats.share')}
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Rankings */}
            <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('stats.globalRanking')}
                </div>
                <div className="text-3xl font-bold leading-tight">
                  {compactGlobal}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('stats.monthlyRanking')}
                </div>
                <div className="text-3xl font-bold leading-tight">
                  {compactMonthly}
                </div>
              </div>
            </div>

            {/* Ranking-position graph over time. Overview tab only. */}
            {isOverview && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-base-content/60">
                    {t('stats.rankingOverTime')}
                  </span>
                  <div className="join">
                    <button
                      type="button"
                      onClick={() => selectRankMode('monthly')}
                      className={`join-item btn btn-sm ${
                        rankMode === 'monthly' ? 'btn-primary' : 'btn-ghost'
                      }`}
                    >
                      {t('stats.monthly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectRankMode('global')}
                      className={`join-item btn btn-sm ${
                        rankMode === 'global' ? 'btn-primary' : 'btn-ghost'
                      }`}
                    >
                      {t('stats.global')}
                    </button>
                  </div>
                </div>

                {isLoadingHistory ? (
                  <div className="skeleton h-14 w-full" />
                ) : hasHistory ? (
                  <div
                    ref={chartRef}
                    className="relative w-full h-14 text-primary cursor-crosshair"
                    onMouseMove={handleChartHover}
                    onMouseLeave={() => setHoverIndex(null)}
                    aria-label={`${rankMode} ranking position over time`}
                  >
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      preserveAspectRatio="none"
                      className="w-full h-full overflow-visible"
                    >
                      <path
                        d={linePath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {hoverIndex !== null && (
                        <>
                          <line
                            x1={points[hoverIndex].x}
                            y1={0}
                            x2={points[hoverIndex].x}
                            y2={chartHeight}
                            stroke="currentColor"
                            strokeWidth={1}
                            opacity={0.4}
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </svg>
                    {/* HTML marker so it stays a true circle (SVG geometry is
                        stretched by preserveAspectRatio="none") */}
                    {hoverIndex !== null && (
                      <div
                        className="absolute w-2.5 h-2.5 rounded-full bg-primary border-2 border-base-100 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                        style={{
                          left: `${(points[hoverIndex].x / chartWidth) * 100}%`,
                          top: `${(points[hoverIndex].y / chartHeight) * 100}%`,
                        }}
                      />
                    )}
                    {hoverIndex !== null && hoverPos !== null && (
                      <div
                        className="absolute -top-1 -translate-y-full bg-base-300 text-base-content text-xs rounded px-2 py-1 shadow-sm pointer-events-none whitespace-nowrap z-10"
                        style={{
                          left: `${(hoverIndex / (positions.length - 1)) * 100}%`,
                          transform: `translate(${hoverIndex > positions.length / 2 ? '-100%' : '0'}, -100%)`,
                        }}
                      >
                        {t('stats.hoverPosition', {
                          date: hoverDate,
                          position: formatNumber(hoverPos),
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-14 flex items-center text-xs text-base-content/50">
                    {t('stats.noRankingHistory')}
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('stats.achievements')}
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {formatNumber(earnedAchievements)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('stats.totalXp')}
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {formatNumber(totalXp)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  {t('stats.totalTime')}
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {formatTotalTime(totalMinutes)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ShareStatsModal
        username={username}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
