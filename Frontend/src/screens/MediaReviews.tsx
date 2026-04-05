import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import {
  ArrowUpDown,
  MessageSquareText,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import { OutletMediaContextType, IMediaReview } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  getMediaReviewsFn,
  editMediaReviewFn,
  toggleMediaReviewLikeFn,
  deleteMediaReviewFn,
} from '../api/trackerApi';
import EditReviewModal from '../components/EditReviewModal';
import MediaReviewCard from '../components/MediaReviewCard';
import ReviewRatingSummary from '../components/ReviewRatingSummary';

type ReviewSortOption =
  | 'newest'
  | 'oldest'
  | 'highest-rated'
  | 'lowest-rated'
  | 'most-liked';

const REVIEW_SORT_OPTIONS: {
  value: ReviewSortOption;
  label: string;
  shortLabel: string;
}[] = [
  { value: 'newest', label: 'Newest first', shortLabel: 'Newest' },
  { value: 'oldest', label: 'Oldest first', shortLabel: 'Oldest' },
  {
    value: 'highest-rated',
    label: 'Highest rated',
    shortLabel: 'Highest rated',
  },
  {
    value: 'lowest-rated',
    label: 'Lowest rated',
    shortLabel: 'Lowest rated',
  },
  { value: 'most-liked', label: 'Most liked', shortLabel: 'Most liked' },
];

