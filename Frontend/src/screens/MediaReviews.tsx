import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { MessageSquareText, Pencil } from 'lucide-react';
import { OutletMediaContextType, IMediaReview } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  getMediaReviewsFn,
  editMediaReviewFn,
  toggleMediaReviewLikeFn,
} from '../api/trackerApi';
import LikeButton from '../components/LikeButton';
import EditReviewModal from '../components/EditReviewModal';
import { renderMarkdownWithSpoilers } from '../utils/markdown';

function MediaReviews() {
  const { mediaDocument, username } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const queryClient = useQueryClient();
  const [editingReview, setEditingReview] = useState<IMediaReview | null>(null);

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
        reviewData: { content: string; rating?: number; hasSpoilers: boolean };
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="card-title text-xl flex items-center gap-2">
              <MessageSquareText className="w-5 h-5" />
              Reviews
            </h2>
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
          {currentUser && userReview && (
            <p className="text-sm text-base-content/70 mb-4">
              You already posted a review for this title.
            </p>
          )}

          {reviewsLoading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : mediaReviews.length > 0 ? (
            <div className="space-y-4">
              {mediaReviews.map((review) => (
                <div key={review._id} className="card bg-base-200/60 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex items-start justify-between">
                      <Link
                        to={`/user/${review.user.username}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
                      >
                        <div className="avatar">
                          <div className="w-9 h-9 rounded-full">
                            <img
                              src={review.user.avatar || '/default-avatar.png'}
                              alt={review.user.username}
                            />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold group-hover:underline">
                            {review.user.username}
                          </h4>
                          <p className="text-xs text-base-content/60">
                            {new Date(review.createdAt!).toLocaleDateString()}
                            {review.editedAt && (
                              <span
                                className="ml-2 tooltip tooltip-bottom cursor-default"
                                data-tip={`Edited ${new Date(review.editedAt).toLocaleString()}`}
                              >
                                (edited)
                              </span>
                            )}
                          </p>
                        </div>
                      </Link>
                      {review.rating && (
                        <div className="rating rating-sm rating-half pointer-events-none">
                          <input
                            type="radio"
                            className="rating-hidden"
                            checked={false}
                            readOnly
                          />
                          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(
                            (value) => (
                              <input
                                key={value}
                                type="radio"
                                className={`mask mask-star ${
                                  value % 1 === 0.5
                                    ? 'mask-half-1'
                                    : 'mask-half-2'
                                } bg-yellow-500`}
                                checked={review.rating === value}
                                readOnly
                                tabIndex={-1}
                              />
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className="prose prose-sm max-w-none mt-3 text-base-content"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownWithSpoilers(review.content),
                      }}
                    />

                    <div className="flex items-center justify-between mt-4">
                      <LikeButton
                        isLiked={review.likes.includes(currentUser?._id || '')}
                        likesCount={review.likes.length}
                        onToggleLike={() => likeReviewMutation(review._id)}
                        disabled={isLikingReview || !currentUser}
                        size="xs"
                      />
                      {review.user._id === currentUser?._id && (
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditingReview(review)}
                          title="Edit review"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-base-content/60">
              <MessageSquareText className="mx-auto text-4xl mb-3 opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Reviews Yet</h3>
              <p>Be the first to share your thoughts about this media.</p>
            </div>
          )}
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
    </div>
  );
}

export default MediaReviews;
