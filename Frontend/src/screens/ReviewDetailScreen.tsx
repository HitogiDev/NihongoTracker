import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Ellipsis,
  Pencil,
  Share2,
  Star,
  Trash,
} from 'lucide-react';
import {
  deleteMediaReviewFn,
  editMediaReviewFn,
  getMediaReviewByIdFn,
  toggleMediaReviewLikeFn,
} from '../api/trackerApi';
import EditReviewModal from '../components/EditReviewModal';
import LikeButton from '../components/LikeButton';
import { IMediaReview } from '../types';
import { useUserDataStore } from '../store/userData';
import { renderMarkdownWithSpoilers } from '../utils/markdown';

function getMediaTitle(mediaTitle?: {
  contentTitleEnglish?: string;
  contentTitleRomaji?: string;
  contentTitleNative: string;
}) {
  if (!mediaTitle) return 'Review';
  return (
    mediaTitle.contentTitleEnglish ||
    mediaTitle.contentTitleRomaji ||
    mediaTitle.contentTitleNative
  );
}

function ReviewDetailScreen() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: reviewResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['mediaReview', reviewId],
    queryFn: () => {
      if (!reviewId) {
        throw new Error('Review ID is required');
      }
      return getMediaReviewByIdFn(reviewId);
    },
    enabled: !!reviewId,
  });

  const review = reviewResponse?.review;
  const media = reviewResponse?.media;
  const isAuthor = review?.user._id === currentUser?._id;

  const mediaPath = review
    ? `/${review.mediaType}/${review.mediaContentId}`
    : '/';

  const { mutate: likeReviewMutation, isPending: isLikingReview } = useMutation(
    {
      mutationFn: () => {
        if (!review) {
          throw new Error('Review data is required');
        }
        return toggleMediaReviewLikeFn(
          review.mediaContentId,
          review.mediaType,
          review._id
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['mediaReview', reviewId] });
        if (review) {
          queryClient.invalidateQueries({
            queryKey: ['mediaReviews', review.mediaContentId, review.mediaType],
          });
        }
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

  const { mutate: editReviewMutation, isPending: isEditingReview } =
    useMutation({
      mutationFn: (reviewData: {
        summary: string;
        content: string;
        rating?: number;
        hasSpoilers: boolean;
      }) => {
        if (!review) {
          throw new Error('Review data is required');
        }
        return editMediaReviewFn(
          review.mediaContentId,
          review.mediaType,
          review._id,
          reviewData
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['mediaReview', reviewId] });
        if (review) {
          queryClient.invalidateQueries({
            queryKey: ['mediaReviews', review.mediaContentId, review.mediaType],
          });
        }
        setIsEditing(false);
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
      mutationFn: () => {
        if (!review) {
          throw new Error('Review data is required');
        }
        return deleteMediaReviewFn(
          review.mediaContentId,
          review.mediaType,
          review._id
        );
      },
      onSuccess: () => {
        if (review) {
          queryClient.invalidateQueries({
            queryKey: ['mediaReviews', review.mediaContentId, review.mediaType],
          });
        }
        toast.success('Review deleted successfully');
        navigate(mediaPath);
      },
      onError: (error: unknown) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data?.message || error.message
            : 'Failed to delete review';
        toast.error(errorMessage);
      },
    });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="container mx-auto mt-16 px-4 py-16 max-w-3xl">
        <div className="alert alert-error">
          <span>Review not found or unavailable.</span>
        </div>
        <div className="mt-6">
          <Link to="/" className="btn btn-primary btn-sm">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const bannerImage = media?.coverImage || media?.contentImage;
  const mediaTitle = getMediaTitle(media?.title);

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success('Review link copied to clipboard!');
      })
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Review link copied to clipboard!');
      });
  }

  function handleShare() {
    if (!review) return;

    const shareUrl = `${window.location.origin}/review/${review._id}`;
    const shareTitle = `[${mediaTitle}] Review`;

    if (navigator.share) {
      navigator
        .share({
          title: shareTitle,
          text: `Check out this review for ${mediaTitle}.`,
          url: shareUrl,
        })
        .catch(() => {
          copyToClipboard(shareUrl);
        });
    } else {
      copyToClipboard(shareUrl);
    }
  }

  return (
    <div className="min-h-screen bg-base-200/40 mt-16 pb-14">
      <section className="relative min-h-[320px] md:min-h-[380px] overflow-hidden border-b border-base-300/40">
        {bannerImage && (
          <img
            src={bannerImage}
            alt={mediaTitle}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral/90 via-neutral/80 to-base-100" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-accent/20" />

        <div className="container mx-auto px-4 pt-10 pb-12 relative z-10 text-neutral-content">
          <Link
            to={mediaPath}
            className="btn btn-sm bg-neutral/75 text-neutral-content border border-neutral-content/20 hover:bg-neutral/90 hover:border-neutral-content/35 backdrop-blur-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to media
          </Link>

          <div className="mt-8 max-w-3xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              [{mediaTitle}] Review
            </h1>
            <p className="text-base md:text-lg mt-3 opacity-90">
              a review by{' '}
              <Link
                to={`/user/${review.user.username}`}
                className="link link-hover font-semibold text-neutral-content"
              >
                {review.user.username}
              </Link>
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm opacity-90">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {new Date(review.createdAt || Date.now()).toLocaleDateString()}
            </span>
            {review.editedAt && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="w-4 h-4" />
                Edited {new Date(review.editedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 -mt-12 relative z-20">
        <article className="card bg-base-100 border border-base-300/70 shadow-2xl group">
          <div className="card-body p-5 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-soft capitalize">
                  {review.mediaType === 'vn'
                    ? 'visual novel'
                    : review.mediaType === 'reading'
                      ? 'light novel'
                      : review.mediaType}
                </span>
                {review.rating && (
                  <span className="badge badge-primary gap-1">
                    <Star className="w-3 h-3" />
                    {review.rating}/5
                  </span>
                )}
                {review.hasSpoilers && (
                  <span className="badge badge-error badge-outline">
                    Spoilers
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <LikeButton
                  isLiked={review.likes.includes(currentUser?._id || '')}
                  likesCount={review.likes.length}
                  onToggleLike={() => likeReviewMutation()}
                  disabled={isLikingReview || !currentUser}
                  size="sm"
                />
                <div className="dropdown dropdown-end">
                  <button
                    tabIndex={0}
                    className="btn btn-ghost btn-sm btn-circle opacity-100 hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200"
                    aria-label="Review options"
                  >
                    <Ellipsis className="w-4 h-4" />
                  </button>
                  <ul className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-36 border border-base-300 z-50">
                    <li>
                      <button
                        onClick={handleShare}
                        className="text-success hover:bg-success/10 gap-2"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                    </li>
                    {isAuthor && (
                      <>
                        <li>
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-warning hover:bg-warning/10 gap-2"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => setIsDeleteDialogOpen(true)}
                            className="text-error hover:bg-error/10 gap-2"
                          >
                            <Trash className="w-4 h-4" />
                            Delete
                          </button>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div
              className="prose prose-sm md:prose-base max-w-none mt-8 text-base-content"
              dangerouslySetInnerHTML={{
                __html: renderMarkdownWithSpoilers(review.content),
              }}
            />
          </div>
        </article>
      </main>

      {isEditing && (
        <EditReviewModal
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          review={review as IMediaReview}
          onSubmit={(reviewData) => editReviewMutation(reviewData)}
          isLoading={isEditingReview}
        />
      )}

      {isDeleteDialogOpen && (
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
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => deleteReviewMutation()}
                disabled={isDeletingReview}
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
            onClick={() => setIsDeleteDialogOpen(false)}
          />
        </dialog>
      )}
    </div>
  );
}

export default ReviewDetailScreen;
