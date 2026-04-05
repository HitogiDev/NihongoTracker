import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import {
  Bold,
  Code,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Type,
} from 'lucide-react';
import { OutletMediaContextType } from '../types';
import { useUserDataStore } from '../store/userData';
import { addMediaReviewFn, getMediaReviewsFn } from '../api/trackerApi';
import { renderMarkdownWithSpoilers } from '../utils/markdown';

const REVIEW_MAX_LENGTH = 5000;
const REVIEW_SUMMARY_MIN_LENGTH = 20;
const REVIEW_SUMMARY_MAX_LENGTH = 150;

function MediaWriteReview() {
  const { mediaDocument, username } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reviewForm, setReviewForm] = useState({
    summary: '',
    content: '',
    rating: undefined as number | undefined,
  });
  const reviewTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bypassUnsavedPromptRef = useRef(false);

  const mediaBasePath = useMemo(() => {
    if (!mediaDocument?.type || !mediaDocument?.contentId) {
      return '';
    }
    return username
      ? `/${mediaDocument.type}/${mediaDocument.contentId}/${username}`
      : `/${mediaDocument.type}/${mediaDocument.contentId}`;
  }, [mediaDocument?.type, mediaDocument?.contentId, username]);

  const reviewsPath = mediaBasePath ? `${mediaBasePath}/reviews` : '/';

  const { data: mediaReviewsData } = useQuery({
    queryKey: ['mediaReviews', mediaDocument?.contentId, mediaDocument?.type],
    queryFn: () => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return getMediaReviewsFn(mediaDocument.contentId, mediaDocument.type);
    },
    enabled:
      !!mediaDocument?.contentId && !!mediaDocument?.type && !!currentUser,
  });

  const userReview = mediaReviewsData?.reviews?.find(
    (review) => review.user._id === currentUser?._id
  );

  const hasStartedWriting =
    reviewForm.summary.trim().length > 0 ||
    reviewForm.content.trim().length > 0 ||
    reviewForm.rating !== undefined;

  useBeforeUnload(
    useCallback(
      (event) => {
        if (bypassUnsavedPromptRef.current) return;
        if (!hasStartedWriting) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [hasStartedWriting]
    )
  );

  const blocker = useBlocker(
    useCallback(
      () => hasStartedWriting && !bypassUnsavedPromptRef.current,
      [hasStartedWriting]
    )
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    if (bypassUnsavedPromptRef.current) {
      blocker.proceed();
      return;
    }

    const shouldLeave = window.confirm(
      'You have an unfinished review. Leave this page?'
    );

    if (shouldLeave) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  const addReviewMutation = useMutation({
    mutationFn: (data: typeof reviewForm) => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return addMediaReviewFn(
        mediaDocument.contentId,
        mediaDocument.type,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'mediaReviews',
          mediaDocument?.contentId,
          mediaDocument?.type,
        ],
      });
      toast.success('Review added successfully');
      bypassUnsavedPromptRef.current = true;
      // Clear form first so the leave-page blocker doesn't trigger on navigate
      setReviewForm({ summary: '', content: '', rating: undefined });
      navigate(reviewsPath);
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Failed to add review';
      toast.error(errorMessage);
    },
  });

  const needsLineBreak = useCallback(() => {
    const textarea = reviewTextareaRef.current;
    if (!textarea) return false;
    const selectionStart = textarea.selectionStart ?? reviewForm.content.length;
    if (selectionStart === 0) return false;
    return reviewForm.content[selectionStart - 1] !== '\n';
  }, [reviewForm.content]);

  const insertSnippet = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const textarea = reviewTextareaRef.current;
      if (!textarea) return;

      const selectionStart =
        textarea.selectionStart ?? reviewForm.content.length;
      const selectionEnd = textarea.selectionEnd ?? reviewForm.content.length;
      const selectedText =
        selectionStart !== selectionEnd
          ? reviewForm.content.slice(selectionStart, selectionEnd)
          : placeholder;

      const newContent =
        reviewForm.content.slice(0, selectionStart) +
        prefix +
        selectedText +
        suffix +
        reviewForm.content.slice(selectionEnd);

      setReviewForm((prev) => ({ ...prev, content: newContent }));

      requestAnimationFrame(() => {
        textarea.focus();
        const startPos = selectionStart + prefix.length;
        const endPos = startPos + selectedText.length;
        textarea.setSelectionRange(startPos, endPos);
      });
    },
    [reviewForm.content]
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

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="alert alert-info">
          <span>You need to be logged in to write a review.</span>
          <Link to="/login" className="btn btn-sm btn-primary">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (userReview) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h2 className="card-title">You already posted a review</h2>
            <p className="text-base-content/70">
              You can edit your existing review from the reviews list.
            </p>
            <div className="card-actions justify-end">
              <Link to={reviewsPath} className="btn btn-primary btn-sm">
                Back to reviews
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pencil className="w-5 h-5" />
          Write a review
        </h1>
        <Link to={reviewsPath} className="btn btn-ghost btn-sm">
          Back to reviews
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmedSummary = reviewForm.summary.trim();
                const trimmedContent = reviewForm.content.trim();

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

                if (reviewForm.content.length > REVIEW_MAX_LENGTH) {
                  toast.error(
                    `Review content must be ${REVIEW_MAX_LENGTH} characters or less.`
                  );
                  return;
                }

                addReviewMutation.mutate(reviewForm);
              }}
            >
              <div>
                <label className="label">
                  <span className="label-text">Summary</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={reviewForm.summary}
                  placeholder="One-sentence summary of your review"
                  maxLength={REVIEW_SUMMARY_MAX_LENGTH}
                  minLength={REVIEW_SUMMARY_MIN_LENGTH}
                  onChange={(e) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      summary: e.target.value,
                    }))
                  }
                  required
                />
                {reviewForm.summary.trim().length > 0 &&
                  reviewForm.summary.trim().length <
                    REVIEW_SUMMARY_MIN_LENGTH && (
                    <label className="label">
                      <span className="label-text-alt text-warning">
                        Summary must be at least {REVIEW_SUMMARY_MIN_LENGTH}{' '}
                        characters.
                      </span>
                    </label>
                  )}
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Rating (optional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="rating rating-lg rating-half">
                    <input
                      type="radio"
                      name="review-rating"
                      className="rating-hidden"
                      checked={!reviewForm.rating}
                      onChange={() =>
                        setReviewForm((prev) => ({
                          ...prev,
                          rating: undefined,
                        }))
                      }
                    />
                    {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
                      <input
                        key={value}
                        type="radio"
                        name="review-rating"
                        className={`mask mask-star ${
                          value % 1 === 0.5 ? 'mask-half-1' : 'mask-half-2'
                        } bg-primary`}
                        aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                        checked={reviewForm.rating === value}
                        onChange={() =>
                          setReviewForm((prev) => ({ ...prev, rating: value }))
                        }
                      />
                    ))}
                  </div>
                  {reviewForm.rating && (
                    <span className="text-sm text-base-content/60">
                      {reviewForm.rating}/5
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Review</span>
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
                  ref={reviewTextareaRef}
                  className="textarea textarea-bordered w-full min-h-72 resize-y overflow-y-auto [field-sizing:fixed] leading-relaxed"
                  value={reviewForm.content}
                  placeholder="Share your thoughts about this media..."
                  onChange={(e) =>
                    setReviewForm((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  required
                />
                {reviewForm.content.length > REVIEW_MAX_LENGTH && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {reviewForm.content.length - REVIEW_MAX_LENGTH} characters
                      over the {REVIEW_MAX_LENGTH} limit.
                    </span>
                  </label>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    addReviewMutation.isPending ||
                    reviewForm.summary.trim().length <
                      REVIEW_SUMMARY_MIN_LENGTH ||
                    !reviewForm.content.trim() ||
                    reviewForm.content.length > REVIEW_MAX_LENGTH
                  }
                >
                  {addReviewMutation.isPending ? 'Posting...' : 'Post Review'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card bg-base-100 shadow-lg">
          <div className="card-body justify-start">
            <h2 className="card-title text-lg">Preview</h2>
            <div className="grow-0 w-full">
              {reviewForm.summary.trim() && (
                <div className="text-base font-medium text-base-content/85">
                  {reviewForm.summary.trim()}
                </div>
              )}

              {reviewForm.summary.trim() && <div className="divider my-2" />}

              {reviewForm.content.trim() ? (
                <div
                  className="prose prose-sm max-w-none text-base-content [&>*:first-child]:mt-0"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownWithSpoilers(reviewForm.content),
                  }}
                />
              ) : (
                <div className="text-base-content/60">
                  Your live preview appears here as you write.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MediaWriteReview;
