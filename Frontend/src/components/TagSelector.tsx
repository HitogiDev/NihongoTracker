import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserTagsByUsernameFn, createTagFn } from '../api/trackerApi';
import { ITag } from '../types';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import Wheel from '@uiw/react-color-wheel';
import { useUserDataStore } from '../store/userData';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tagIds: string[]) => void;
  label?: string;
}

export default function TagSelector({
  selectedTags,
  onChange,
  label = 'Tags',
}: TagSelectorProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();

  const getQuickCreateModal = () =>
    document.getElementById(
      'quick_create_tag_modal'
    ) as HTMLDialogElement | null;

  const closeQuickCreateModal = () => {
    getQuickCreateModal()?.close();
  };

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
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag created successfully');
      // Auto-select the newly created tag
      onChange([...selectedTags, newTag._id]);
      closeQuickCreateModal();
      setNewTagName('');
      setNewTagColor('#3b82f6');
    },
    onError: (error: AxiosError<{ message: string }>) => {
      toast.error(error.response?.data?.message || 'Failed to create tag');
    },
  });

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTags, tagId]);
    }
  };

  const handleQuickCreate = () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }
    createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const openQuickCreateModal = () => {
    setNewTagName('');
    setNewTagColor('#3b82f6');
    getQuickCreateModal()?.showModal();
  };

  if (isLoading) {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
        <div className="flex gap-2">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="text-sm text-base-content/60">Loading tags...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="form-control">
        <label className="label">
          <span className="label-text">{label}</span>
          {selectedTags.length > 0 && (
            <span className="label-text-alt text-base-content/60">
              {selectedTags.length} selected
            </span>
          )}
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag: ITag) => {
            const isSelected = selectedTags.includes(tag._id);
            return (
              <button
                key={tag._id}
                type="button"
                className={`badge badge-lg cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-offset-2' : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: isSelected ? tag.color : `${tag.color}20`,
                  border: `2px solid ${tag.color}`,
                  color: isSelected ? '#fff' : tag.color,
                }}
                onClick={() => toggleTag(tag._id)}
              >
                {tag.name}
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}

          {/* Quick Create Button */}
          <div
            className={tags.length >= maxTags ? 'tooltip' : ''}
            data-tip={
              tags.length >= maxTags
                ? user?.patreon?.tier
                  ? `You've reached the maximum of ${maxTags} tags for your tier`
                  : `You've reached the maximum of ${maxTags} tags. Upgrade to Patreon for more!`
                : undefined
            }
          >
            <button
              type="button"
              className="btn btn-square btn-sm btn-outline btn-primary"
              onClick={openQuickCreateModal}
              disabled={tags.length >= maxTags}
              title={tags.length < maxTags ? 'Create new tag' : undefined}
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
            </button>
          </div>
        </div>

        {tags.length === 0 && (
          <p className="text-sm text-base-content/60 mt-2">
            No tags yet. Click the + button to create your first tag!
          </p>
        )}
      </div>

      {/* Quick Create Tag Modal */}
      <dialog id="quick_create_tag_modal" className="modal">
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">Create New Tag</h3>
          <div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Tag Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="e.g., Study, Fun, Practice"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                maxLength={30}
                autoFocus
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Tag Color</span>
              </label>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="badge badge-lg"
                  style={{
                    backgroundColor: `${newTagColor}20`,
                    border: `2px solid ${newTagColor}`,
                    color: newTagColor,
                  }}
                >
                  {newTagName || 'Preview'}
                </div>
                <div style={{ width: '200px', height: '200px' }}>
                  <Wheel
                    color={newTagColor}
                    onChange={(color: { hex: string }) =>
                      setNewTagColor(color.hex)
                    }
                  />
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full text-center"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeQuickCreateModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleQuickCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Create & Add'
                )}
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          onClick={closeQuickCreateModal}
          aria-label="Close"
        >
          close
        </button>
      </dialog>
    </>
  );
}
