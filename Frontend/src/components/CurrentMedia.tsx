import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { Link } from 'react-router-dom';
import { getCurrentMediaFn } from '../api/trackerApi';
import { ICurrentMediaItem } from '../types';
import { useDateFormatting } from '../hooks/useDateFormatting';
import OfflineImage from './OfflineImage';
import ProgressBar from './ProgressBar';
import { Skeleton } from './ui/Skeleton';

const TYPE_LABELS: Record<ICurrentMediaItem['type'], ParseKeys<'profile'>> = {
  anime: 'favoritesWidget.types.anime',
  manga: 'favoritesWidget.types.manga',
  'light-novel': 'favoritesWidget.types.light-novel',
  vn: 'favoritesWidget.types.vn',
  game: 'favoritesWidget.types.game',
  movie: 'favoritesWidget.types.movie',
  'tv show': 'favoritesWidget.types.tvShow',
};

const PROGRESS_LABELS: Record<
  NonNullable<ICurrentMediaItem['progress']>['unit'],
  ParseKeys<'profile'>
> = {
  episodes: 'currentMediaWidget.episodes',
  chars: 'currentMediaWidget.chars',
  minutes: 'currentMediaWidget.minutes',
};

function mediaTitle(item: ICurrentMediaItem) {
  return (
    item.title?.contentTitleNative ||
    item.title?.contentTitleEnglish ||
    item.title?.contentTitleRomaji ||
    item.mediaId
  );
}

function CurrentMediaRow({
  item,
  blurAdult,
}: {
  item: ICurrentMediaItem;
  blurAdult: boolean;
}) {
  const { t } = useTranslation('profile');
  const { formatNumber, formatRelativeDate } = useDateFormatting();
  const cover = item.contentImage || item.coverImage;
  const blur =
    blurAdult && (item.type === 'vn' ? item.isAdultImage : item.isAdult);
  const title = mediaTitle(item);
  const { progress } = item;

  return (
    <Link
      to={`/${item.type}/${item.mediaId}`}
      className="flex items-center gap-3 rounded-box p-2 -mx-2 hover:bg-base-200 focus-visible:bg-base-200 focus:outline-none"
    >
      <div className="w-12 shrink-0 aspect-[3/4] rounded-box overflow-hidden bg-base-300">
        {cover && (
          <OfflineImage
            src={cover}
            alt=""
            loading="lazy"
            className={`w-full h-full object-cover ${blur ? 'blur-md' : ''}`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium truncate" title={title}>
          {title}
        </p>
        <p className="text-xs text-base-content/60 truncate">
          {t(TYPE_LABELS[item.type])} ·{' '}
          {t('currentMediaWidget.lastLogged', {
            date: formatRelativeDate(item.lastLogDate),
          })}
        </p>
        {progress && (
          <div className="flex items-center gap-2">
            <ProgressBar
              progress={Math.min(progress.current, progress.total)}
              maxProgress={progress.total}
            />
            <span className="text-xs text-base-content/70 whitespace-nowrap">
              {t(PROGRESS_LABELS[progress.unit], {
                current: formatNumber(progress.current),
                total: formatNumber(progress.total),
              })}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function CurrentMedia({
  username,
  blurAdult,
}: {
  username: string;
  blurAdult: boolean;
}) {
  const { t } = useTranslation('profile');
  const { data, isLoading } = useQuery({
    queryKey: ['currentMedia', username],
    queryFn: () => getCurrentMediaFn(username),
    staleTime: 60_000,
    // Private immersion activity returns 403. The widget then stays hidden.
    meta: { silentError: true },
    retry: false,
  });

  if (!isLoading && !data?.length) return null;

  return (
    <div className="card w-full surface">
      <div className="card-body w-full p-4 sm:p-6 gap-2">
        <h2 className="card-title mb-1">{t('currentMediaWidget.title')}</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {data?.map((item) => (
              <CurrentMediaRow
                key={`${item.type}:${item.mediaId}`}
                item={item}
                blurAdult={blurAdult}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
