import { useState, useEffect } from 'react';
import { X, Star } from 'lucide-react';
import { IClubReview } from '../types';

interface EditReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: IClubReview;
  onSubmit: (reviewData: {
    content: string;
    rating?: number;
    hasSpoilers: boolean;
  }) => void;
  isLoading: boolean;
}

export default function EditReviewModal({
  isOpen,
  onClose,
  review,
  onSubmit,
  isLoading,
}: EditReviewModalProps) {
  const [editForm, setEditForm] = useState({
    content: review.content,
    rating: review.rating,
    hasSpoilers: review.hasSpoilers,
  });

  useEffect(() => {
    setEditForm({
      content: review.content,
      rating: review.rating,
      hasSpoilers: review.hasSpoilers,
    });
  }, [review]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm.content.trim()) {
      onSubmit(editForm);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog open className="modal">
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Edit Review</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating */}
          <div>
            <label className="label">
              <span className="label-text font-medium">Rating (Optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="btn btn-ghost btn-xs p-1"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        rating: prev.rating === star ? undefined : star,
                      }))
                    }
                  >
                    {editForm.rating && star <= editForm.rating ? (
                      <Star fill="yellow" strokeWidth={0} />
                    ) : (
                      <Star className="text-base-content/40" />
                    )}
                  </button>
                ))}
              </div>
              {editForm.rating && (
                <span className="text-sm text-base-content/60">
                  {editForm.rating}/5
                </span>
              )}
              {editForm.rating && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    setEditForm((prev) => ({ ...prev, rating: undefined }))
                  }
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="label">
              <span className="label-text font-medium">Review</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-32 resize-none"
              placeholder="Share your thoughts about this media..."
              value={editForm.content}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, content: e.target.value }))
              }
              maxLength={1000}
              required
            />
            <div className="label">
              <span className="label-text-alt text-base-content/60">
                {editForm.content.length}/1000 characters
              </span>
            </div>
          </div>

          {/* Spoilers checkbox */}
          <div>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={editForm.hasSpoilers}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    hasSpoilers: e.target.checked,
                  }))
                }
              />
              <span className="label-text">Contains spoilers</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !editForm.content.trim()}
            >
              {isLoading ? 'Updating...' : 'Update Review'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