function MediaReviews() {
  const { mediaDocument, username } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const queryClient = useQueryClient();
  const [editingReview, setEditingReview] = useState<IMediaReview | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [ratingPresenceFilter, setRatingPresenceFilter] = useState<
    'all' | 'rated' | 'unrated'
  >('all');
  const [reviewSort, setReviewSort] = useState<ReviewSortOption>('newest');
  const [minScoreInput, setMinScoreInput] = useState('');
  const [maxScoreInput, setMaxScoreInput] = useState('');

  const { data: mediaReviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['mediaReviews', mediaDocument?.contentId, mediaDocument?.type],
    queryFn: () => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return getMediaReviewsFn(mediaDocument.contentId, mediaDocument.type);
    },
    enabled: !!mediaDocument?.contentId && !!mediaDocument?.type,
  });

  const { mutate: editReviewMutation, isPending: isEditingReview } =
    useMutation({
      mutationFn: (data: {
        reviewId: string;
        reviewData: {
          summary: string;
          content: string;
          rating?: number;
          hasSpoilers: boolean;
        };
      }) => {
        if (!mediaDocument?.contentId || !mediaDocument?.type) {
          throw new Error('Media ID and type are required');
        }
        return editMediaReviewFn(
          mediaDocument.contentId,
          mediaDocument.type,
          data.reviewId,
          data.reviewData
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
        setEditingReview(null);
        toast.success('Review updated successfully');
      },
      onError: (error: unknown) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data?.message || error.message
            : 'Failed to update review';
        toast.error(errorMessage);
      },
    });

  const { mutate: deleteReviewMutation, isPending: isDeletingReview } =
    useMutation({
      mutationFn: (reviewId: string) => {
        if (!mediaDocument?.contentId || !mediaDocument?.type) {
          throw new Error('Media ID and type are required');
        }
        return deleteMediaReviewFn(
          mediaDocument.contentId,
          mediaDocument.type,
          reviewId
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
        toast.success('Review deleted successfully');
      },
      onError: (error: unknown) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data?.message || error.message
            : 'Failed to delete review';
        toast.error(errorMessage);
      },
    });

  const { mutate: likeReviewMutation, isPending: isLikingReview } = useMutation(
    {
      mutationFn: (reviewId: string) => {
        if (!mediaDocument?.contentId || !mediaDocument?.type) {
          throw new Error('Media ID and type are required');
        }
        return toggleMediaReviewLikeFn(
          mediaDocument.contentId,
          mediaDocument.type,
          reviewId
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
      },
      onError: (error: unknown) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data?.message || error.message
            : 'Failed to update like';
        toast.error(errorMessage);
      },
    }
  );

  const mediaReviews = mediaReviewsData?.reviews || [];

  const parseScoreInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const minScoreFilter = parseScoreInput(minScoreInput);
  const maxScoreFilter = parseScoreInput(maxScoreInput);
  const isScoreRangeInvalid =
    minScoreFilter !== null &&
    maxScoreFilter !== null &&
    minScoreFilter > maxScoreFilter;

  const filteredReviews = mediaReviews.filter((review) => {
    const rating = typeof review.rating === 'number' ? review.rating : null;
    const hasRating = rating !== null;

    if (isScoreRangeInvalid) {
      return false;
    }

    if (ratingPresenceFilter === 'rated' && !hasRating) {
      return false;
    }

    if (ratingPresenceFilter === 'unrated' && hasRating) {
      return false;
    }

    if (minScoreFilter !== null) {
      if (!hasRating || rating < minScoreFilter) {
        return false;
      }
    }

    if (maxScoreFilter !== null) {
      if (!hasRating || rating > maxScoreFilter) {
        return false;
      }
    }

    return true;
  });

  const getReviewTimestamp = (review: IMediaReview) => {
    if (!review.createdAt) {
      return 0;
    }
    return new Date(review.createdAt).getTime();
  };

  const sortedFilteredReviews = [...filteredReviews].sort((a, b) => {
    if (reviewSort === 'newest') {
      return getReviewTimestamp(b) - getReviewTimestamp(a);
    }

    if (reviewSort === 'oldest') {
      return getReviewTimestamp(a) - getReviewTimestamp(b);
    }

    if (reviewSort === 'most-liked') {
      const likesDiff = b.likes.length - a.likes.length;
      if (likesDiff !== 0) {
        return likesDiff;
      }
      return getReviewTimestamp(b) - getReviewTimestamp(a);
    }

    const aRating = typeof a.rating === 'number' ? a.rating : null;
    const bRating = typeof b.rating === 'number' ? b.rating : null;

    if (aRating === null && bRating === null) {
      return getReviewTimestamp(b) - getReviewTimestamp(a);
    }

    if (aRating === null) {
      return 1;
    }

    if (bRating === null) {
      return -1;
    }

    if (reviewSort === 'highest-rated') {
      const ratingDiff = bRating - aRating;
      if (ratingDiff !== 0) {
        return ratingDiff;
      }
      return getReviewTimestamp(b) - getReviewTimestamp(a);
    }

    if (reviewSort === 'lowest-rated') {
      const ratingDiff = aRating - bRating;
      if (ratingDiff !== 0) {
        return ratingDiff;
      }
      return getReviewTimestamp(b) - getReviewTimestamp(a);
    }

    return getReviewTimestamp(b) - getReviewTimestamp(a);
  });

  const userReview = mediaReviews.find(
    (review) => review.user._id === currentUser?._id
  );

  const mediaBasePath =
    mediaDocument?.type && mediaDocument?.contentId
      ? username
        ? `/${mediaDocument.type}/${mediaDocument.contentId}/${username}`
        : `/${mediaDocument.type}/${mediaDocument.contentId}`
      : '';

  const writeReviewPath = mediaBasePath
    ? `${mediaBasePath}/reviews/write`
    : '#';
  const reviewsTabPath = mediaBasePath ? `${mediaBasePath}/reviews` : '#';
  const selectedSortLabel =
    REVIEW_SORT_OPTIONS.find((option) => option.value === reviewSort)
      ?.shortLabel || 'Newest';

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-4 items-start">
        <aside className="card bg-base-100 shadow-sm lg:sticky lg:top-24">
          <div className="card-body p-4 gap-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Ratings & Filters
            </h3>

            {reviewsLoading ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : mediaReviews.length > 0 ? (
              <>
                <ReviewRatingSummary
                  reviews={mediaReviews}
                  reviewsTabPath={reviewsTabPath}
                  variant="inline"
                  className="max-w-none"
                />

                <div className="divider my-0"></div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Visibility
                  </p>
                  <div className="join w-full">
                    <button
                      className={`join-item btn btn-xs flex-1 ${
                        ratingPresenceFilter === 'all'
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                      onClick={() => setRatingPresenceFilter('all')}
                    >
                      All
                    </button>
                    <button
                      className={`join-item btn btn-xs flex-1 ${
                        ratingPresenceFilter === 'rated'
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                      onClick={() => setRatingPresenceFilter('rated')}
                    >
                      Rated
                    </button>
                    <button
                      className={`join-item btn btn-xs flex-1 ${
                        ratingPresenceFilter === 'unrated'
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                      onClick={() => setRatingPresenceFilter('unrated')}
                    >
                      Unrated
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Sort
                  </p>
                  <div className="dropdown w-full">
                    <div
                      tabIndex={0}
                      role="button"
                      className="btn btn-outline btn-sm w-full justify-start gap-2"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      Sort: {selectedSortLabel}
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-full"
                    >
                      {REVIEW_SORT_OPTIONS.map((option) => (
                        <li key={option.value}>
                          <button
                            className={
                              reviewSort === option.value ? 'active' : ''
                            }
                            onClick={() => setReviewSort(option.value)}
                          >
                            {option.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wide text-base-content/60">
                      Score Range
                    </p>
                    {(minScoreInput || maxScoreInput) && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setMinScoreInput('');
                          setMaxScoreInput('');
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="Min"
                      aria-label="Minimum score"
                      className="input input-sm input-bordered rounded-box w-24 text-center"
                      value={minScoreInput}
                      disabled={ratingPresenceFilter === 'unrated'}
                      onChange={(e) => setMinScoreInput(e.target.value)}
                    />

                    <span className="text-xs font-medium text-base-content/60">
                      to
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      placeholder="Max"
                      aria-label="Maximum score"
                      className="input input-sm input-bordered rounded-box w-24 text-center"
                      value={maxScoreInput}
                      disabled={ratingPresenceFilter === 'unrated'}
                      onChange={(e) => setMaxScoreInput(e.target.value)}
                    />
                  </div>

                  {ratingPresenceFilter === 'unrated' && (
                    <p className="text-xs text-base-content/60">
                      Score range is disabled while viewing unrated reviews.
                    </p>
                  )}

                  {isScoreRangeInvalid && (
                    <p className="text-xs text-error">
                      Minimum score must be lower than or equal to maximum
                      score.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-base-content/60">
                No rating data yet.
              </p>
            )}
          </div>
        </aside>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h2 className="card-title text-xl flex items-center gap-2">
                  <MessageSquareText className="w-5 h-5" />
                  Reviews
                </h2>
                {currentUser && userReview && (
                  <p className="text-sm text-base-content/70 mt-2">
                    You already posted a review for this title.
                  </p>
                )}
              </div>
              {currentUser && !userReview && mediaBasePath && (
                <Link
                  to={writeReviewPath}
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Write a review
                </Link>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : mediaReviews.length > 0 ? (
              sortedFilteredReviews.length > 0 ? (
                <div className="space-y-4">
                  {sortedFilteredReviews.map((review) => (
                    <MediaReviewCard
                      key={review._id}
                      review={review}
                      currentUserId={currentUser?._id}
                      onEdit={setEditingReview}
                      onDelete={setDeletingReviewId}
                      onLike={likeReviewMutation}
                      likeDisabled={isLikingReview || !currentUser}
                      ratingColorClass="bg-primary"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-base-content/60">
                  <h3 className="text-lg font-semibold mb-1">
                    No Reviews Match These Filters
                  </h3>
                  <p className="mb-4">
                    Try clearing one or more filters to see reviews again.
                  </p>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setRatingPresenceFilter('all');
                      setReviewSort('newest');
                      setMinScoreInput('');
                      setMaxScoreInput('');
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <MessageSquareText className="mx-auto text-4xl mb-3 opacity-50" />
                <h3 className="text-lg font-semibold mb-1">No Reviews Yet</h3>
                <p>Be the first to share your thoughts about this media.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {editingReview && (
        <EditReviewModal
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          review={editingReview}
          onSubmit={(reviewData) =>
            editReviewMutation({
              reviewId: editingReview._id,
              reviewData,
            })
          }
          isLoading={isEditingReview}
        />
      )}

      {deletingReviewId && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg">Delete Review</h3>
            <p className="py-4 text-base-content/70">
              Are you sure you want to delete your review? This cannot be
              undone.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setDeletingReviewId(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                disabled={isDeletingReview}
                onClick={() => {
                  deleteReviewMutation(deletingReviewId);
                  setDeletingReviewId(null);
                }}
              >
                {isDeletingReview ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setDeletingReviewId(null)}
          />
        </dialog>
      )}
    </div>
  );
}

export default MediaReviews;
