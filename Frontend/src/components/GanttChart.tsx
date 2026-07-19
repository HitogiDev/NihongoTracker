import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ExternalLink, Clock, Zap, Hash, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { IGanttMediaItem } from '../types';
import { MEDIA_TYPE_COLORS } from '../constants/mediaColors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date): Date {
  const next = startOfLocalDay(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return endOfLocalDay(end);
}

function endOfMonth(date: Date): Date {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfLocalDay(end);
}

function endOfYear(date: Date): Date {
  const end = new Date(date.getFullYear(), 11, 31);
  return endOfLocalDay(end);
}

function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimelineColumn {
  key: string;
  label: string;
  topLabel?: string;
  isMajor: boolean;
}

type TimelineUnit = 'day' | 'month';

type TimeFilter = 'week' | 'month' | 'year' | 'all' | 'custom';

type SortOption =
  | 'title-asc'
  | 'title-desc'
  | 'first-asc'
  | 'last-desc'
  | 'logs-desc'
  | 'time-desc'
  | 'xp-desc';

interface GanttChartProps {
  items: IGanttMediaItem[];
  timeFilter: TimeFilter;
  selectedType: string;
  sortBy: SortOption;
  minLogs: string;
  maxLogs: string;
  customStart: string;
  customEnd: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 52; // px
const LABEL_WIDTH = 220; // px — sticky left column
const MONTH_COL_WIDTH = 52; // px per month column
const DAY_COL_WIDTH = 36; // px per day column
const BAR_HEIGHT = 28; // px
const BAR_RADIUS = 6; // px
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.15;

// How many active-day dots to density-shade a column
const DENSITY_THRESHOLDS = [1, 5, 12, 20]; // days/column → opacity steps

// ─── GanttChart ──────────────────────────────────────────────────────────────

export default function GanttChart({
  items,
  timeFilter,
  selectedType,
  sortBy,
  minLogs,
  maxLogs,
  customStart,
  customEnd,
}: GanttChartProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const tooltipHoverRef = useRef(false);
  const tooltipCloseTimeoutRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, scrollLeft: 0 });
  const [tooltip, setTooltip] = useState<{
    item: IGanttMediaItem;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  }, []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // Ctrl+wheel to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Middle-click or drag to pan
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or space key held
    if (e.button !== 1) return;
    e.preventDefault();
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
    };
    document.body.style.cursor = 'grabbing';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !scrollRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      scrollRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    };
    const onMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        document.body.style.cursor = '';
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const clearTooltipCloseTimeout = useCallback(() => {
    if (tooltipCloseTimeoutRef.current !== null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current);
      tooltipCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleTooltipClose = useCallback(() => {
    clearTooltipCloseTimeout();
    tooltipCloseTimeoutRef.current = window.setTimeout(() => {
      if (!tooltipHoverRef.current) {
        setTooltip(null);
      }
    }, 150);
  }, [clearTooltipCloseTimeout]);

  const allTimeBounds = useMemo(() => {
    if (items.length === 0) {
      return { start: null as Date | null, end: null as Date | null };
    }

    const allDates = items.flatMap((item) => [
      new Date(item.firstLogDate),
      new Date(item.lastLogDate),
    ]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    return {
      start: startOfLocalDay(minDate),
      end: endOfLocalDay(maxDate),
    };
  }, [items]);

  const range = useMemo(() => {
    if (!allTimeBounds.start || !allTimeBounds.end) {
      return { start: null as Date | null, end: null as Date | null };
    }

    const now = new Date();

    if (timeFilter === 'all') {
      return { start: allTimeBounds.start, end: allTimeBounds.end };
    }

    if (timeFilter === 'week') {
      return { start: startOfWeek(now), end: endOfWeek(now) };
    }

    if (timeFilter === 'month') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfMonth(now),
      };
    }

    if (timeFilter === 'year') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endOfYear(now),
      };
    }

    const parsedStart = parseLocalDate(customStart);
    const parsedEnd = parseLocalDate(customEnd);
    const start = parsedStart
      ? startOfLocalDay(parsedStart)
      : allTimeBounds.start;
    const end = parsedEnd ? endOfLocalDay(parsedEnd) : allTimeBounds.end;

    if (start > end) {
      return { start: end, end: start };
    }

    return { start, end };
  }, [allTimeBounds, timeFilter, customStart, customEnd]);

  const rangeStart = range.start;
  const rangeEnd = range.end;
  const rangeStartKey = rangeStart ? toDayKey(rangeStart) : null;
  const rangeEndKey = rangeEnd ? toDayKey(rangeEnd) : null;

  const unit = useMemo<TimelineUnit>(() => {
    if (timeFilter === 'week' || timeFilter === 'month') {
      return 'day';
    }

    if (timeFilter === 'custom') {
      if (!rangeStart || !rangeEnd) return 'month';
      const start = startOfLocalDay(rangeStart).getTime();
      const end = endOfLocalDay(rangeEnd).getTime();
      const days = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
      return days <= 45 ? 'day' : 'month';
    }

    return 'month';
  }, [timeFilter, rangeStart, rangeEnd]);

  const baseColWidth = unit === 'day' ? DAY_COL_WIDTH : MONTH_COL_WIDTH;
  const colWidth = Math.round(baseColWidth * zoom);
  const minBarWidth = colWidth * (unit === 'day' ? 0.8 : 0.5);

  // ── Filter by type, time, and log count ──────────────────────────────────
  const filtered = useMemo(() => {
    const minValue = minLogs ? Number(minLogs) : null;
    const maxValue = maxLogs ? Number(maxLogs) : null;

    let base =
      selectedType === 'all'
        ? items
        : items.filter((item) => item.type === selectedType);

    if (minValue !== null && !Number.isNaN(minValue)) {
      base = base.filter((item) => item.logCount >= minValue);
    }

    if (maxValue !== null && !Number.isNaN(maxValue)) {
      base = base.filter((item) => item.logCount <= maxValue);
    }

    if (rangeStart && rangeEnd) {
      base = base.filter((item) => {
        const start = new Date(item.firstLogDate);
        const end = new Date(item.lastLogDate);
        return end >= rangeStart && start <= rangeEnd;
      });
    }

    const sorted = [...base].sort((a, b) => {
      const aTitle = (a.titleEnglish ?? a.title).toLowerCase();
      const bTitle = (b.titleEnglish ?? b.title).toLowerCase();

      switch (sortBy) {
        case 'title-desc':
          return bTitle.localeCompare(aTitle);
        case 'first-asc':
          return (
            new Date(a.firstLogDate).getTime() -
            new Date(b.firstLogDate).getTime()
          );
        case 'last-desc':
          return (
            new Date(b.lastLogDate).getTime() -
            new Date(a.lastLogDate).getTime()
          );
        case 'logs-desc':
          return b.logCount - a.logCount;
        case 'time-desc':
          return b.totalTime - a.totalTime;
        case 'xp-desc':
          return b.totalXp - a.totalXp;
        case 'title-asc':
        default:
          return aTitle.localeCompare(bTitle);
      }
    });

    return sorted;
  }, [items, selectedType, minLogs, maxLogs, rangeStart, rangeEnd, sortBy]);

  // ── Build timeline columns spanning the full range ───────────────────────
  const { columns } = useMemo((): {
    columns: TimelineColumn[];
    minDate: Date;
    maxDate: Date;
  } => {
    if (filtered.length === 0) {
      const now = new Date();
      return { columns: [], minDate: now, maxDate: now };
    }

    const minBase = rangeStart ?? new Date(filtered[0].firstLogDate);
    const maxBase = rangeEnd ?? new Date(filtered[0].lastLogDate);

    const minD = new Date(minBase);
    const maxD = new Date(maxBase);

    if (unit === 'day') {
      const start = startOfLocalDay(minD);
      const end = endOfLocalDay(maxD);
      const cols: TimelineColumn[] = [];
      const cur = new Date(start);
      let prevMonth = -1;

      while (cur <= end) {
        const isNewMonth = cur.getDate() === 1 || cur.getMonth() !== prevMonth;
        const key = toDayKey(cur);
        const label =
          timeFilter === 'week'
            ? cur.toLocaleDateString('en-US', { weekday: 'short' })
            : String(cur.getDate());
        const topLabel = isNewMonth
          ? cur.toLocaleDateString('en-US', { month: 'short' })
          : undefined;

        cols.push({
          key,
          label,
          topLabel,
          isMajor: isNewMonth,
        });

        prevMonth = cur.getMonth();
        cur.setDate(cur.getDate() + 1);
      }

      return { columns: cols, minDate: start, maxDate: end };
    }

    const padMonths = timeFilter === 'all' ? 1 : 0;

    minD.setDate(1);
    minD.setMonth(minD.getMonth() - padMonths);
    maxD.setDate(1);
    maxD.setMonth(maxD.getMonth() + padMonths);

    const cols: TimelineColumn[] = [];
    const cur = new Date(minD);
    let prevYear = -1;

    while (cur <= maxD) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = cur.toLocaleDateString('en-US', { month: 'short' });
      const isNewYear = y !== prevYear;

      cols.push({
        key,
        label,
        topLabel: isNewYear ? String(y) : undefined,
        isMajor: isNewYear,
      });

      prevYear = y;
      cur.setMonth(m + 1);
    }

    return { columns: cols, minDate: minD, maxDate: maxD };
  }, [filtered, rangeStart, rangeEnd, timeFilter, unit]);

  // Scroll to show the most recent columns by default
  useEffect(() => {
    if (!scrollRef.current || columns.length === 0) return;
    const totalW = columns.length * colWidth;
    const visibleW = scrollRef.current.clientWidth;
    const scrollX = Math.max(0, totalW - visibleW - colWidth * 2);
    scrollRef.current.scrollLeft = scrollX;
  }, [columns, colWidth]);

  // ── Position helpers ─────────────────────────────────────────────────────

  /** Column index (fractional) for a Date within the month grid */
  const dateToColX = (date: Date, edge: 'start' | 'end' = 'start'): number => {
    if (columns.length === 0) return 0;

    if (unit === 'day') {
      const key = toDayKey(date);
      const colIdx = columns.findIndex((c) => c.key === key);
      if (colIdx === -1) return 0;
      return colIdx * colWidth + (edge === 'end' ? colWidth : 0);
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const colKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const colIdx = columns.findIndex((c) => c.key === colKey);
    if (colIdx === -1) return 0;
    const dayFraction =
      edge === 'end' ? day / daysInMonth : (day - 1) / daysInMonth;
    return (colIdx + dayFraction) * colWidth;
  };

  /** Build activity counts per column key (month or day) */
  const activeDaysPerColumn = (
    item: IGanttMediaItem,
    startKey: string | null,
    endKey: string | null
  ): Map<string, number> => {
    const map = new Map<string, number>();
    item.activeDates.forEach((d) => {
      if (startKey && d < startKey) return;
      if (endKey && d > endKey) return;
      const key = unit === 'day' ? d : d.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  };

  const hasResults = filtered.length > 0;
  const totalW = columns.length * colWidth;
  const totalH = filtered.length * ROW_HEIGHT;

  useEffect(() => {
    if (!hasResults) {
      setTooltip(null);
      setHoveredId(null);
    }
  }, [hasResults]);

  return (
    <div className="relative select-none">
      {/* ── Zoom controls ───────────────────────────────────────────────── */}
      {hasResults && (
        <div className="flex items-center justify-end gap-1 mb-2 pr-1">
          <span className="text-[10px] text-base-content/50 mr-1 select-none">
            Ctrl+Scroll to zoom · Middle-click drag to pan
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] tabular-nums font-medium text-base-content/60 min-w-[3ch] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={handleZoomReset}
              title="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {hasResults ? (
        // No `overflow: hidden` on this wrapper — a non-visible overflow
        // ancestor would become the sticky containing block and keep the date
        // header from sticking to the viewport.
        <div className="relative">
          {/* ── Fixed left label panel (opaque, covers headers + bars) ── */}
          <div
            className="absolute top-0 left-0 bottom-0"
            style={{
              width: LABEL_WIDTH,
              zIndex: 30,
              background: 'oklch(var(--b1))',
              pointerEvents: 'auto',
            }}
          >
            {/* Header spacer — matches the height of the month header row */}
            <div
              style={{ height: 38 }}
              className="border-b border-base-300"
            />
            {/* Row labels */}
            <div style={{ position: 'relative', height: totalH }}>
              {filtered.map((item, rowIdx) => {
                const rowColor = MEDIA_TYPE_COLORS[item.type] ?? '#888';
                const itemKey = `${item.type}:${item.mediaId}`;
                const isHovered = hoveredId === itemKey;
                const rowTop = rowIdx * ROW_HEIGHT;

                return (
                  <div
                    key={itemKey}
                    className="absolute flex items-center gap-2 px-3 cursor-pointer hover:underline"
                    style={{
                      top: rowTop,
                      height: ROW_HEIGHT,
                      width: LABEL_WIDTH,
                      background: isHovered
                        ? hexToRgba(rowColor, 0.1)
                        : rowIdx % 2 === 0
                          ? 'oklch(var(--b2))'
                          : 'oklch(var(--b1))',
                      borderRight: `2px solid ${hexToRgba(rowColor, 0.35)}`,
                    }}
                    onClick={() => navigate(`/${item.type}/${item.mediaId}`)}
                    title={item.titleEnglish ?? item.title}
                    onMouseEnter={() => setHoveredId(itemKey)}
                    onMouseLeave={() => {
                      setHoveredId(null);
                      scheduleTooltipClose();
                    }}
                  >
                    {/* Cover thumbnail */}
                    <div
                      className="flex-shrink-0 rounded overflow-hidden"
                      style={{
                        width: 28,
                        height: 36,
                        background: hexToRgba(rowColor, 0.2),
                        border: `1px solid ${hexToRgba(rowColor, 0.4)}`,
                      }}
                    >
                      {item.contentImage ? (
                        <img
                          src={item.contentImage}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-[10px] font-bold"
                          style={{ color: rowColor }}
                        >
                          {item.type.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Title + badges */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span
                          className="text-xs font-semibold leading-tight truncate"
                          style={{ color: isHovered ? rowColor : undefined }}
                        >
                          {truncate(item.title, 22)}
                        </span>
                        {item.isCompleted && (
                          <span title="Completed">
                            <CheckCircle
                              className="w-3 h-3 flex-shrink-0"
                              style={{ color: rowColor }}
                            />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="text-[9px] uppercase tracking-wide font-medium px-1 rounded"
                          style={{
                            background: hexToRgba(rowColor, 0.15),
                            color: rowColor,
                          }}
                        >
                          {item.type === 'tv show'
                            ? 'TV'
                            : item.type === 'vn'
                              ? 'VN'
                              : item.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Timeline area: sticky header + horizontally-scrollable body ─ */}
          <div style={{ marginLeft: LABEL_WIDTH }}>
            {/* Month/day header — sticky to the page; an `overflow-x-auto`
                ancestor can't have a sticky child stick to the viewport (it
                becomes the sticky containing block instead), so the header
                lives outside the scrolling body and mirrors its scrollLeft. */}
            <div
              ref={headerScrollRef}
              className="sticky top-0 z-20 bg-base-100 overflow-hidden"
            >
              <div className="flex" style={{ width: totalW }}>
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="flex-shrink-0 border-l border-base-300"
                    style={{ width: colWidth }}
                  >
                    {col.topLabel && (
                      <div
                        className="text-[10px] font-bold text-primary/70 px-1 pt-1 leading-none"
                        style={{ position: 'absolute' }}
                      >
                        {col.topLabel}
                      </div>
                    )}
                    <div className="text-[10px] text-base-content/50 text-center pt-4 pb-1 font-medium">
                      {col.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Scrollable timeline body (bars only) ────────────────────── */}
            <div
              ref={scrollRef}
              className="overflow-x-auto overflow-y-visible"
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
              onMouseDown={handlePanStart}
              onScroll={() => {
                if (headerScrollRef.current && scrollRef.current) {
                  headerScrollRef.current.scrollLeft =
                    scrollRef.current.scrollLeft;
                }
              }}
            >
            <div style={{ minWidth: totalW }}>
              {/* ── Rows (bar area only, no labels) ──────────────────────── */}
              <div style={{ position: 'relative', height: totalH }}>
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {columns.map((col, idx) => (
                    <div
                      key={col.key}
                      className="absolute top-0 bottom-0 border-l border-base-300/40"
                      style={{
                        left: idx * colWidth,
                        borderColor: col.isMajor
                          ? 'oklch(var(--bc)/0.2)'
                          : undefined,
                        borderWidth: col.isMajor ? 1 : undefined,
                        borderStyle: col.isMajor ? 'dashed' : undefined,
                      }}
                    />
                  ))}
                </div>

                {/* Media rows — bar area only */}
                {filtered.map((item, rowIdx) => {
                  const rowColor = MEDIA_TYPE_COLORS[item.type] ?? '#888';
                  const itemKey = `${item.type}:${item.mediaId}`;
                  const isHovered = hoveredId === itemKey;
                  const itemStart = new Date(item.firstLogDate);
                  const itemEnd = new Date(item.lastLogDate);
                  const effectiveStart =
                    rangeStart && itemStart < rangeStart ? rangeStart : itemStart;
                  const effectiveEnd =
                    rangeEnd && itemEnd > rangeEnd ? rangeEnd : itemEnd;
                  const rawBarStart = dateToColX(effectiveStart, 'start');
                  const barEnd = dateToColX(effectiveEnd, 'end');
                  const barStart = Math.max(rawBarStart, 0);
                  const barW = Math.max(barEnd - barStart, minBarWidth);
                  const rowTop = rowIdx * ROW_HEIGHT;
                  const density = activeDaysPerColumn(
                    item,
                    rangeStartKey,
                    rangeEndKey
                  );

                  return (
                    <div
                      key={itemKey}
                      className="absolute w-full flex items-center transition-colors"
                      style={{
                        top: rowTop,
                        height: ROW_HEIGHT,
                        background: isHovered
                          ? hexToRgba(rowColor, 0.06)
                          : rowIdx % 2 === 0
                            ? 'oklch(var(--b2)/0.5)'
                            : 'transparent',
                      }}
                      onMouseEnter={() => setHoveredId(itemKey)}
                      onMouseLeave={() => {
                        setHoveredId(null);
                        scheduleTooltipClose();
                      }}
                    >
                      {/* ── Bar area ──────────────────────────────────────── */}
                      <div
                        className="flex-1 relative h-full"
                        style={{ overflow: 'hidden' }}
                      >
                        {/* Activity density shading per column */}
                        {columns.map((col, colIdx) => {
                          const count = density.get(col.key) ?? 0;
                          if (!count) return null;
                          const opacityIdx = DENSITY_THRESHOLDS.findIndex(
                            (t) => count <= t
                          );
                          const alpha =
                            opacityIdx === -1
                              ? 0.35
                              : ([0.06, 0.12, 0.2, 0.28][opacityIdx] ?? 0.06);
                          return (
                            <div
                              key={col.key}
                              className="absolute top-0 bottom-0"
                              style={{
                                left: colIdx * colWidth,
                                width: colWidth,
                                background: hexToRgba(rowColor, alpha),
                                pointerEvents: 'none',
                              }}
                            />
                          );
                        })}

                        {/* The main Gantt bar */}
                        <div
                          className="absolute flex items-center"
                          style={{
                            left: barStart,
                            top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                            width: barW,
                            height: BAR_HEIGHT,
                            borderRadius: BAR_RADIUS,
                            background: hexToRgba(
                              rowColor,
                              isHovered ? 0.85 : 0.65
                            ),
                            border: `1.5px solid ${hexToRgba(rowColor, 0.9)}`,
                            transition: 'background 0.15s, box-shadow 0.15s',
                            boxShadow: isHovered
                              ? `0 2px 12px ${hexToRgba(rowColor, 0.45)}`
                              : undefined,
                            cursor: 'default',
                            overflow: 'hidden',
                            paddingInline: 6,
                          }}
                          onMouseEnter={(e) => {
                            clearTooltipCloseTimeout();
                            tooltipHoverRef.current = false;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              item,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                        >
                          {/* Bar label: show log count if wide enough */}
                          {barW > 36 && (
                            <span
                              className="text-[10px] font-semibold truncate leading-none"
                              style={{
                                color: '#fff',
                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                              }}
                            >
                              {item.logCount} log{item.logCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-base-content/50 gap-3">
          <svg className="w-14 h-14 opacity-30" fill="none" viewBox="0 0 64 64">
            <rect
              x="8"
              y="16"
              width="48"
              height="6"
              rx="3"
              fill="currentColor"
              opacity=".5"
            />
            <rect
              x="8"
              y="30"
              width="30"
              height="6"
              rx="3"
              fill="currentColor"
              opacity=".35"
            />
            <rect
              x="8"
              y="44"
              width="40"
              height="6"
              rx="3"
              fill="currentColor"
              opacity=".2"
            />
          </svg>
          <p className="text-sm">
            No immersion data to display for this filter.
          </p>
        </div>
      )}

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      {tooltip && (
        <GanttTooltip
          item={tooltip.item}
          x={tooltip.x}
          y={tooltip.y}
          onNavigate={(mediaId, type) => navigate(`/${type}/${mediaId}`)}
          onHoverChange={(isHovering) => {
            tooltipHoverRef.current = isHovering;
            if (isHovering) {
              clearTooltipCloseTimeout();
            } else {
              scheduleTooltipClose();
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function GanttTooltip({
  item,
  x,
  y,
  onNavigate,
  onHoverChange,
}: {
  item: IGanttMediaItem;
  x: number;
  y: number;
  onNavigate: (mediaId: string, type: string) => void;
  onHoverChange: (isHovering: boolean) => void;
}) {
  const color = MEDIA_TYPE_COLORS[item.type] ?? '#888';
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Nudge tooltip so it stays on-screen
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    let nx = x - width / 2;
    let ny = y - height - 8;
    if (nx < 8) nx = 8;
    if (nx + width > vw - 8) nx = vw - width - 8;
    if (ny < 8) ny = y + 32; // if no space above, show below
    setPos({ x: nx, y: ny });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] pointer-events-auto"
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div
        className="rounded-xl shadow-2xl p-3 min-w-[220px] max-w-[280px] bg-base-100/95 backdrop-blur"
        style={{
          border: `1.5px solid ${hexToRgba(color, 0.5)}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 1px ${hexToRgba(color, 0.15)}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          {item.contentImage && (
            <img
              src={item.contentImage}
              alt=""
              className="w-8 h-10 object-cover rounded flex-shrink-0"
              style={{ border: `1px solid ${hexToRgba(color, 0.4)}` }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight text-base-content line-clamp-2">
              {item.title}
            </p>
            {item.titleEnglish && item.titleEnglish !== item.title && (
              <p className="text-[10px] text-base-content/50 leading-tight mt-0.5 line-clamp-1">
                {item.titleEnglish}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              <span
                className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                style={{ background: hexToRgba(color, 0.2), color }}
              >
                {item.type}
              </span>
              {item.isCompleted && (
                <span
                  className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                  style={{ background: hexToRgba(color, 0.15), color }}
                >
                  <CheckCircle className="w-2.5 h-2.5" />
                  Done
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-base-300 my-2" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1 text-base-content/70">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{formatMinutes(item.totalTime)}</span>
          </div>
          <div className="flex items-center gap-1 text-base-content/70">
            <Zap className="w-3 h-3 flex-shrink-0" />
            <span>{item.totalXp.toLocaleString()} XP</span>
          </div>
          <div className="flex items-center gap-1 text-base-content/70">
            <Hash className="w-3 h-3 flex-shrink-0" />
            <span>
              {item.logCount} log{item.logCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1 text-base-content/70">
            <span className="text-[9px] opacity-70">days</span>
            <span>{item.activeDates.length}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="mt-2 text-[10px] text-base-content/50 space-y-0.5">
          <div>
            <span className="font-medium">Started:</span>{' '}
            {formatDate(item.firstLogDate)}
          </div>
          <div>
            <span className="font-medium">
              {item.isCompleted ? 'Completed:' : 'Last log:'}
            </span>{' '}
            {formatDate(
              item.isCompleted && item.completedAt
                ? item.completedAt
                : item.lastLogDate
            )}
          </div>
        </div>

        {/* Navigate link */}
        <button
          className="pointer-events-auto mt-2 flex items-center gap-1 text-[10px] font-medium hover:underline"
          style={{ color }}
          onClick={() => onNavigate(item.mediaId, item.type)}
        >
          <ExternalLink className="w-3 h-3" />
          View media page
        </button>
      </div>
    </div>
  );
}
