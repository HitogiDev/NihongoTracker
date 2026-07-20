import { Link } from 'react-router-dom';
import { Heart, Layers, Lock, ListOrdered } from 'lucide-react';
import { IMediaDocument, IMediaList, MediaListMediaType } from '../types';
import UserAvatar from './UserAvatar';

interface MediaListCardProps {
  list: IMediaList;
  showOwner?: boolean;
  /** "stack" is the poster-fan card for grids, "row" the compact profile row. */
  variant?: 'stack' | 'row';
}

/** Plural nouns used to label an entry count, e.g. "30 VNs", "63 films". */
const TYPE_LABELS: Record<MediaListMediaType, [string, string]> = {
  anime: ['anime', 'anime'],
  manga: ['manga', 'manga'],
  reading: ['book', 'books'],
  vn: ['VN', 'VNs'],
  video: ['video', 'videos'],
  movie: ['film', 'films'],
  'tv show': ['show', 'shows'],
  game: ['game', 'games'],
};

function entryLabel(list: IMediaList) {
  const counts = Object.entries(list.entryTypeCounts ?? {}).filter(
    ([, count]) => (count ?? 0) > 0
  );
  const plural = list.entryCount === 1 ? 0 : 1;

  if (counts.length === 1) {
    const labels = TYPE_LABELS[counts[0][0] as MediaListMediaType];
    if (labels) return `${list.entryCount} ${labels[plural]}`;
  }

  return `${list.entryCount} ${list.entryCount === 1 ? 'item' : 'items'}`;
}

interface PosterStackProps {
  posters: IMediaDocument[];
  /** Poster width in px at a full stack; scaled up when fewer posters exist. */
  width: number;
  height: number;
  /** Visible sliver of each overlapped poster, in px at a full stack. */
  reveal: number;
  /** Total stack width, kept constant so every card lines up. */
  totalWidth: number;
}

function PosterStack({
  posters,
  width: baseWidth,
  height,
  reveal: baseReveal,
  totalWidth,
}: PosterStackProps) {
  // Widen the posters so a short stack still spans the card.
  const naturalWidth = baseWidth + Math.max(posters.length - 1, 0) * baseReveal;
  const scale = posters.length > 0 ? totalWidth / naturalWidth : 1;
  const width = baseWidth * scale;
  const reveal = baseReveal * scale;

  return (
    <div
      className="flex overflow-hidden rounded-md bg-base-300"
      style={{ height, width: totalWidth }}
    >
      {posters.length === 0 ? (
        <div className="flex items-center justify-center w-full text-base-content/30">
          <Layers style={{ width: height / 4, height: height / 4 }} />
        </div>
      ) : (
        posters.map((media, index) => (
          <img
            key={`${media.type}-${media.contentId}-${index}`}
            src={media.contentImage || media.coverImage}
            alt=""
            loading="lazy"
            className="h-full object-cover shrink-0"
            style={{
              width,
              marginLeft: index === 0 ? 0 : reveal - width,
              zIndex: posters.length - index,
              boxShadow:
                index === 0
                  ? undefined
                  : '-8px 0 14px -4px rgba(0,0,0,0.75), inset 1px 0 0 rgba(255,255,255,0.12)',
            }}
          />
        ))
      )}
    </div>
  );
}

function MediaListCard({
  list,
  showOwner = true,
  variant = 'stack',
}: MediaListCardProps) {
  const posters = (list.preview ?? []).slice(0, 5);
  const owner = typeof list.user === 'object' ? list.user : undefined;

  if (variant === 'row') {
    return (
      <Link
        to={`/lists/${list._id}`}
        className="flex items-center gap-4 py-4 border-b border-base-content/10 group"
      >
        <div className="shrink-0">
          <PosterStack
            posters={posters}
            width={54}
            height={80}
            reveal={26}
            totalWidth={158}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
            {list.title}
          </h3>
          <p className="text-sm text-base-content/60 mt-1 flex items-center gap-2">
            <span>{entryLabel(list)}</span>
            {list.likeCount > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 fill-current text-error" />
                {list.likeCount}
              </span>
            )}
            {!list.isPublic && <Lock className="w-3.5 h-3.5" />}
            {list.isRanked && <ListOrdered className="w-3.5 h-3.5" />}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/lists/${list._id}`} className="block group">
      <div className="transition-transform duration-200 group-hover:-translate-y-0.5">
        <PosterStack
          posters={posters}
          width={118}
          height={176}
          reveal={40}
          totalWidth={278}
        />
      </div>

      <h3 className="mt-3 font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {list.title}
      </h3>

      <div className="mt-1.5 flex items-center gap-2 text-sm text-base-content/60">
        {showOwner && owner && (
          <span className="flex items-center gap-1.5 min-w-0">
            <UserAvatar
              username={owner.username}
              avatar={owner.avatar}
              containerClassName="w-5 h-5 rounded-full shrink-0"
              textClassName="text-[10px] font-semibold"
            />
            <span className="truncate">{owner.username}</span>
          </span>
        )}
        <span className="shrink-0">{entryLabel(list)}</span>
        {list.likeCount > 0 && (
          <span className="flex items-center gap-1 shrink-0">
            <Heart className="w-3.5 h-3.5 fill-current text-error" />
            {list.likeCount}
          </span>
        )}
        {!list.isPublic && <Lock className="w-3.5 h-3.5 shrink-0" />}
        {list.isRanked && <ListOrdered className="w-3.5 h-3.5 shrink-0" />}
      </div>
    </Link>
  );
}

export default MediaListCard;
