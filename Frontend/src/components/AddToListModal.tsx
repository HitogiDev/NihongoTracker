import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Check, Plus, Lock, ListOrdered } from 'lucide-react';
import {
  addMediaListEntryFn,
  createMediaListFn,
  getMyMediaListsFn,
  removeMediaListEntryFn,
} from '../api/listsApi';
import { MediaListMediaType } from '../types';

interface AddToListModalProps {
  open: boolean;
  mediaId: string;
  mediaType: MediaListMediaType;
  onClose: () => void;
}

function AddToListModal({
  open,
  mediaId,
  mediaType,
  onClose,
}: AddToListModalProps) {
  const queryClient = useQueryClient();
  const [newListTitle, setNewListTitle] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['myMediaLists', mediaId, mediaType],
    queryFn: () => getMyMediaListsFn({ mediaId, mediaType }),
    enabled: open,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['myMediaLists'] });
    void queryClient.invalidateQueries({ queryKey: ['mediaLists'] });
  }

  const toggleEntry = useMutation({
    mutationFn: ({
      listId,
      contains,
    }: {
      listId: string;
      contains: boolean;
    }) =>
      contains
        ? removeMediaListEntryFn(listId, mediaType, mediaId)
        : addMediaListEntryFn(listId, { mediaId, mediaType }),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.message);
    },
    onError: () => toast.error('Could not update the list'),
  });

  const createList = useMutation({
    mutationFn: async (title: string) => {
      const created = await createMediaListFn({
        title,
        entries: [{ mediaId, mediaType }],
      });
      return created;
    },
    onSuccess: () => {
      setNewListTitle('');
      invalidate();
      toast.success('List created with this media');
    },
    onError: () => toast.error('Could not create the list'),
  });

  if (!open) return null;

  const lists = data?.lists ?? [];

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">Add to list</h3>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner" />
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {lists.length === 0 && (
              <p className="text-sm text-base-content/60 py-4">
                You have no lists yet. Create one below.
              </p>
            )}
            {lists.map((list) => (
              <button
                key={list._id}
                type="button"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 text-left"
                disabled={toggleEntry.isPending}
                onClick={() =>
                  toggleEntry.mutate({
                    listId: list._id,
                    contains: !!list.containsMedia,
                  })
                }
              >
                <span
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    list.containsMedia
                      ? 'bg-primary border-primary text-primary-content'
                      : 'border-base-content/30'
                  }`}
                >
                  {list.containsMedia && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">
                    {list.title}
                  </span>
                  <span className="block text-xs text-base-content/60">
                    {list.entryCount} items
                  </span>
                </span>
                {!list.isPublic && (
                  <Lock className="w-4 h-4 text-base-content/40" />
                )}
                {list.isRanked && (
                  <ListOrdered className="w-4 h-4 text-base-content/40" />
                )}
              </button>
            ))}
          </div>
        )}

        <form
          className="join w-full mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const title = newListTitle.trim();
            if (title) createList.mutate(title);
          }}
        >
          <input
            className="input input-bordered join-item flex-1"
            placeholder="New list title"
            maxLength={100}
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary join-item"
            disabled={!newListTitle.trim() || createList.isPending}
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/40" onClick={onClose} />
    </div>
  );
}

export default AddToListModal;
