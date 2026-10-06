import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import { ListPlus, Trash2 } from 'lucide-react';
import {
  addMediaListEntryFn,
  createMediaListFn,
  getMediaListFn,
  getMyMediaListsFn,
} from '../api/listsApi';
import {
  removeMediaFromImmersionListFn,
  updateMediaCompletionStatusFn,
} from '../api/trackerApi';
import type { IMediaDocument } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  mediaSelectionKey,
  runMediaBatch,
  type MediaStatus,
} from '../utils/immersionList';
import Button from './ui/Button';
import DropdownSelect from './ui/DropdownSelect';
import Field from './ui/Field';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';

type BatchAction =
  | { kind: 'status'; status: MediaStatus }
  | { kind: 'list'; listId: string }
  | { kind: 'create'; title: string }
  | { kind: 'remove' };

interface BatchActionsProps {
  username: string;
  selectedMedia: IMediaDocument[];
  hiddenCount: number;
  statusOptions: { value: MediaStatus; label: string }[];
  onComplete: (keys: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}

export default function ImmersionListBatchActions({
  username,
  selectedMedia,
  hiddenCount,
  statusOptions,
  onComplete,
  onBusyChange,
}: BatchActionsProps) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MediaStatus>('in_progress');
  const [modal, setModal] = useState<'list' | 'remove' | null>(null);
  const [title, setTitle] = useState('');
  const lists = useQuery({
    queryKey: ['myMediaLists'],
    queryFn: () => getMyMediaListsFn(),
    enabled: modal === 'list',
  });

