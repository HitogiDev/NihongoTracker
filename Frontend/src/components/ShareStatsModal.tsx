import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Download, Heart, RotateCcw, Share2, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUserFn, getUserStatsFn } from '../api/trackerApi';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { useThemeColors } from '../hooks/useThemeColors';
import { useOfflineImage } from '../hooks/useOfflineImage';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';
import {
  canCustomizeStatsCard,
  DEFAULT_STATS_CARD_DESIGN,
  generateStatsCard,
  maxTopMedia,
  normalizeStatsCardDesign,
  STATS_CARD_PALETTES,
  STATS_CARD_STYLES,
  type StatsCardDesign,
  type StatsCardFormat,
  type StatsCardPalette,
  type StatsCardStyle,
  type StatsCardTitleLanguage,
} from '../utils/statsCard';
import { downloadStatsImage, shareStatsImage } from '../native/shareStatsImage';
import DatePickerInput from './ui/DatePickerInput';
import Button from './ui/Button';
import { BTN } from './ui/buttons';
import DropdownSelect from './ui/DropdownSelect';
import Field from './ui/Field';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';

interface ShareStatsModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
}

type RangeMode = 'total' | 'month' | 'year' | 'custom';

const RANGE_OPTIONS: Array<{
  value: RangeMode;
  labelKey: ParseKeys<'stats'>;
}> = [
  { value: 'total', labelKey: 'share.allTime' },
  { value: 'month', labelKey: 'share.thisMonth' },
  { value: 'year', labelKey: 'share.thisYear' },
  { value: 'custom', labelKey: 'share.custom' },
];

const FORMAT_OPTIONS: Array<{
  value: StatsCardFormat;
  labelKey: ParseKeys<'stats'>;
}> = [
  { value: 'portrait', labelKey: 'share.portrait' },
  { value: 'square', labelKey: 'share.square' },
  { value: 'story', labelKey: 'share.story' },
];

const STYLE_LABELS: Record<StatsCardStyle, ParseKeys<'stats'>> = {
  classic: 'share.styles.classic',
  seigaiha: 'share.styles.seigaiha',
  nightSky: 'share.styles.nightSky',
  sakura: 'share.styles.sakura',
  halftone: 'share.styles.halftone',
};

const PALETTE_LABELS: Record<StatsCardPalette, ParseKeys<'stats'>> = {
  theme: 'share.palettes.theme',
  midnight: 'share.palettes.midnight',
  paper: 'share.palettes.paper',
};

const TITLE_LANGUAGE_OPTIONS: Array<{
  value: StatsCardTitleLanguage;
  labelKey: ParseKeys<'stats'>;
}> = [
  { value: 'native', labelKey: 'share.titleNative' },
  { value: 'romaji', labelKey: 'share.titleRomaji' },
  { value: 'english', labelKey: 'share.titleEnglish' },
];

const ACCENT_PRESETS = [
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fbbf24',
  '#34d399',
];

const MEDIA_TYPE_KEYS: Record<string, string> = {
  anime: 'anime',
  manga: 'manga',
  reading: 'reading',
  game: 'game',
  video: 'video',
  movie: 'movie',
  'tv show': 'tvShow',
  audio: 'audio',
  book: 'book',
  other: 'other',
};

function toQueryDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Omit time fields so the date range fits on the card.
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
  const { t, i18n } = useTranslation('stats');
  const { t: tCommon } = useTranslation('common');
  const colors = useThemeColors();
  const viewer = useUserDataStore((state) => state.user);
  const supporter = canCustomizeStatsCard(viewer);
  const { timezone, formatDate } = useDateFormatting();
  const [mode, setMode] = useState<RangeMode>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [design, setDesign] = useState<StatsCardDesign>({
    ...DEFAULT_STATS_CARD_DESIGN,
  });
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setDesign({ ...DEFAULT_STATS_CARD_DESIGN });
  }, [viewer?._id]);

  const effectiveDesign = useMemo(
    () => normalizeStatsCardDesign(design, supporter),
    [design, supporter]
  );
  const accentInputColor = useMemo(() => {
    if (effectiveDesign.accent) return effectiveDesign.accent;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return '#7480ff';
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }, [effectiveDesign.accent, colors.primary]);

  const customReady = mode !== 'custom' || Boolean(customStart && customEnd);

  const { statsParams, dateLabel } = useMemo(() => {
    const now = new Date();
    if (mode === 'custom') {
      return {
        statsParams:
          customStart && customEnd
            ? { start: customStart, end: customEnd, timezone, topMedia: 5 }
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
        statsParams: { timeRange: 'month', timezone, topMedia: 5 },
        dateLabel: `${formatDate(start, DATE_ONLY_OPTS)} – ${formatDate(
          now,
          DATE_ONLY_OPTS
        )}`,
      };
    }
    if (mode === 'year') {
      const start = new Date(now.getFullYear(), 0, 1, 12);
      return {
        statsParams: { timeRange: 'year', timezone, topMedia: 5 },
        dateLabel: `${formatDate(start, DATE_ONLY_OPTS)} – ${formatDate(
          now,
          DATE_ONLY_OPTS
        )}`,
      };
    }
    return {
      statsParams: { timeRange: 'total', timezone, topMedia: 5 },
      dateLabel: t('share.allTime'),
    };
  }, [mode, customStart, customEnd, timezone, formatDate, t]);

  const {
    data: profile,
    isError: profileFailed,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username),
    enabled: open && !!username,
    staleTime: 60 * 1000,
  });
  const avatar = useOfflineImage(profile?.avatar);
  const banner = useOfflineImage(
    effectiveDesign.showBanner ? profile?.banner : undefined
  );

  const {
    data: stats,
    isError: statsFailed,
    isFetching,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['shareStats', username, statsParams],
    queryFn: () => getUserStatsFn(username, statsParams ?? undefined),
    enabled: open && !!username && customReady && !!statsParams,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!open || !stats || !profile || !dateLabel || !customReady) return;
    let cancelled = false;
    setIsRendering(true);
    setRenderFailed(false);
    const timer = window.setTimeout(() => {
      generateStatsCard({
        user: { ...profile, avatar, banner },
        stats,
        dateLabel,
        colors,
        design: effectiveDesign,
        locale: i18n.language,
        labels: {
          heading: t('share.cardHeading'),
          hours: t('share.immersedHours'),
          total: t('share.total'),
          reading: t('cards.reading'),
          listening: t('cards.listening'),
          dailyAverage: t('cards.dailyAverage'),
          characters: t('cards.charsRead'),
          charsUnit: t('units.chars'),
          episodesUnit: t('share.episodesUnit'),
          streak: t('cards.currentStreak'),
          days: t('share.days'),
          logs: t('cards.logCount'),
          supporter: t('share.supporter'),
          topMedia: t('share.topMediaHeading'),
          mediaTypes: {
            ...Object.fromEntries(
              Object.entries(MEDIA_TYPE_KEYS).map(([type, key]) => [
                type,
                tCommon(`mediaTypes.${key}` as ParseKeys<'common'>),
              ])
            ),
            'light-novel': 'LN',
            vn: 'VN',
          },
        },
      })
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
          imageUrlRef.current = url;
          setImageUrl(url);
          setImageBlob(blob);
        })
        .catch(() => {
          if (!cancelled) {
            setRenderFailed(true);
            setImageBlob(null);
            setImageUrl(null);
          }
        })
        .finally(() => {
          if (!cancelled) setIsRendering(false);
        });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    stats,
    profile,
    avatar,
    banner,
    dateLabel,
    customReady,
    colors,
    effectiveDesign,
    i18n.language,
    t,
    tCommon,
    attempt,
  ]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const fileName = `${username.replace(/[^\p{L}\p{N}_-]/gu, '_')}-stats.png`;
  const failed = renderFailed || statsFailed || profileFailed;
  const busy = isRendering || isFetching;
  const ready = !!imageBlob && !busy && !failed && customReady;

  const handleDownload = () => {
    if (ready && imageBlob) downloadStatsImage(imageBlob, fileName);
  };

  const handleShare = async () => {
    if (!ready || !imageBlob || isSharing) return;
    setIsSharing(true);
    try {
      const result = await shareStatsImage(
        imageBlob,
        fileName,
        t('share.shareTitle', { username }),
        t('share.shareText', { username })
      );
      if (result === 'downloaded') toast.info(t('share.downloadedInstead'));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error(t('share.shareFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('share.title')} size="xl">
      <div className="grid min-w-0 gap-5 md:grid-cols-[1fr_1fr]">
        <div className="min-w-0 space-y-3">
          <Field label={t('share.period')}>
            <div className="grid grid-cols-2 gap-2">
              {RANGE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  onClick={() => setMode(opt.value)}
                  variant={mode === opt.value ? 'primary' : 'default'}
                  appearance={mode === opt.value ? 'solid' : 'outline'}
                  aria-pressed={mode === opt.value}
                >
                  {t(opt.labelKey)}
                </Button>
              ))}
            </div>
          </Field>

          {mode === 'custom' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label={t('share.from')}>
                <DatePickerInput
                  size="sm"
                  value={customStart}
                  max={customEnd || toQueryDate(new Date())}
                  onChange={setCustomStart}
                />
              </Field>
              <Field label={t('share.to')}>
                <DatePickerInput
                  size="sm"
                  value={customEnd}
                  min={customStart || undefined}
                  max={toQueryDate(new Date())}
                  onChange={setCustomEnd}
                />
              </Field>
            </div>
          )}

          <Field label={t('share.format')}>
            <div className="join w-full">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={design.format === option.value}
                  className={`${design.format === option.value ? BTN.segmentActive : BTN.segment} flex-1`}
                  onClick={() =>
                    setDesign((value) => ({ ...value, format: option.value }))
                  }
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </Field>

          <div className="surface-muted space-y-3 p-4">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                {t('share.showTopMedia')}
              </span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={effectiveDesign.showTopMedia}
                onChange={(event) =>
                  setDesign((value) => ({
                    ...value,
                    showTopMedia: event.target.checked,
                  }))
                }
              />
            </label>
            {effectiveDesign.showTopMedia && (
              <>
                {stats && !stats.topMedia?.length && (
                  <p className="text-xs text-base-content/60">
                    {t('share.noTopMedia')}
                  </p>
                )}
                <Field label={t('share.topMediaCount')}>
                  <div className="join w-full">
                    {Array.from(
                      { length: maxTopMedia(effectiveDesign.format) },
                      (_, index) => index + 1
                    ).map((count) => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={effectiveDesign.topMediaCount === count}
                        className={`${effectiveDesign.topMediaCount === count ? BTN.segmentActive : BTN.segment} flex-1`}
                        onClick={() =>
                          setDesign((value) => ({
                            ...value,
                            topMediaCount: count,
                          }))
                        }
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t('share.titleLanguage')}>
                  {(id) => (
                    <DropdownSelect
                      id={id}
                      value={effectiveDesign.titleLanguage}
                      className="w-full"
                      onChange={(event) =>
                        setDesign((value) => ({
                          ...value,
                          titleLanguage: event.target
                            .value as StatsCardTitleLanguage,
                        }))
                      }
                    >
                      {TITLE_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </DropdownSelect>
                  )}
                </Field>
              </>
            )}
          </div>

          <div className="surface-muted space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-secondary" />
              {t('share.supporterStyle')}
            </div>
            {supporter ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('share.style')}>
                    {(id) => (
                      <DropdownSelect
                        id={id}
                        value={effectiveDesign.style}
                        className="w-full"
                        onChange={(event) =>
                          setDesign((value) => ({
                            ...value,
                            style: event.target.value as StatsCardStyle,
                          }))
                        }
                      >
                        {STATS_CARD_STYLES.map((style) => (
                          <option key={style} value={style}>
                            {t(STYLE_LABELS[style])}
                          </option>
                        ))}
                      </DropdownSelect>
                    )}
                  </Field>
                  <Field label={t('share.background')}>
                    {(id) => (
                      <DropdownSelect
                        id={id}
                        value={effectiveDesign.palette}
                        className="w-full"
                        onChange={(event) =>
                          setDesign((value) => ({
                            ...value,
                            palette: event.target.value as StatsCardPalette,
                          }))
                        }
                      >
                        {STATS_CARD_PALETTES.map((palette) => (
                          <option key={palette} value={palette}>
                            {t(PALETTE_LABELS[palette])}
                          </option>
                        ))}
                      </DropdownSelect>
                    )}
                  </Field>
                </div>
                <Field label={t('share.accent')}>
                  {(id) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id={id}
                        type="color"
                        className="h-9 w-11 cursor-pointer rounded-field border border-base-300 p-1"
                        value={accentInputColor}
                        onChange={(event) =>
                          setDesign((value) => ({
                            ...value,
                            accent: event.target.value,
                          }))
                        }
                      />
                      {ACCENT_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={color}
                          aria-pressed={effectiveDesign.accent === color}
                          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            effectiveDesign.accent === color
                              ? 'border-base-content'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() =>
                            setDesign((value) => ({ ...value, accent: color }))
                          }
                        />
                      ))}
                      <Button
                        size="sm"
                        appearance="ghost"
                        onClick={() =>
                          setDesign((value) => ({ ...value, accent: '' }))
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t('share.themeColor')}
                      </Button>
                    </div>
                  )}
                </Field>
                <Field
                  label={t('share.caption')}
                  aside={`${design.caption.length}/60`}
                >
                  {(id) => (
                    <input
                      id={id}
                      className="input input-sm w-full focus:input-primary"
                      maxLength={60}
                      value={design.caption}
                      placeholder={t('share.captionPlaceholder')}
                      onChange={(event) =>
                        setDesign((value) => ({
                          ...value,
                          caption: event.target.value,
                        }))
                      }
                    />
                  )}
                </Field>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {t('share.useBanner')}
                    {!profile?.banner && (
                      <span className="block text-xs text-base-content/60">
                        {t('share.noBanner')}
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={effectiveDesign.showBanner}
                    disabled={!profile?.banner}
                    onChange={(event) =>
                      setDesign((value) => ({
                        ...value,
                        showBanner: event.target.checked,
                      }))
                    }
                  />
                </label>
                {profile?.patreon?.isActive && !profile.patreon.hideBadge && (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    {t('share.showBadge')}
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      checked={effectiveDesign.showBadge}
                      onChange={(event) =>
                        setDesign((value) => ({
                          ...value,
                          showBadge: event.target.checked,
                        }))
                      }
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-base-content/70">
                  {t('share.supporterHint')}
                </p>
                <Link
                  to="/support"
                  onClick={onClose}
                  className="link link-hover text-sm font-semibold"
                >
                  {t('share.exploreSupport')}
                </Link>
              </>
            )}
          </div>
        </div>

        <div
          className="surface-muted relative flex min-h-64 min-w-0 items-center justify-center p-3 md:sticky md:top-0 md:h-[calc(100dvh-14rem)] md:min-h-80 md:self-start"
          aria-busy={busy}
        >
          {mode === 'custom' && !customReady ? (
            <p className="text-sm text-base-content/60">
              {t('share.pickDates')}
            </p>
          ) : failed ? (
            <div className="space-y-3 p-4 text-center" role="alert">
              <p className="text-sm text-base-content/70">
                {t('share.generateFailed')}
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setAttempt((value) => value + 1);
                  if (profileFailed) void refetchProfile();
                  if (statsFailed) void refetchStats();
                }}
              >
                {t('share.retry')}
              </Button>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={t('share.previewAlt')}
              className={`h-auto max-h-[65vh] w-auto max-w-full object-contain shadow-sm transition-opacity md:max-h-full ${
                busy ? 'opacity-50' : 'opacity-100'
              }`}
            />
          ) : (
            <Spinner size="lg" />
          )}
          {busy && imageUrl && !failed && (
            <div className="absolute">
              <Spinner />
            </div>
          )}
        </div>
      </div>
      <div className="modal-action sticky -bottom-6 z-10 -mx-6 -mb-6 border-t border-base-300 bg-base-100 px-6 py-4">
        {!isNativeApp() && (
          <Button
            appearance="ghost"
            onClick={handleDownload}
            disabled={!ready || isSharing}
          >
            <Download className="h-4 w-4" />
            {t('share.download')}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleShare}
          disabled={!ready}
          loading={isSharing}
        >
          <Share2 className="h-4 w-4" />
          {t('share.share')}
        </Button>
      </div>
    </Modal>
  );
}
