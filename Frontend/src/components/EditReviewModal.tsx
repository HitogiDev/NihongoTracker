import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Type,
  Code,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  EyeOff,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { IMediaReview } from '../types';
import { renderMarkdownWithSpoilers } from '../utils/markdown';

const REVIEW_MAX_LENGTH = 5000;
const REVIEW_SUMMARY_MIN_LENGTH = 20;
const REVIEW_SUMMARY_MAX_LENGTH = 150;

interface EditReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: IMediaReview;
  onSubmit: (reviewData: {
    summary: string;
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
  const reviewTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [editForm, setEditForm] = useState({
    summary: review.summary,
    content: review.content,
    rating: review.rating,
  });

  useEffect(() => {
    setEditForm({
      summary: review.summary,
      content: review.content,
      rating: review.rating,
    });
  }, [review]);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedSummary = editForm.summary.trim();
    const trimmedContent = editForm.content.trim();

    if (trimmedSummary.length < REVIEW_SUMMARY_MIN_LENGTH) {
      toast.error(
        `Summary must be at least ${REVIEW_SUMMARY_MIN_LENGTH} characters.`
      );
      return;
    }

    if (!trimmedContent) {
      toast.error('Review content is required.');
      return;
    }

    if (editForm.content.length > REVIEW_MAX_LENGTH) {
      toast.error(
        `Review content must be ${REVIEW_MAX_LENGTH} characters or less.`
      );
      return;
    }

    onSubmit({ ...editForm, hasSpoilers: review.hasSpoilers });
  }

  const needsLineBreak = useCallback(() => {
    const textarea = reviewTextareaRef.current;
    if (!textarea) return false;
    const selectionStart = textarea.selectionStart ?? editForm.content.length;
    if (selectionStart === 0) return false;
    return editForm.content[selectionStart - 1] !== '\n';
  }, [editForm.content]);

  const insertSnippet = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const textarea = reviewTextareaRef.current;
      if (!textarea) return;

      const selectionStart = textarea.selectionStart ?? editForm.content.length;
      const selectionEnd = textarea.selectionEnd ?? editForm.content.length;
      const selectedText =
        selectionStart !== selectionEnd
          ? editForm.content.slice(selectionStart, selectionEnd)
          : placeholder;

      const newContent =
        editForm.content.slice(0, selectionStart) +
        prefix +
        selectedText +
        suffix +
        editForm.content.slice(selectionEnd);

      setEditForm((prev) => ({ ...prev, content: newContent }));

      requestAnimationFrame(() => {
        textarea.focus();
        const startPos = selectionStart + prefix.length;
        const endPos = startPos + selectedText.length;
        textarea.setSelectionRange(startPos, endPos);
      });
    },
    [editForm.content]
  );

  const insertHeading = useCallback(
    (level: 1 | 2 | 3) => {
      const hashes = '#'.repeat(level);
      const prefix = `${needsLineBreak() ? '\n' : ''}${hashes} `;
      insertSnippet(prefix, '', `Heading ${level}`);
    },
    [insertSnippet, needsLineBreak]
  );

  const insertListItem = useCallback(
    (ordered: boolean) => {
      const bullet = ordered ? '1. ' : '- ';
      const prefix = `${needsLineBreak() ? '\n' : ''}${bullet}`;
      insertSnippet(prefix, '', 'List item');
    },
    [insertSnippet, needsLineBreak]
  );

  const insertQuote = useCallback(() => {
    const prefix = `${needsLineBreak() ? '\n' : ''}> `;
    insertSnippet(prefix, '', 'Quote text');
  }, [insertSnippet, needsLineBreak]);

  const insertCodeBlock = useCallback(() => {
    const lineBreak = needsLineBreak() ? '\n' : '';
    insertSnippet(`${lineBreak}\`\`\`\n`, '\n```\n', 'code sample');
  }, [insertSnippet, needsLineBreak]);

  const insertBold = useCallback(() => {
    insertSnippet('**', '**', 'bold text');
  }, [insertSnippet]);

  const insertItalic = useCallback(() => {
    insertSnippet('*', '*', 'italic text');
  }, [insertSnippet]);

  const insertInlineCode = useCallback(() => {
    insertSnippet('`', '`', 'code');
  }, [insertSnippet]);

  const insertLink = useCallback(() => {
    insertSnippet('[', '](https://example.com)', 'link text');
  }, [insertSnippet]);

  const insertImage = useCallback(() => {
    insertSnippet('![', '](https://example.com/image.png)', 'alt text');
  }, [insertSnippet]);

  const insertSpoiler = useCallback(() => {
    insertSnippet('||', '||', 'spoiler text');
  }, [insertSnippet]);

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
          <div>
            <label className="label">
              <span className="label-text font-medium">Summary</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="One-sentence summary of your review"
              value={editForm.summary}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, summary: e.target.value }))
              }
              maxLength={REVIEW_SUMMARY_MAX_LENGTH}
              minLength={REVIEW_SUMMARY_MIN_LENGTH}
              required
            />
            {editForm.summary.trim().length > 0 &&
              editForm.summary.trim().length < REVIEW_SUMMARY_MIN_LENGTH && (
                <div className="label">
                  <span className="label-text-alt text-warning">
                    Summary must be at least {REVIEW_SUMMARY_MIN_LENGTH}{' '}
                    characters.
                  </span>
                </div>
              )}
          </div>

          {/* Rating */}
          <div>
            <label className="label">
              <span className="label-text font-medium">Rating (Optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="rating rating-lg rating-half">
                <input
                  type="radio"
                  name="edit-review-rating"
                  className="rating-hidden"
                  checked={!editForm.rating}
                  onChange={() =>
                    setEditForm((prev) => ({ ...prev, rating: undefined }))
                  }
                />
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
                  <input
                    key={value}
                    type="radio"
                    name="edit-review-rating"
                    className={`mask mask-star ${
                      value % 1 === 0.5 ? 'mask-half-1' : 'mask-half-2'
                    } bg-primary`}
                    aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                    checked={editForm.rating === value}
                    onChange={() =>
                      setEditForm((prev) => ({ ...prev, rating: value }))
                    }
                  />
                ))}
              </div>
              {editForm.rating && (
                <span className="text-sm text-base-content/60">
                  {editForm.rating}/5
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="label">
              <span className="label-text font-medium">Review</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => insertHeading(1)}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => insertHeading(2)}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => insertHeading(3)}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>
              <div
                className="w-px bg-base-300/60 self-stretch"
                aria-hidden="true"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertBold}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertItalic}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertInlineCode}
                title="Inline code"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertCodeBlock}
                title="Code block"
              >
                <Code className="w-4 h-4" />
              </button>
              <div
                className="w-px bg-base-300/60 self-stretch"
                aria-hidden="true"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => insertListItem(false)}
                title="Bulleted list"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => insertListItem(true)}
                title="Numbered list"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertQuote}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <div
                className="w-px bg-base-300/60 self-stretch"
                aria-hidden="true"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertLink}
                title="Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertImage}
                title="Image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={insertSpoiler}
                title="Spoiler"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="textarea textarea-bordered w-full min-h-56 resize-y overflow-y-auto [field-sizing:fixed] leading-relaxed"
              placeholder="Share your thoughts about this media..."
              value={editForm.content}
              ref={reviewTextareaRef}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, content: e.target.value }))
              }
              required
            />
            {editForm.content.length > REVIEW_MAX_LENGTH && (
              <div className="label">
                <span className="label-text-alt text-error">
                  {editForm.content.length - REVIEW_MAX_LENGTH} characters over
                  the {REVIEW_MAX_LENGTH} limit.
                </span>
              </div>
            )}
          </div>

          <div className="card bg-base-200/50 border border-base-300">
            <div className="card-body p-4">
              <h4 className="font-semibold">Preview</h4>
              <div className="grow-0 w-full">
                {editForm.summary.trim() && (
                  <div className="text-base font-medium text-base-content/85">
                    {editForm.summary.trim()}
                  </div>
                )}

                {editForm.summary.trim() && <div className="divider my-2" />}

                {editForm.content.trim() ? (
                  <div
                    className="prose prose-sm max-w-none text-base-content [&>*:first-child]:mt-0"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdownWithSpoilers(editForm.content),
                    }}
                  />
                ) : (
                  <div className="text-base-content/60">
                    Your live preview appears here as you edit.
                  </div>
                )}
              </div>
            </div>
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
              disabled={
                isLoading ||
                editForm.summary.trim().length < REVIEW_SUMMARY_MIN_LENGTH ||
                !editForm.content.trim() ||
                editForm.content.length > REVIEW_MAX_LENGTH
              }
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
