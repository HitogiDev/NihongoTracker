import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { toPng } from 'html-to-image';
import { toast } from 'react-toastify';
import { Download, Share2 } from 'lucide-react';
import { getCardImageFn, getWrappedFn } from '../api/trackerApi';
import {
  IWrappedMedia,
  IWrappedStats,
  OutletProfileContextType,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { getMediaTypeColor } from '../constants/mediaColors';
import { downloadStatsImage, shareStatsImage } from '../native/shareStatsImage';
import { isNativeApp } from '../utils/nativeRuntime';
import Button from '../components/ui/Button';
import DropdownSelect from '../components/ui/DropdownSelect';
import { PageLoader } from '../components/ui/Spinner';

/** Width of the exported image. The card uses container queries, so it lays out the same at any viewport. */
const EXPORT_WIDTH = 1200;
const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const TYPE_LABELS: Record<string, ParseKeys<'common'>> = {
  anime: 'mediaTypes.anime',
  audio: 'mediaTypes.audio',
  book: 'mediaTypes.book',
  game: 'mediaTypes.game',
  manga: 'mediaTypes.manga',
  movie: 'mediaTypes.movie',
  other: 'mediaTypes.other',
  'light-novel': 'mediaTypes.light-novel',
  reading: 'mediaTypes.reading',
  'tv show': 'mediaTypes.tvShow',
  video: 'mediaTypes.video',
  vn: 'mediaTypes.vn',
};

const GENRE_CLASSES = [
  'text-primary',
  'text-secondary',
  'text-accent',
  'text-base-content',
  'text-info',
];

/**
 * Replace each image in the export copy with a same-origin object URL from the card image proxy.
 * The PNG export cannot read cross-origin images without CORS headers.
 */
async function inlineExportImages(node: HTMLElement) {
  const objectUrls: string[] = [];
  await Promise.all(
    [...node.querySelectorAll('img')].map(async (img) => {
      const source = img.getAttribute('src');
      if (!source || source.startsWith('data:') || source.startsWith('blob:'))
        return;
      try {
        const url = URL.createObjectURL(await getCardImageFn(source));
        objectUrls.push(url);
        img.src = url;
      } catch {
        img.src = TRANSPARENT_PIXEL;
      }
      await img.decode().catch(() => undefined);
    })
  );
  return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
}

function mediaTitle(media: IWrappedMedia) {
  return (
    media.title?.contentTitleNative ||
    media.title?.contentTitleEnglish ||
    media.title?.contentTitleRomaji ||
    media.mediaId
  );
}

function hours(minutes: number) {
  return minutes / 60;
}

function Panel({
  title,
  children,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-muted flex flex-col gap-3 p-4 ${className}`}>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function StatPill({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="surface-muted flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-base-content/70">{label}</span>
      <span className="text-right font-bold text-primary">{value}</span>
    </div>
  );
}

function Cover({
  media,
  blurAdult,
  rank,
  className = 'w-16',
}: {
  media: IWrappedMedia;
  blurAdult: boolean;
  rank?: number;
  /** Width utilities. The cover keeps a 3:4 ratio. */
  className?: string;
}) {
  const src = media.contentImage;
  const blur =
    blurAdult && (media.type === 'vn' ? media.isAdultImage : media.isAdult);
  const title = mediaTitle(media);
  return (
    <Link
      to={`/${media.type}/${media.mediaId}`}
      title={title}
      className={`relative block shrink-0 overflow-hidden rounded-box bg-base-300 aspect-[3/4] ${className}`}
    >
      {src && (
        <img
          src={src}
          alt={title}
          className={`h-full w-full object-cover ${blur ? 'blur-md' : ''}`}
        />
      )}
      {rank !== undefined && (
        <span className="badge badge-primary badge-sm absolute left-1 top-1 font-bold">
          {rank}
        </span>
      )}
    </Link>
  );
}

function TopMedia({
  title,
  items,
  blurAdult,
  empty,
}: {
  title: ReactNode;
  items: IWrappedMedia[];
  blurAdult: boolean;
  empty: ReactNode;
}) {
  const { formatNumber } = useDateFormatting();
  const [first, ...rest] = items;
  return (
    <Panel title={title}>
      {first ? (
        <>
          <div className="flex items-end gap-3">
            <Cover
              media={first}
              blurAdult={blurAdult}
              rank={1}
              className="w-24"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-3 font-semibold leading-tight">
                {mediaTitle(first)}
              </p>
              <p className="mt-1 text-xs text-base-content/60">
                {formatNumber(hours(first.time), { maximumFractionDigits: 1 })}h
              </p>
            </div>
          </div>
          {rest.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {rest.map((media, index) => (
                <Cover
                  key={`${media.type}:${media.mediaId}`}
                  media={media}
                  blurAdult={blurAdult}
                  rank={index + 2}
                  className="w-full"
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="py-6 text-center text-sm text-base-content/60">{empty}</p>
      )}
    </Panel>
  );
}

function MonthlyChart({
  monthly,
  typeOrder,
  locale,
}: {
  monthly: IWrappedStats['monthly'];
  typeOrder: string[];
  locale: string;
}) {
  const { formatNumber } = useDateFormatting();
  const width = 600;
  const height = 160;
  const slot = width / 12;
  const barWidth = slot * 0.6;
  const max = Math.max(1, ...monthly.map((month) => month.time));
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[10px] text-base-content/60">
        <span>{formatNumber(hours(max), { maximumFractionDigits: 0 })}h</span>
      </div>
      {/* Use color attributes, not classes. The PNG export does not copy class styles into SVG shapes. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-36 w-full"
        preserveAspectRatio="none"
      >
        {monthly.map((month, index) => {
          let top = height;
          return typeOrder
            .filter((type) => month.types[type])
            .map((type) => {
              const barHeight = (month.types[type] / max) * height;
              top -= barHeight;
              return (
                <rect
                  key={`${month.month}:${type}`}
                  x={index * slot + (slot - barWidth) / 2}
                  y={top}
                  width={barWidth}
                  height={barHeight}
                  fill={getMediaTypeColor(type)}
                />
              );
            });
        })}
      </svg>
      <div className="grid grid-cols-12 text-center text-[10px] text-base-content/60">
        {monthly.map((month) => (
          <span key={month.month}>
            {monthName.format(new Date(Date.UTC(2000, month.month - 1, 1)))}
          </span>
        ))}
      </div>
    </div>
  );
}

const CHAR_TYPES = new Set(['vn', 'game', 'light-novel', 'reading', 'book']);
const EPISODE_TYPES = new Set(['anime', 'tv show']);

/** Return the natural amount for a media type, or null when only time applies. */
function typeAmount(
  row: IWrappedStats['byType'][number]
): { key: 'chars' | 'pages' | 'episodes'; count: number } | null {
  if (row.type === 'manga') {
    if (row.pages > 0) return { key: 'pages', count: row.pages };
    return row.chars > 0 ? { key: 'chars', count: row.chars } : null;
  }
  if (CHAR_TYPES.has(row.type) && row.chars > 0) {
    return { key: 'chars', count: row.chars };
  }
  if (EPISODE_TYPES.has(row.type) && row.episodes > 0) {
    return { key: 'episodes', count: row.episodes };
  }
  return null;
}

const AMOUNT_KEYS = {
  chars: 'wrapped.amount.chars',
  pages: 'wrapped.amount.pages',
  episodes: 'wrapped.amount.episodes',
} as const;

function TypeBreakdown({ byType }: { byType: IWrappedStats['byType'] }) {
  const { t } = useTranslation('common');
  const { t: pt } = useTranslation('profile');
  const { formatNumber } = useDateFormatting();
  const rows = byType.filter((row) => row.time > 0).slice(0, 6);
  const total = rows.reduce((sum, row) => sum + row.time, 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-base-300">
        {rows.map((row) => (
          <span
            key={row.type}
            style={{
              width: `${(row.time / total) * 100}%`,
              backgroundColor: getMediaTypeColor(row.type),
            }}
          />
        ))}
      </div>
      <ul className="grid gap-y-2 text-sm">
        {rows.map((row) => {
          const amount = typeAmount(row);
          return (
            <li key={row.type} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getMediaTypeColor(row.type) }}
              />
              <span className="min-w-0">
                <span className="block truncate">
                  {TYPE_LABELS[row.type] ? t(TYPE_LABELS[row.type]) : row.type}
                </span>
                {amount && (
                  <span className="block text-xs text-base-content/60">
                    {pt(AMOUNT_KEYS[amount.key], {
                      count: amount.count,
                      value: formatNumber(amount.count),
                    })}
                  </span>
                )}
              </span>
              <span className="ml-auto text-base-content/60">
                {row.time < 60
                  ? '<1h'
                  : `${formatNumber(hours(row.time), { maximumFractionDigits: 0 })}h`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GenreCloud({ genres }: { genres: IWrappedStats['genres'] }) {
  const max = Math.max(1, ...genres.map((genre) => genre.time));
  // Alternate large and small words, so the cloud does not read as a sorted list.
  const ordered = genres
    .flatMap((genre, index) => (index % 2 === 0 ? [genre] : []))
    .concat(genres.filter((_, index) => index % 2 === 1).reverse());
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 leading-none">
      {ordered.map((genre, index) => (
        <span
          key={genre.genre}
          className={`font-bold ${GENRE_CLASSES[index % GENRE_CLASSES.length]}`}
          style={{ fontSize: `${0.75 + (genre.time / max) * 1.25}rem` }}
        >
          {genre.genre}
        </span>
      ))}
    </div>
  );
}

function FirstLastMedia({
  label,
  media,
  blurAdult,
}: {
  label: ReactNode;
  media: IWrappedMedia | null;
  blurAdult: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="text-xs text-base-content/60">{label}</span>
      {media ? (
        <>
          <Cover media={media} blurAdult={blurAdult} />
          <span className="line-clamp-2 text-xs font-medium">
            {mediaTitle(media)}
          </span>
        </>
      ) : (
        <span className="text-sm text-base-content/60">-</span>
      )}
    </div>
  );
}

function WrappedCard({
  stats,
  username,
  avatar,
  banner,
  blurAdult,
}: {
  stats: IWrappedStats;
  username: string;
  avatar?: string;
  banner?: string;
  blurAdult: boolean;
}) {
  const { t, i18n } = useTranslation('profile');
  const { formatNumber } = useDateFormatting();
  const avatarSrc = avatar;
  const bannerSrc = banner;
  const locale = i18n.language;
  const number = (value: number, digits = 0) =>
    formatNumber(value, { maximumFractionDigits: digits });
  const { totals, ranking } = stats;
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  });
  const monthLabel = (month: number) =>
    monthName.format(new Date(Date.UTC(2000, month - 1, 1)));
  const totalHours = hours(totals.time);
  const readingShare =
    totals.time > 0 ? (totals.readingTime / totals.time) * 100 : 0;
  const delta =
    stats.previousYear && stats.previousYear.time > 0
      ? Math.round(
          ((totals.time - stats.previousYear.time) / stats.previousYear.time) *
            100
        )
      : null;
  const topPercent =
    stats.percentile !== null
      ? Math.max(1, Math.ceil(100 - stats.percentile))
      : null;
  const mostActiveDay = stats.mostActiveDay
    ? new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${stats.mostActiveDay.date}T00:00:00Z`))
    : '-';
  const weekday =
    stats.peakWeekday !== null
      ? new Intl.DateTimeFormat(locale, {
          weekday: 'long',
          timeZone: 'UTC',
        }).format(
          // January 4, 1970 was a Sunday.
          new Date(Date.UTC(1970, 0, 4 + stats.peakWeekday))
        )
      : '-';
  const peakHour =
    stats.peakHour !== null
      ? new Intl.DateTimeFormat(locale, {
          hour: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(1970, 0, 1, stats.peakHour)))
      : '-';

  return (
    <article className="@container card surface overflow-hidden">
      <header className="relative">
        {bannerSrc && (
          <div className="absolute inset-0">
            <img
              src={bannerSrc}
              alt=""
              className="h-full w-full object-cover opacity-60"
            />
            {/* Fade the banner into the card so the text stays readable. */}
            <div className="absolute inset-0 bg-gradient-to-b from-base-100/10 via-base-100/50 to-base-100" />
          </div>
        )}
        <div
          className={
            bannerSrc
              ? 'relative flex flex-col gap-4 p-5 pt-16 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:p-8 @3xl:pt-24'
              : 'relative flex flex-col gap-4 p-5 @3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:p-8 @3xl:pb-0'
          }
        >
          <div className="flex items-center gap-4">
            <div className="avatar">
              <div className="w-20 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100 @3xl:w-24">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={username} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-base-300 text-2xl font-bold">
                    {username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold @3xl:text-4xl">
                {username}
              </h2>
              <p className="text-sm text-base-content/70">
                {t('wrapped.hoursIn', {
                  hours: number(totalHours),
                  year: stats.year,
                })}
              </p>
            </div>
          </div>
          <div className="@3xl:text-right">
            <p className="text-xl font-bold text-primary @3xl:text-3xl">
              {t('wrapped.title', { year: stats.year })}
            </p>
            <p className="text-sm font-semibold text-base-content/70">
              nihongotracker.app
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 p-5 @3xl:grid-cols-12 @3xl:p-8">
        <div className="flex flex-col gap-2 @3xl:col-span-4 @5xl:col-span-3">
          <StatPill
            label={t('wrapped.level')}
            value={
              stats.level.start === stats.level.end
                ? stats.level.end
                : `${stats.level.start} → ${stats.level.end}`
            }
          />
          <StatPill
            label={t('wrapped.daysActive')}
            value={`${stats.daysActive}/${stats.daysInYear}`}
          />
          <StatPill
            label={t('wrapped.monthsActive')}
            value={`${stats.monthsActive}/12`}
          />
          <StatPill
            label={t('wrapped.longestStreak')}
            value={t('wrapped.days', { count: stats.longestStreak })}
          />
          <StatPill label={t('wrapped.mostActiveDay')} value={mostActiveDay} />
          <StatPill label={t('wrapped.favoriteWeekday')} value={weekday} />
          <StatPill label={t('wrapped.peakHour')} value={peakHour} />
          <StatPill label={t('wrapped.logs')} value={number(totals.logs)} />
          <StatPill
            label={t('wrapped.completed')}
            value={number(stats.completed.total)}
          />
          <StatPill
            label={t('wrapped.achievements')}
            value={number(stats.achievementsUnlocked)}
          />
          <StatPill
            label={t('wrapped.reviews')}
            value={number(stats.reviewsWritten)}
          />
          {ranking?.bestMonthly && (
            <StatPill
              label={t('wrapped.bestMonthlyRank')}
              value={`#${ranking.bestMonthly.position} · ${monthLabel(ranking.bestMonthly.month)}`}
            />
          )}
          {ranking && ranking.firstPlaceMonths.length > 0 && (
            <StatPill
              label={t('wrapped.firstPlaceMonths')}
              value={ranking.firstPlaceMonths.map(monthLabel).join(', ')}
            />
          )}
          {ranking?.globalEnd != null && (
            <StatPill
              label={t('wrapped.globalRank')}
              value={
                ranking.globalStart != null &&
                ranking.globalStart !== ranking.globalEnd
                  ? `#${ranking.globalStart} → #${ranking.globalEnd}`
                  : `#${ranking.globalEnd}`
              }
            />
          )}
        </div>

        <div className="grid gap-4 @3xl:col-span-8 @3xl:grid-cols-2 @5xl:col-span-9 @5xl:grid-cols-3">
          <Panel title={t('wrapped.immersion')} className="@3xl:col-span-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 *:min-w-0">
              <div>
                <p className="truncate text-3xl font-black text-primary @5xl:text-4xl">
                  {number(totalHours)}
                </p>
                <p className="text-xs text-base-content/60">
                  {t('wrapped.hours')}
                </p>
              </div>
              <div>
                <p className="truncate text-3xl font-black @5xl:text-4xl">
                  {number(totals.xp)}
                </p>
                <p className="text-xs text-base-content/60">XP</p>
              </div>
              <div>
                <p className="truncate text-2xl font-bold">
                  {number(totals.chars)}
                </p>
                <p className="text-xs text-base-content/60">
                  {t('wrapped.chars')}
                </p>
              </div>
              <div>
                <p className="truncate text-2xl font-bold">
                  {number(totals.episodes)}
                </p>
                <p className="text-xs text-base-content/60">
                  {t('wrapped.episodes')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-base-300">
                <span
                  className="bg-primary"
                  style={{ width: `${readingShare}%` }}
                />
                <span
                  className="bg-secondary"
                  style={{ width: `${100 - readingShare}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-base-content/70">
                <span>
                  {t('wrapped.reading')} · {number(hours(totals.readingTime))}h
                </span>
                <span>
                  {t('wrapped.listening')} ·{' '}
                  {number(hours(totals.listeningTime))}h
                </span>
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-4 @3xl:col-span-2 @5xl:col-span-1 @5xl:grid-cols-1">
            <Panel title={t('wrapped.percentile')}>
              <p className="text-2xl font-black text-primary @3xl:text-3xl">
                {topPercent !== null
                  ? t('wrapped.topPercent', { percent: topPercent })
                  : '-'}
              </p>
              <p className="text-xs text-base-content/60">
                {t('wrapped.percentileHint')}
              </p>
            </Panel>
            <Panel title={t('wrapped.vsLastYear')}>
              <p
                className={`text-2xl font-black @3xl:text-3xl ${delta !== null && delta < 0 ? 'text-error' : 'text-success'}`}
              >
                {delta !== null
                  ? `${delta > 0 ? '+' : ''}${delta}%`
                  : t('wrapped.firstYear')}
              </p>
              <p className="text-xs text-base-content/60">
                {t('wrapped.vsLastYearHint')}
              </p>
            </Panel>
          </div>

          <TopMedia
            title={t('wrapped.topWatched')}
            items={stats.topWatched}
            blurAdult={blurAdult}
            empty={t('wrapped.nothingWatched')}
          />
          <TopMedia
            title={t('wrapped.topRead')}
            items={stats.topRead}
            blurAdult={blurAdult}
            empty={t('wrapped.nothingRead')}
          />

          <Panel title={t('wrapped.firstLast')}>
            <div className="flex gap-3 @3xl:flex-col @5xl:flex-row">
              <FirstLastMedia
                label={t('wrapped.first')}
                media={stats.firstMedia}
                blurAdult={blurAdult}
              />
              <FirstLastMedia
                label={t('wrapped.last')}
                media={stats.lastMedia}
                blurAdult={blurAdult}
              />
            </div>
          </Panel>

          <Panel
            title={t('wrapped.monthly')}
            className="@3xl:order-1 @3xl:col-span-2 @5xl:order-none"
          >
            <MonthlyChart
              monthly={stats.monthly}
              typeOrder={stats.byType.map((row) => row.type)}
              locale={locale}
            />
          </Panel>

          <Panel title={t('wrapped.mediaTypes')}>
            <TypeBreakdown byType={stats.byType} />
          </Panel>

          {stats.genres.length > 0 && (
            <Panel
              title={t('wrapped.genres')}
              className="@3xl:order-2 @3xl:col-span-2 @5xl:order-none @5xl:col-span-3"
            >
              <GenreCloud genres={stats.genres} />
            </Panel>
          )}
        </div>
      </div>
    </article>
  );
}

export default function WrappedScreen() {
  const { user, username } = useOutletContext<OutletProfileContextType>();
  const { t } = useTranslation('profile');
  const loggedUser = useUserDataStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year')) || undefined;
  const [exporting, setExporting] = useState<'download' | 'share' | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['wrapped', username, yearParam ?? 'current'],
    queryFn: () => getWrappedFn(username, yearParam),
    enabled: Boolean(username),
    staleTime: 5 * 60_000,
    retry: false,
    meta: { silentError: true },
  });

  const blurAdult = loggedUser?.settings?.blurAdultContent ?? false;
  const featureFlags = useFeatureFlags();
  const isAdminPreview =
    !featureFlags.wrapped && Boolean(loggedUser?.roles?.includes('admin'));
  const fileName = useMemo(
    () => `nihongo-wrapped-${username}-${stats?.year ?? ''}.png`,
    [username, stats?.year]
  );

  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    const mode = exporting;
    // Wait for the hidden copy to lay out and for its images to load.
    const timer = window.setTimeout(async () => {
      const node = exportRef.current;
      if (!node || cancelled) return;
      try {
        const release = await inlineExportImages(node);
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          imagePlaceholder: TRANSPARENT_PIXEL,
        }).finally(release);
        const blob = await (await fetch(dataUrl)).blob();
        if (mode === 'download') {
          downloadStatsImage(blob, fileName);
        } else {
          const result = await shareStatsImage(
            blob,
            fileName,
            t('wrapped.shareTitle', { username, year: stats?.year }),
            t('wrapped.shareText', { username, year: stats?.year })
          );
          if (result === 'downloaded')
            toast.info(t('wrapped.downloadedInstead'));
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          toast.error(t('wrapped.exportFailed'));
        }
      } finally {
        if (!cancelled) setExporting(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exporting, fileName, stats?.year, t, username]);

  if (isLoading) return <PageLoader />;
  if (isError || !stats) {
    return (
      <div className="flex justify-center px-4 py-12">
        <p className="text-base-content/60">{t('wrapped.unavailable')}</p>
      </div>
    );
  }

  const card = (
    <WrappedCard
      stats={stats}
      username={username}
      avatar={user?.avatar}
      banner={user?.banner}
      blurAdult={blurAdult}
    />
  );

  return (
    <div className="flex justify-center px-4 py-4 sm:px-6 sm:py-8">
      <div className="flex w-full max-w-7xl flex-col gap-4">
        {isAdminPreview && (
          <div role="status" className="alert alert-info alert-soft">
            {t('wrapped.adminPreview')}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DropdownSelect
            className="select select-sm w-32"
            value={String(stats.year)}
            onChange={(event) => setSearchParams({ year: event.target.value })}
            aria-label={t('wrapped.year')}
          >
            {stats.availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </DropdownSelect>
          {loggedUser && (
            <div className="flex gap-2">
              {!isNativeApp() && (
                <Button
                  size="sm"
                  appearance="outline"
                  onClick={() => setExporting('download')}
                  disabled={exporting !== null}
                  loading={exporting === 'download'}
                >
                  <Download className="h-4 w-4" />
                  {t('wrapped.download')}
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                onClick={() => setExporting('share')}
                disabled={exporting !== null}
                loading={exporting === 'share'}
              >
                <Share2 className="h-4 w-4" />
                {t('wrapped.share')}
              </Button>
            </div>
          )}
        </div>
        {card}
      </div>
      {exporting &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed left-[-10000px] top-0"
            style={{ width: EXPORT_WIDTH }}
          >
            <div ref={exportRef} className="bg-base-200 p-6">
              {card}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
