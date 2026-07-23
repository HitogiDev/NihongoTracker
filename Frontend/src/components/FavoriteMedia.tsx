import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Info, NotebookPen, Pencil, PencilLine, Plus, Save, X } from 'lucide-react';
import {
  updateFavoritesFn,
  IFavoriteInput,
} from '../api/trackerApi';
import {
  IFavoriteEntry,
  MediaListMediaType,
  SearchResultType,
} from '../types';
import FavoritePickerModal from './FavoritePickerModal';

const MAX_FAVORITES = 50;

// Display order + labels for the grouped view.
const TYPE_ORDER: MediaListMediaType[] = [
  'anime',
  'manga',
  'reading',
  'vn',
  'game',
  'video',
  'movie',
  'tv show',
];

const TYPE_LABELS: Record<MediaListMediaType, string> = {
  anime: 'Anime',
  manga: 'Manga',
  reading: 'Light Novels',
  vn: 'Visual Novels',
  game: 'Games',
  video: 'Videos',
  movie: 'Movies',
  'tv show': 'TV Shows',
};

function favoriteKey(fav: { mediaType: string; mediaId: string }) {
  return `${fav.mediaType}:${fav.mediaId}`;
}

function shouldBlurCover(media: IFavoriteEntry['media'], blurAdult: boolean) {
  if (!media || !blurAdult) return false;
  return media.type === 'vn' ? (media.isAdultImage ?? false) : media.isAdult;
}

function mediaTitle(media: IFavoriteEntry['media']) {
  if (!media) return 'Unknown';
  return (
    media.title.contentTitleNative ||
    media.title.contentTitleEnglish ||
    media.title.contentTitleRomaji ||
    'Unknown'
  );
}

// ─── Read-only cover ─────────────────────────────────────────────────────────

type ShowFn = (fav: IFavoriteEntry, anchor: HTMLElement | null) => void;

function FavoriteCover({
  fav,
  blurAdult,
  onShow,
  onHide,
}: {
  fav: IFavoriteEntry;
  blurAdult: boolean;
  onShow: ShowFn;
  onHide: () => void;
}) {
  const media = fav.media;
  const blur = shouldBlurCover(media, blurAdult);
  const cover = media?.contentImage || media?.coverImage;
  const anchorRef = useRef<HTMLDivElement>(null);

  const body = (
    <div
      ref={anchorRef}
      className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-base-300 ring-1 ring-base-content/10"
    >
      {cover ? (
        <img
          src={cover}
          alt={mediaTitle(media)}
          loading="lazy"
          className={`w-full h-full object-cover ${blur ? 'blur-md' : ''}`}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-xs text-base-content/40 p-2 text-center">
          {mediaTitle(media)}
        </div>
      )}

      {/* Info / note button — the tap target for touch devices */}
      <button
        type="button"
        className={`absolute top-1 right-1 rounded-full p-1 shadow ${
          fav.note
            ? 'bg-primary text-primary-content'
            : 'bg-base-100/85 text-base-content/70'
        }`}
        aria-label={fav.note ? 'View note and info' : 'View info'}
        onClick={(e) => {
          // Don't navigate the wrapping Link; toggle the popover instead.
          e.preventDefault();
          e.stopPropagation();
          onShow(fav, anchorRef.current);
        }}
      >
        {fav.note ? (
          <NotebookPen className="w-3 h-3" />
        ) : (
          <Info className="w-3 h-3" />
        )}
      </button>
    </div>
  );

  const handlers = {
    className: 'group relative block w-24 shrink-0 focus:outline-none',
    onMouseEnter: () => onShow(fav, anchorRef.current),
    onMouseLeave: onHide,
    onFocus: () => onShow(fav, anchorRef.current),
    onBlur: onHide,
  };

  return media ? (
    <Link to={`/${media.type}/${media.contentId}`} {...handlers}>
      {body}
    </Link>
  ) : (
    <div tabIndex={0} {...handlers}>
      {body}
    </div>
  );
}

// ─── Shared viewport-clamped popover ─────────────────────────────────────────

