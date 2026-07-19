import { useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import {
  getRankingSummaryFn,
  getRankingHistoryFn,
  getUserAchievementsFn,
  getUserLogsFn,
} from '../api/trackerApi';
import { ILog } from '../types';

interface ProfileStatsBandProps {
  username: string;
}

// Same colors as StackedBarChart so a type always looks the same across the app
const TYPE_META: Array<{ type: ILog['type']; label: string; color: string }> = [
  { type: 'anime', label: 'Anime', color: '#26b2f2' },
  { type: 'manga', label: 'Manga', color: '#ee4466' },
  { type: 'reading', label: 'Reading', color: '#b34ce6' },
  { type: 'vn', label: 'VN', color: '#3a70e4' },
  { type: 'game', label: 'Game', color: '#59c94e' },
  { type: 'video', label: 'Video', color: '#2cc9a4' },
  { type: 'movie', label: 'Movie', color: '#f77118' },
  { type: 'tv show', label: 'TV', color: '#f8b420' },
  { type: 'audio', label: 'Audio', color: '#f2a15a' },
  { type: 'other', label: 'Other', color: '#10b785' },
];

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
  const location = useLocation();
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SECTION_COLLAPSE_KEY) === '1';
  });
  const [rankMode, setRankMode] = useState<RankMode>(() => {
    if (typeof window === 'undefined') return 'monthly';
    return window.localStorage.getItem(RANK_MODE_KEY) === 'global'
      ? 'global'
      : 'monthly';
  });

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

  const { typeCounts, totalMinutes, totalXp } = useMemo(() => {
    const typeCounts = new Map<string, number>();
    let totalMinutes = 0;
    let totalXp = 0;

    for (const log of logs ?? []) {
      typeCounts.set(log.type, (typeCounts.get(log.type) ?? 0) + 1);
      totalMinutes += Math.max(0, Number(log.time) || 0);
      totalXp += Math.max(0, Number(log.xp) || 0);
    }

    return { typeCounts, totalMinutes, totalXp };
  }, [logs]);

  const earnedAchievements =
    achievements?.filter((a) => a.isEarned).length ?? 0;

  const visibleTypes = TYPE_META.filter(
    (meta) => (typeCounts.get(meta.type) ?? 0) > 0
  );

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
    ? new Date(hoverPoint.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const compactGlobal = rankingSummary?.position
    ? `#${rankingSummary.position.toLocaleString()}`
    : '—';
  const compactMonthly = rankingSummary?.monthly?.position
    ? `#${rankingSummary.monthly.position.toLocaleString()}`
    : '—';

  return (
    <div className="w-full bg-base-100 border-b border-base-300">
      <div className="px-5 2xl:max-w-(--breakpoint-2xl) 2xl:px-24 mx-auto w-full py-3 flex flex-col gap-3">
        {/* Header row — always visible, toggles the whole section */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-base-content/60 hover:text-base-content transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
            Profile Stats
          </button>
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
        </div>

        {!collapsed && (
          <>
            {/* Rankings */}
            <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  Global Ranking
                </div>
                <div className="text-3xl font-bold leading-tight">
                  {compactGlobal}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-base-content/60">
                  Monthly Ranking
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
                    Ranking over time
                  </span>
                  <div className="join">
                    <button
                      type="button"
                      onClick={() => selectRankMode('monthly')}
                      className={`btn btn-xs join-item ${
                        rankMode === 'monthly' ? 'btn-primary' : 'btn-ghost'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => selectRankMode('global')}
                      className={`btn btn-xs join-item ${
                        rankMode === 'global' ? 'btn-primary' : 'btn-ghost'
                      }`}
                    >
                      Global
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
                        className="absolute -top-1 -translate-y-full bg-base-300 text-base-content text-xs rounded px-2 py-1 shadow pointer-events-none whitespace-nowrap z-10"
                        style={{
                          left: `${(hoverIndex / (positions.length - 1)) * 100}%`,
                          transform: `translate(${hoverIndex > positions.length / 2 ? '-100%' : '0'}, -100%)`,
                        }}
                      >
                        {hoverDate}: #{hoverPos.toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-14 flex items-center text-xs text-base-content/50">
                    Not enough ranking history yet.
                  </div>
                )}
              </div>
            )}

            {/* Totals + per-type counts */}
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Achievements
                  </div>
                  <div className="text-lg font-semibold leading-tight">
                    {earnedAchievements.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Total XP
                  </div>
                  <div className="text-lg font-semibold leading-tight">
                    {totalXp.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-base-content/60">
                    Total Immersion Time
                  </div>
                  <div className="text-lg font-semibold leading-tight">
                    {formatTotalTime(totalMinutes)}
                  </div>
                </div>
              </div>

              {visibleTypes.length > 0 && (
                <div className="flex flex-wrap items-end gap-3">
                  {visibleTypes.map((meta) => (
                    <div
                      key={meta.type}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <span
                        className="rounded-full px-3 py-0.5 text-xs font-bold uppercase text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-sm font-semibold">
                        {(typeCounts.get(meta.type) ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
