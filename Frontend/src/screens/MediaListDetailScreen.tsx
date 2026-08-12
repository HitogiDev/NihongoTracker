import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  GripVertical,
  Heart,
  Lock,
  Pencil,
  Save,
  Trash,
  X,
} from 'lucide-react';
import {
  cloneMediaListFn,
  deleteMediaListFn,
  getMediaListFn,
  toggleMediaListLikeFn,
  updateMediaListFn,
} from '../api/listsApi';
import { IMediaListEntry } from '../types';
import { useUserDataStore } from '../store/userData';
import { getMediaDisplayTitle } from '../utils/mediaTitle';
import UserAvatar from '../components/UserAvatar';
import MediaListComments from '../components/MediaListComments';
import MediaListFormModal, {
  MediaListFormValues,
} from '../components/MediaListFormModal';
import Loader from '../components/Loader';

interface EntryRowProps {
  entry: IMediaListEntry;
  index: number;
  isRanked: boolean;
  isEditing: boolean;
  noteDraft: string;
  onNoteChange: (value: string) => void;
  onRemove: () => void;
}

function EntryRow({
  entry,
  index,
  isRanked,
  isEditing,
  noteDraft,
  onNoteChange,
  onRemove,
}: EntryRowProps) {
  const { t } = useTranslation('media');
  const id = `${entry.mediaType}:${entry.mediaId}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing });

  const media = entry.media;
  const title = getMediaDisplayTitle(media);

  const content = (
    <>
      {isRanked && (
        <span className="text-lg font-bold text-base-content/40 w-8 text-center shrink-0">
          {index + 1}
        </span>
      )}
      <img
        src={media?.contentImage || media?.coverImage}
        alt=""
        loading="lazy"
        className="w-12 h-16 object-cover rounded shrink-0 bg-base-300"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-base-content/60 capitalize">
          {entry.mediaType}
        </p>
        {!isEditing && entry.note && (
          <p className="text-sm text-base-content/80 mt-1 whitespace-pre-wrap">
            {entry.note}
          </p>
        )}
      </div>
    </>
  );

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="surface p-3 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        {isEditing && (
          <button
            type="button"
            className="btn btn-ghost btn-xs cursor-grab"
            aria-label={t('lists.detail.reorderEntry')}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

        {isEditing || !media ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {content}
          </div>
        ) : (
          <Link
            to={`/${media.type}/${media.contentId}`}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80"
          >
            {content}
          </Link>
        )}

        {isEditing && (
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error"
            onClick={onRemove}
            aria-label={t('lists.detail.removeEntry')}
          >
            <Trash className="w-4 h-4" />
          </button>
        )}
      </div>

      {isEditing && (
        <input
          className="input input-sm w-full"
          placeholder={t('lists.detail.notePlaceholder')}
          maxLength={500}
          value={noteDraft}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      )}
    </li>
  );
}

function MediaListDetailScreen() {
  const { t } = useTranslation('media');
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();

  const [isEditing, setIsEditing] = useState(false);
  const [draftEntries, setDraftEntries] = useState<IMediaListEntry[]>([]);
  const [showMetaModal, setShowMetaModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['mediaList', listId],
    queryFn: () => getMediaListFn(listId as string),
    enabled: !!listId,
  });

  const list = data?.list;
  const isOwner = !!currentUser && list?.user?._id === currentUser._id;

  useEffect(() => {
    if (list?.entries) setDraftEntries(list.entries);
  }, [list?.entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const entryIds = useMemo(
    () => draftEntries.map((entry) => `${entry.mediaType}:${entry.mediaId}`),
    [draftEntries]
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['mediaList', listId] });
    void queryClient.invalidateQueries({ queryKey: ['mediaLists'] });
    void queryClient.invalidateQueries({ queryKey: ['userMediaLists'] });
  }

  const saveEntries = useMutation({
    mutationFn: () =>
      updateMediaListFn(listId as string, {
        entries: draftEntries.map((entry) => ({
          mediaId: entry.mediaId,
          mediaType: entry.mediaType,
          note: entry.note,
        })),
      }),
    onSuccess: () => {
      setIsEditing(false);
      refresh();
      toast.success(t('lists.detail.toast.updated'));
    },
    onError: () => toast.error(t('lists.detail.toast.saveFailed')),
  });

  const saveMeta = useMutation({
    mutationFn: (values: MediaListFormValues) =>
      updateMediaListFn(listId as string, values),
    onSuccess: () => {
      setShowMetaModal(false);
      refresh();
      toast.success(t('lists.detail.toast.updated'));
    },
    onError: () => toast.error(t('lists.detail.toast.updateFailed')),
  });

  const removeList = useMutation({
    mutationFn: () => deleteMediaListFn(listId as string),
    onSuccess: () => {
      toast.success(t('lists.detail.toast.deleted'));
      navigate('/lists');
    },
    onError: () => toast.error(t('lists.detail.toast.deleteFailed')),
  });

  const toggleLike = useMutation({
    mutationFn: () => toggleMediaListLikeFn(listId as string),
    onSuccess: () => refresh(),
    onError: () => toast.error(t('lists.detail.toast.likeFailed')),
  });

  const cloneList = useMutation({
    mutationFn: () => cloneMediaListFn(listId as string),
    onSuccess: (result) => {
      toast.success(t('lists.detail.toast.copied'));
      navigate(`/lists/${result.list._id}`);
    },
    onError: () => toast.error(t('lists.detail.toast.copyFailed')),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraftEntries((prev) => {
      const oldIndex = prev.findIndex(
        (entry) => `${entry.mediaType}:${entry.mediaId}` === active.id
      );
      const newIndex = prev.findIndex(
        (entry) => `${entry.mediaType}:${entry.mediaId}` === over.id
      );
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  if (isLoading) return <Loader />;

  if (error || !list) {
    return (
      <div className="min-h-screen bg-base-200 pt-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-2">
            {t('lists.detail.unavailableTitle')}
          </h1>
          <p className="text-base-content/70">
            {t('lists.detail.unavailableBody')}
          </p>
          <Link to="/lists" className="btn btn-primary mt-6">
            {t('lists.detail.browse')}
          </Link>
        </div>
      </div>
    );
  }

  const entries = isEditing ? draftEntries : (list.entries ?? []);

  return (
    <div className="min-h-screen bg-base-200 pt-28 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-3xl font-bold flex-1 min-w-0 break-words">
              {list.title}
            </h1>
            {!list.isPublic && (
              <span className="badge badge-ghost gap-1">
                <Lock className="w-3 h-3" /> {t('lists.detail.private')}
              </span>
            )}
            {list.isRanked && (
              <span className="badge badge-ghost">
                {t('lists.detail.ranked')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <UserAvatar
              username={list.user?.username}
              avatar={list.user?.avatar}
              containerClassName="w-8 h-8 rounded-full"
            />
            <Link
              to={`/user/${list.user?.username}`}
              className="font-medium hover:underline"
            >
              {list.user?.username}
            </Link>
            <span className="text-sm text-base-content/60">
              · {t('lists.entries', { count: list.entryCount })}
            </span>
          </div>

          {list.description && (
            <p className="mt-4 whitespace-pre-wrap text-base-content/80">
              {list.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <button
              type="button"
              className={`btn btn-sm ${list.isLiked ? 'btn-error' : 'btn-outline'}`}
              disabled={!currentUser || toggleLike.isPending}
              onClick={() => toggleLike.mutate()}
            >
              <Heart
                className={`w-4 h-4 ${list.isLiked ? 'fill-current' : ''}`}
              />
              {list.likeCount}
            </button>

            {currentUser && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={cloneList.isPending}
                onClick={() => cloneList.mutate()}
              >
                <Copy className="w-4 h-4" /> {t('lists.detail.copy')}
              </button>
            )}

            {isOwner && !isEditing && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowMetaModal(true)}
                >
                  <Pencil className="w-4 h-4" /> {t('lists.detail.editDetails')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditing(true)}
                >
                  <GripVertical className="w-4 h-4" />{' '}
                  {t('lists.detail.reorder')}
                </button>
                <button
                  type="button"
                  className="btn btn-error btn-outline btn-sm"
                  onClick={() => removeList.mutate()}
                  disabled={removeList.isPending}
                >
                  <Trash className="w-4 h-4" /> {t('lists.detail.delete')}
                </button>
              </>
            )}

            {isOwner && isEditing && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => saveEntries.mutate()}
                  disabled={saveEntries.isPending}
                >
                  <Save className="w-4 h-4" /> {t('lists.detail.save')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDraftEntries(list.entries ?? []);
                    setIsEditing(false);
                  }}
                >
                  <X className="w-4 h-4" /> {t('lists.detail.cancel')}
                </button>
              </>
            )}
          </div>
        </header>

        {entries.length === 0 ? (
          <p className="text-base-content/60">{t('lists.detail.empty')}</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entryIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-2">
                {entries.map((entry, index) => (
                  <EntryRow
                    key={`${entry.mediaType}:${entry.mediaId}`}
                    entry={entry}
                    index={index}
                    isRanked={list.isRanked}
                    isEditing={isEditing}
                    noteDraft={entry.note ?? ''}
                    onNoteChange={(value) =>
                      setDraftEntries((prev) =>
                        prev.map((item) =>
                          item.mediaId === entry.mediaId &&
                          item.mediaType === entry.mediaType
                            ? { ...item, note: value }
                            : item
                        )
                      )
                    }
                    onRemove={() =>
                      setDraftEntries((prev) =>
                        prev.filter(
                          (item) =>
                            !(
                              item.mediaId === entry.mediaId &&
                              item.mediaType === entry.mediaType
                            )
                        )
                      )
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <MediaListComments
          listId={list._id}
          listOwnerId={list.user?._id}
          currentUserId={currentUser?._id}
        />
      </div>

      <MediaListFormModal
        open={showMetaModal}
        list={list}
        isSubmitting={saveMeta.isPending}
        onClose={() => setShowMetaModal(false)}
        onSubmit={(values) => saveMeta.mutate(values)}
      />
    </div>
  );
}

export default MediaListDetailScreen;