function FavoritePopover({
  active,
  onClose,
}: {
  active: { fav: IFavoriteEntry; rect: DOMRect } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const close = () => onClose();
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest('[data-fav-popover]') && !el.closest('button[aria-label^="View"]'))
        onClose();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [active, onClose]);

  if (!active) return null;
  const { fav, rect } = active;
  const media = fav.media;

  const WIDTH = 224;
  const MARGIN = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : WIDTH + MARGIN * 2;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Prefer the right side of the cover; flip to the left when it would overflow.
  let left = rect.right + MARGIN;
  if (left + WIDTH > vw - MARGIN) {
    left = Math.max(MARGIN, rect.left - MARGIN - WIDTH);
  }
  // Align to the cover's top, clamped to the viewport.
  const top = Math.max(MARGIN, Math.min(rect.top, vh - MARGIN));
  const style: React.CSSProperties = {
    left,
    top,
    width: WIDTH,
    maxHeight: vh - top - MARGIN,
    overflowY: 'auto',
  };

  return (
    <div data-fav-popover className="fixed z-50" style={style}>
      <div className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-xl text-left">
        <p className="font-semibold text-sm leading-tight">{mediaTitle(media)}</p>
        {media?.title.contentTitleEnglish &&
          media.title.contentTitleEnglish !== mediaTitle(media) && (
            <p className="text-xs text-base-content/60 mt-0.5">
              {media.title.contentTitleEnglish}
            </p>
          )}
        {media && (
          <span className="badge badge-ghost badge-sm mt-2">
            {TYPE_LABELS[media.type as MediaListMediaType] ?? media.type}
          </span>
        )}
        {media?.genres && media.genres.length > 0 && (
          <p className="text-xs text-base-content/50 mt-1.5">
            {media.genres.slice(0, 3).join(' · ')}
          </p>
        )}
        {fav.note && (
          <blockquote className="mt-2 border-l-2 border-primary pl-2 text-xs italic text-base-content/80 whitespace-pre-wrap">
            {fav.note}
          </blockquote>
        )}
      </div>
    </div>
  );
}

// ─── Editable / sortable cover ───────────────────────────────────────────────

function SortableFavorite({
  fav,
  blurAdult,
  onRemove,
  onEditNote,
}: {
  fav: IFavoriteEntry;
  blurAdult: boolean;
  onRemove: () => void;
  onEditNote: () => void;
}) {
  const id = favoriteKey(fav);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const media = fav.media;
  const blur = shouldBlurCover(media, blurAdult);
  const cover = media?.contentImage || media?.coverImage;

  // Keep a button press from starting a drag on the surrounding card.
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div ref={setNodeRef} style={style} className="w-24 shrink-0">
      {/* Whole card is the drag handle */}
      <div
        className="relative rounded-lg cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-base-300 ring-1 ring-base-content/10">
          {cover ? (
            <img
              src={cover}
              alt={mediaTitle(media)}
              loading="lazy"
              className={`w-full h-full object-cover ${blur ? 'blur-md' : ''}`}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-xs text-base-content/40 p-2 text-center">
              {mediaTitle(media)}
            </div>
          )}
        </div>

        {/* Note */}
        <button
          type="button"
          className={`absolute top-1 left-1 rounded-full p-1 shadow ${
            fav.note
              ? 'bg-primary text-primary-content'
              : 'bg-base-100/80 text-base-content/70'
          }`}
          aria-label="Edit note"
          onPointerDown={stopDrag}
          onClick={onEditNote}
        >
          <PencilLine className="w-3 h-3" />
        </button>

        {/* Remove */}
        <button
          type="button"
          className="absolute top-1 right-1 bg-error text-error-content rounded-full p-0.5 shadow"
          aria-label="Remove favorite"
          onPointerDown={stopDrag}
          onClick={onRemove}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="mt-1 text-xs truncate" title={mediaTitle(media)}>
        {mediaTitle(media)}
      </p>
    </div>
  );
}

// ─── Note modal ──────────────────────────────────────────────────────────────

function NoteModal({
  fav,
  onClose,
  onSave,
}: {
  fav: IFavoriteEntry;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(fav.note ?? '');

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <NotebookPen className="w-5 h-5" />
          Note
        </h3>
        <p className="text-sm text-base-content/60 mt-1 truncate">
          {mediaTitle(fav.media)}
        </p>
        <textarea
          className="textarea textarea-bordered w-full mt-3"
          rows={4}
          maxLength={500}
          placeholder="Why a favorite?"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="text-right text-xs text-base-content/40 mt-1">
          {value.length}/500
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onSave(value);
              onClose();
            }}
          >
            <Save className="w-4 h-4" /> Save note
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

// ─── Main card ───────────────────────────────────────────────────────────────

