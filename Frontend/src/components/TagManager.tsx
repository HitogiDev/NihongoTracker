import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserTagsByUsernameFn,
  createTagFn,
  updateTagFn,
  deleteTagFn,
} from '../api/trackerApi';
import { ITag } from '../types';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import Wheel from '@uiw/react-color-wheel';
import { useUserDataStore } from '../store/userData';

export default function TagManager() {
  const { t } = useTranslation('settings');
  const [editingTag, setEditingTag] = useState<ITag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<ITag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();

  // Determine max tags based on Patreon tier
  const getMaxTags = () => {
    const tier = user?.patreon?.tier;
    if (tier === 'consumer') return 25;
    if (tier === 'enthusiast') return 15;
    if (tier === 'donator') return 7;
    return 3; // Default for non-patrons
  };

  const maxTags = getMaxTags();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', user?.username],
    queryFn: () => getUserTagsByUsernameFn(user?.username || ''),
    enabled: !!user?.username,
  });

  const createMutation = useMutation({
    mutationFn: createTagFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success(t('tags.manager.created'));
      (
        document.getElementById('create_tag_modal') as HTMLDialogElement
      )?.close();
      setEditName('');
      setEditColor('#3b82f6');
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || t('tags.manager.createFailed')
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; color?: string };
    }) => updateTagFn(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success(t('tags.manager.updated'));
      (document.getElementById('edit_tag_modal') as HTMLDialogElement)?.close();
      setEditingTag(null);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || t('tags.manager.updateFailed')
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTagFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast.success(t('tags.manager.deleted'));
      setTagToDelete(null);
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(
        error.response?.data?.message || t('tags.manager.deleteFailed')
      );
    },
  });

  const handleCreateTag = () => {
    if (!editName.trim()) {
      toast.error(t('tags.manager.nameRequired'));
      return;
    }
    createMutation.mutate({ name: editName.trim(), color: editColor });
  };

  const handleUpdateTag = () => {
    if (!editingTag) return;
    if (!editName.trim()) {
      toast.error(t('tags.manager.nameRequired'));
      return;
    }
    updateMutation.mutate({
      id: editingTag._id,
      data: { name: editName.trim(), color: editColor },
    });
  };

  const handleDeleteTag = (tag: ITag) => {
    setTagToDelete(tag);
  };

  const handleConfirmDeleteTag = () => {
    if (!tagToDelete?._id) return;
    deleteMutation.mutate(tagToDelete._id);
  };

  const openCreateModal = () => {
    setEditName('');
    setEditColor('#3b82f6');
    (
      document.getElementById('create_tag_modal') as HTMLDialogElement
    )?.showModal();
  };

  const openEditModal = (tag: ITag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
    (
      document.getElementById('edit_tag_modal') as HTMLDialogElement
    )?.showModal();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('tags.manager.title')}</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={openCreateModal}
            disabled={tags.length >= maxTags}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t('tags.manager.createTag')}
          </button>
        </div>

        {tags.length >= maxTags && (
          <div className="alert alert-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              {t('tags.manager.maxReached', { max: maxTags })}
              {!user?.patreon?.tier && (
                <span className="ml-1">
                  <Trans
                    i18nKey="tags.manager.upgradeSuffix"
                    ns="settings"
                    components={{
                      link: <a href="/support" className="link" />,
                    }}
                  />
                </span>
              )}
            </span>
          </div>
        )}

        {/* Tags List */}
        <div className="space-y-2">
          {tags.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p>{t('tags.manager.empty')}</p>
            </div>
          ) : (
            tags.map((tag) => (
              <div key={tag._id} className="card bg-base-200">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="badge badge-lg"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          border: `2px solid ${tag.color}`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => openEditModal(tag)}
                        title={t('tags.manager.editAction')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-square text-error"
                        onClick={() => handleDeleteTag(tag)}
                        title={t('tags.manager.deleteTag')}
                        disabled={deleteMutation.isPending}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Tag Modal */}
      <dialog id="create_tag_modal" className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">
            {t('tags.manager.createNew')}
          </h3>
          <div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('tags.manager.tagName')}</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder={t('tags.manager.namePlaceholder')}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
                autoFocus
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('tags.manager.tagColor')}</span>
              </label>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="badge badge-lg"
                  style={{
                    backgroundColor: `${editColor}20`,
                    border: `2px solid ${editColor}`,
                    color: editColor,
                  }}
                >
                  {editName || t('tags.manager.preview')}
                </div>
                <div style={{ width: '200px', height: '200px' }}>
                  <Wheel
                    color={editColor}
                    onChange={(color: { hex: string }) =>
                      setEditColor(color.hex)
                    }
                  />
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-center"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder={t('tags.manager.colorPlaceholder')}
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  (
                    document.getElementById(
                      'create_tag_modal'
                    ) as HTMLDialogElement
                  )?.close()
                }
              >
                {t('tags.manager.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateTag}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  t('tags.manager.create')
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Edit Tag Modal */}
      <dialog id="edit_tag_modal" className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">
            {t('tags.manager.editTag')}
          </h3>
          <div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('tags.manager.tagName')}</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder={t('tags.manager.namePlaceholder')}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
                autoFocus
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('tags.manager.tagColor')}</span>
              </label>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="badge badge-lg"
                  style={{
                    backgroundColor: `${editColor}20`,
                    border: `2px solid ${editColor}`,
                    color: editColor,
                  }}
                >
                  {editName || t('tags.manager.preview')}
                </div>
                <div style={{ width: '200px', height: '200px' }}>
                  <Wheel
                    color={editColor}
                    onChange={(color: { hex: string }) =>
                      setEditColor(color.hex)
                    }
                  />
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-center"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder={t('tags.manager.colorPlaceholder')}
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  (
                    document.getElementById(
                      'edit_tag_modal'
                    ) as HTMLDialogElement
                  )?.close()
                }
              >
                {t('tags.manager.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpdateTag}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {tagToDelete && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">
              {t('tags.manager.deleteTitle')}
            </h3>
            <p className="text-base-content/70 mb-4">
              This will remove the tag "{tagToDelete.name}" from all logs.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setTagToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                {t('tags.manager.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={handleConfirmDeleteTag}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    {t('tags.manager.deleting')}
                  </>
                ) : (
                  t('tags.manager.deleteTag')
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => setTagToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              close
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}
