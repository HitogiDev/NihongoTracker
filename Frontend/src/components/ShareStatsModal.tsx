import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Download, Share2, X } from 'lucide-react';
import { getUserStatsFn, generateStatsCardFn } from '../api/trackerApi';
import { useDateFormatting } from '../hooks/useDateFormatting';

interface ShareStatsModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
}

type RangeMode = 'total' | 'month' | 'year' | 'custom';

/** Module scope: key names, never text. */
const RANGE_OPTIONS: Array<{
  value: RangeMode;
  labelKey: ParseKeys<'stats'>;
}> = [
  { value: 'total', labelKey: 'share.allTime' },
  { value: 'month', labelKey: 'share.thisMonth' },
  { value: 'year', labelKey: 'share.thisYear' },
  { value: 'custom', labelKey: 'share.custom' },
];

// Local date -> YYYY-MM-DD (matches StatsScreen.formatDateForQuery input format).
function toQueryDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Date-only options: formatDateInTimezone defaults to including time + tz, so we
// explicitly null those out to keep the card's range label short (no truncation).
const DATE_ONLY_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: undefined,
  minute: undefined,
  timeZoneName: undefined,
};

export default function ShareStatsModal({
  username,
  open,
  onClose,
}: ShareStatsModalProps) {
  const { t } = useTranslation('stats');
  const { t: tCommon } = useTranslation('common');
  const { timezone, formatDate } = useDateFormatting();
  const [mode, setMode] = useState<RangeMode>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const imageUrlRef = useRef<string | null>(null);

  const customReady = mode !== 'custom' || Boolean(customStart && customEnd);

  // Query params + human-readable label for the selected range.
  const { statsParams, dateLabel } = useMemo(() => {
    const now = new Date();
    if (mode === 'custom') {
      return {
        statsParams:
          customStart && customEnd
            ? { start: customStart, end: customEnd, timezone }
            : null,
        dateLabel:
          customStart && customEnd
            ? `${formatDate(customStart, DATE_ONLY_OPTS)} – ${formatDate(
                customEnd,
                DATE_ONLY_OPTS
              )}`
            : '',
      };
    }
    if (mode === 'month') {
      // Midday avoids the local-midnight -> user-timezone boundary crossing
      // (e.g. Jan 1 00:00 local rendering as Dec 31 in a western timezone).
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 12);
      return {
        statsParams: { timeRange: 'month', timezone },
        dateLabel: `${formatDate(start, DATE_ONLY_OPTS)} – ${formatDate(
          now,
          DATE_ONLY_OPTS
        )}`,
      };
    }
    if (mode === 'year') {
      const start = new Date(now.getFullYear(), 0, 1, 12);
      return {
        statsParams: { timeRange: 'year', timezone },
        dateLabel: `${formatDate(start, DATE_ONLY_OPTS)} – ${formatDate(
          now,
          DATE_ONLY_OPTS
        )}`,
      };
    }
    return {
      statsParams: { timeRange: 'total', timezone },
      dateLabel: t('share.allTime'),
    };
  }, [mode, customStart, customEnd, timezone, formatDate, t]);

  const { data: stats } = useQuery({
    queryKey: ['shareStats', username, statsParams],
    queryFn: () => getUserStatsFn(username, statsParams ?? undefined),
    enabled: open && !!username && customReady && !!statsParams,
    staleTime: 60 * 1000,
  });

  // Render the card whenever the stats/range change while the modal is open.
  useEffect(() => {
    if (!open || !stats || !dateLabel) return;
    let cancelled = false;
    setIsRendering(true);

    const tiles = {
      timeSpentHours: stats.totals.totalTimeHours,
      dailyAvgHours: stats.totals.dailyAverageHours,
      readingHours: stats.totals.readingHours,
      listeningHours: stats.totals.listeningHours,
      chars: stats.totals.totalChars,
      streakDays: stats.streaks.currentStreak,
    };

    generateStatsCardFn({ username, dateLabel, tiles })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = url;
        setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('share.generateFailed'));
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, stats, dateLabel, username, t]);

  // Clean up the object URL on unmount.
  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const fileName = `${username}-stats.png`;

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async () => {
    if (!imageUrl) return;
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: `${username}'s immersion stats`,
          text: `${username}'s immersion stats on NihongoTracker`,
        });
        return;
      }
      // Desktop / unsupported: fall back to download.
      handleDownload();
      toast.info(t('share.downloadedInstead'));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error(t('share.shareFailed'));
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal modal-bottom sm:modal-middle modal-open"
      role="dialog"
    >
      <div className="modal-box">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold">{t('share.title')}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={onClose}
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Range selector */}
        <div className="join mb-3 w-full">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`join-item btn btn-sm flex-1 ${
                mode === opt.value ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        {mode === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <label className="flex-1 text-xs text-base-content/60">
              {t('share.from')}
              <input
                type="date"
                className="input input-sm w-full mt-1"
                value={customStart}
                max={customEnd || toQueryDate(new Date())}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label className="flex-1 text-xs text-base-content/60">
              {t('share.to')}
              <input
                type="date"
                className="input input-sm w-full mt-1"
                value={customEnd}
                min={customStart || undefined}
                max={toQueryDate(new Date())}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}

        {/* Preview */}
        <div className="relative flex items-center justify-center surface-muted p-3 min-h-[320px]">
          {mode === 'custom' && !customReady ? (
            <p className="text-sm text-base-content/60">
              {t('share.pickDates')}
            </p>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={t('share.previewAlt')}
              className={`max-h-[60vh] w-auto rounded-lg shadow-sm transition-opacity ${
                isRendering ? 'opacity-50' : 'opacity-100'
              }`}
            />
          ) : (
            <span className="loading loading-spinner loading-lg text-primary" />
          )}
          {isRendering && imageUrl && (
            <span className="absolute loading loading-spinner loading-md text-primary" />
          )}
        </div>

        {/* Actions */}
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleDownload}
            disabled={!imageUrl || isRendering}
          >
            <Download className="h-4 w-4" />
            {t('share.download')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShare}
            disabled={!imageUrl || isRendering}
          >
            <Share2 className="h-4 w-4" />
            {t('share.share')}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