function FavoriteMedia({
  favorites,
  isOwner,
  username,
  blurAdult,
}: {
  favorites: IFavoriteEntry[];
  isOwner: boolean;
  username: string;
  blurAdult: boolean;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<IFavoriteEntry[]>(favorites);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteEditKey, setNoteEditKey] = useState<string | null>(null);
  const [popover, setPopover] = useState<{
    fav: IFavoriteEntry;
    rect: DOMRect;
  } | null>(null);

  const showPopover: ShowFn = (fav, anchor) => {
    if (!anchor) return;
    setPopover((prev) =>
      prev && favoriteKey(prev.fav) === favoriteKey(fav)
        ? null // tapping the same item's button again closes it
        : { fav, rect: anchor.getBoundingClientRect() }
    );
  };
  const hidePopover = () => setPopover(null);

  // Keep draft in sync when server data changes and we're not editing.
  useEffect(() => {
    if (!isEditing) setDraft(favorites);
  }, [favorites, isEditing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const save = useMutation({
    mutationFn: (entries: IFavoriteInput[]) => updateFavoritesFn(entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', username] });
      setIsEditing(false);
      toast.success('Favorites updated');
    },
    onError: () => toast.error('Could not update favorites'),
  });

  const groups = useMemo(() => {
    return TYPE_ORDER.map((type) => ({
      type,
      items: [...favorites]
        .filter((fav) => fav.mediaType === type)
        .sort((a, b) => a.order - b.order),
    })).filter((group) => group.items.length > 0);
  }, [favorites]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((prev) => {
      const oldIndex = prev.findIndex((f) => favoriteKey(f) === active.id);
      const newIndex = prev.findIndex((f) => favoriteKey(f) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleAdd(media: SearchResultType) {
    setDraft((prev) => {
      const key = `${media.type}:${media.contentId}`;
      if (prev.some((f) => favoriteKey(f) === key)) return prev;
      const entry: IFavoriteEntry = {
        mediaId: media.contentId,
        mediaType: media.type as MediaListMediaType,
        note: undefined,
        order: prev.length,
        media,
      };
      return [...prev, entry];
    });
  }

  function handleSave() {
    const entries: IFavoriteInput[] = draft.map((fav, index) => ({
      mediaId: fav.mediaId,
      mediaType: fav.mediaType,
      note: fav.note?.trim() ? fav.note.trim() : undefined,
      order: index,
    }));
    save.mutate(entries);
  }

  // Hide entirely when there's nothing to show and viewer can't add.
  if (!isOwner && favorites.length === 0) return null;

  const draftKeys = new Set(draft.map((f) => favoriteKey(f)));
  const noteEditFav =
    draft.find((f) => favoriteKey(f) === noteEditKey) ?? null;

  return (
    <div className="card w-full bg-base-100 shadow-sm overflow-visible">
      <div className="card-body w-full p-4 sm:p-6 overflow-visible">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="card-title">Favorites</h2>
          {isOwner &&
            (isEditing ? (
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setDraft(favorites);
                    setIsEditing(false);
                  }}
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={handleSave}
                  disabled={save.isPending}
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            ))}
        </div>

        {isEditing ? (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={draft.map((f) => favoriteKey(f))}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap gap-3">
                  {draft.map((fav) => (
                    <SortableFavorite
                      key={favoriteKey(fav)}
                      fav={fav}
                      blurAdult={blurAdult}
                      onRemove={() =>
                        setDraft((prev) =>
                          prev.filter((f) => favoriteKey(f) !== favoriteKey(fav))
                        )
                      }
                      onEditNote={() => setNoteEditKey(favoriteKey(fav))}
                    />
                  ))}

                  {draft.length < MAX_FAVORITES && (
                    <button
                      type="button"
                      className="w-24 shrink-0 aspect-[3/4] rounded-lg border-2 border-dashed border-base-300 flex flex-col items-center justify-center gap-1 text-base-content/50 hover:border-primary hover:text-primary transition-colors"
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <p className="text-xs text-base-content/50 mt-2">
              {draft.length}/{MAX_FAVORITES} · drag to reorder, tap the note icon
              to add a note.
            </p>
          </>
        ) : favorites.length === 0 ? (
          <p className="text-base-content/70 text-sm">
            {isOwner
              ? 'Add your favorite media to showcase them here.'
              : 'No favorites yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.type}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-2">
                  {TYPE_LABELS[group.type]}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {group.items.map((fav) => (
                    <FavoriteCover
                      key={favoriteKey(fav)}
                      fav={fav}
                      blurAdult={blurAdult}
                      onShow={showPopover}
                      onHide={hidePopover}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FavoritePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAdd}
        existingKeys={draftKeys}
      />

      {!isEditing && <FavoritePopover active={popover} onClose={hidePopover} />}

      {noteEditFav && (
        <NoteModal
          fav={noteEditFav}
          onClose={() => setNoteEditKey(null)}
          onSave={(value) =>
            setDraft((prev) =>
              prev.map((f) =>
                favoriteKey(f) === noteEditKey ? { ...f, note: value } : f
              )
            )
          }
        />
      )}
    </div>
  );
}

export default FavoriteMedia;