  const batch = useMutation({
    mutationFn: async (action: BatchAction) => {
      const items = [...selectedMedia];
      const ownerId = useUserDataStore.getState().user?._id;
      if (!ownerId) throw new Error('The batch requires an authenticated owner');
      const applyToSelected = (update: (media: IMediaDocument) => Promise<unknown>) =>
        runMediaBatch(items, (media) => {
          if (useUserDataStore.getState().user?._id !== ownerId) {
            throw new Error('The account changed during the batch');
          }
          return update(media);
        });
      if (action.kind === 'create') {
        await createMediaListFn({
          title: action.title,
          entries: items.map((media) => ({
            mediaId: media.contentId,
            mediaType: media.type,
          })),
        });
        return {
          succeeded: items.map(mediaSelectionKey),
          failed: [],
          firstError: undefined,
        };
      }
      if (action.kind === 'list') {
        const { list } = await getMediaListFn(action.listId);
        const existing = new Set(
          (list.entries ?? []).map((entry) => `${entry.mediaType}:${entry.mediaId}`),
        );
        return applyToSelected((media) =>
          existing.has(mediaSelectionKey(media))
            ? Promise.resolve()
            : addMediaListEntryFn(action.listId, {
                mediaId: media.contentId,
                mediaType: media.type,
              }),
        );
      }
      return applyToSelected((media) =>
        action.kind === 'status'
          ? updateMediaCompletionStatusFn({
              mediaId: media.contentId,
              type: media.type,
              status: action.status,
            })
          : removeMediaFromImmersionListFn({
              mediaId: media.contentId,
              type: media.type,
              deleteLogs: false,
            }),
      );
    },
    onMutate: () => onBusyChange(true),
    onSuccess: (result, action) => {
      onComplete(result.succeeded);
      void queryClient.invalidateQueries({ queryKey: ['ImmersionList'] });
      void queryClient.invalidateQueries({
        queryKey: ['recentLogs', username],
      });
      if (action.kind === 'list' || action.kind === 'create') {
        void queryClient.invalidateQueries({ queryKey: ['myMediaLists'] });
        void queryClient.invalidateQueries({ queryKey: ['mediaLists'] });
        void queryClient.invalidateQueries({ queryKey: ['userMediaLists'] });
        void queryClient.invalidateQueries({ queryKey: ['mediaList'] });
      }
      if (result.failed.length) {
        toast.error(
          t('list.batch.partialFailure', {
            succeeded: result.succeeded.length,
            failed: result.failed.length,
          }),
        );
        if (
          result.firstError instanceof AxiosError &&
          result.firstError.response?.data?.message
        ) {
          toast.error(result.firstError.response.data.message);
        }
      } else {
        toast.success(
          t('list.batch.success', { count: result.succeeded.length }),
        );
        setModal(null);
        setTitle('');
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof AxiosError
          ? (error.response?.data?.message ?? t('list.batch.failed'))
          : t('list.batch.failed'),
      ),
    onSettled: () => onBusyChange(false),
  });
  const disabled = batch.isPending || selectedMedia.length === 0;

  return (
    <>
      <div className="flex flex-col gap-3 border-t border-base-300 pt-4">
        <p className="text-sm font-medium" aria-live="polite">
          {t('list.batch.selected', { count: selectedMedia.length })}
          {hiddenCount > 0 && (
            <span className="text-base-content/60 ml-2">
              {t('list.batch.hidden', { count: hiddenCount })}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('list.setStatus')}>
            {(id) => (
              <DropdownSelect
                id={id}
                value={status}
                disabled={disabled}
                onChange={(event) =>
                  setStatus(event.target.value as MediaStatus)
                }
                className="btn-sm w-full sm:w-48"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </DropdownSelect>
            )}
          </Field>
          <Button
            variant="primary"
            size="sm"
            disabled={disabled}
            loading={batch.isPending && batch.variables?.kind === 'status'}
            onClick={() => batch.mutate({ kind: 'status', status })}
          >
            {t('list.batch.applyStatus')}
          </Button>
          <Button
            appearance="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setModal('list')}
          >
            <ListPlus className="w-4 h-4" />
            {t('header.addToList')}
          </Button>
          <Button
            variant="error"
            appearance="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setModal('remove')}
          >
            <Trash2 className="w-4 h-4" />
            {t('header.remove')}
          </Button>
        </div>
      </div>
      <Modal
        open={modal === 'list'}
        title={t('list.batch.addTitle', { count: selectedMedia.length })}
        onClose={() => setModal(null)}
        dismissable={!batch.isPending}
      >
        {lists.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : lists.isError ? (
          <div className="space-y-3">
            <p className="text-error" role="alert">
              {t('list.batch.listsFailed')}
            </p>
            <Button size="sm" onClick={() => void lists.refetch()}>
              {t('list.batch.retry')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {lists.data?.lists.length === 0 && (
              <p className="text-sm text-base-content/60">
                {t('addToList.empty')}
              </p>
            )}
            {lists.data?.lists.map((list) => (
              <Button
                key={list._id}
                appearance="ghost"
                className="justify-start"
                disabled={disabled}
                loading={
                  batch.isPending &&
                  batch.variables?.kind === 'list' &&
                  batch.variables.listId === list._id
                }
                onClick={() => batch.mutate({ kind: 'list', listId: list._id })}
              >
                <span className="truncate">{list.title}</span>
              </Button>
            ))}
          </div>
        )}
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim() && !disabled)
              batch.mutate({ kind: 'create', title: title.trim() });
          }}
        >
          <Field label={t('list.batch.newList')}>
            {(id) => (
              <input
                id={id}
                className="input focus:input-primary w-full"
                value={title}
                maxLength={100}
                disabled={batch.isPending}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('addToList.newTitlePlaceholder')}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={disabled || !title.trim()}
            loading={batch.isPending && batch.variables?.kind === 'create'}
          >
            {t('list.batch.createList')}
          </Button>
        </form>
      </Modal>
      <Modal
        open={modal === 'remove'}
        title={t('list.batch.removeTitle', { count: selectedMedia.length })}
        onClose={() => setModal(null)}
        dismissable={!batch.isPending}
        actions={
          <>
            <Button
              appearance="ghost"
              disabled={batch.isPending}
              onClick={() => setModal(null)}
            >
              {t('list.batch.cancel')}
            </Button>
            <Button
              variant="error"
              disabled={disabled}
              loading={batch.isPending}
              onClick={() => batch.mutate({ kind: 'remove' })}
            >
              {t('header.remove')}
            </Button>
          </>
        }
      >
        <p>{t('list.batch.removeBody')}</p>
      </Modal>
    </>
  );
}
