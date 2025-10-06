import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  MdComment,
  MdStar,
  MdStarBorder,
  MdWarning,
  MdEdit,
} from 'react-icons/md';
import {
  getClubReviewsFn,
  addClubReviewFn,
  toggleReviewLikeFn,
  editClubReviewFn,
} from '../api/clubApi';
import { OutletClubMediaContextType, IClubReview } from '../types';
import LikeButton from '../components/LikeButton';
import EditReviewModal from '../components/EditReviewModal';

export default function ClubMediaReviews() {
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const queryClient = useQueryClient();
  const { club, user } = useOutletContext<OutletClubMediaContextType>();

  const [reviewForm, setReviewForm] = useState({
    content: '',
    rating: undefined as number | undefined,
    hasSpoilers: false,
  });
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [editingReview, setEditingReview] = useState<IClubReview | null>(null);

  // Fetch reviews for this media
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['clubReviews', clubId, mediaId],
    queryFn: () => getClubReviewsFn(clubId!, mediaId!),
    enabled: !!clubId && !!mediaId,
  });

  // Add review mutation
  const addReviewMutation = useMutation({
    mutationFn: (reviewData: typeof reviewForm) =>
      addClubReviewFn(clubId!, mediaId!, reviewData),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['clubReviews', clubId, mediaId],
      });
      toast.success('Review added successfully!');
      setReviewForm({
        content: '',
        rating: undefined,
        hasSpoilers: false,
      });
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add review';
      toast.error(errorMessage);
    },
  });

  // Toggle like mutation
  const toggleLikeMutation = useMutation({
    mutationFn: (reviewId: string) =>
      toggleReviewLikeFn(clubId!, mediaId!, reviewId),
    onSuccess: () => {
      // Simply invalidate and refetch the data since backend is working correctly
      queryClient.invalidateQueries({
        queryKey: ['clubReviews', clubId, mediaId],
      });
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update like';
      toast.error(errorMessage);
    },
  });

  // Edit review mutation
  const editReviewMutation = useMutation({
    mutationFn: (data: {
      reviewId: string;
      reviewData: { content: string; rating?: number; hasSpoilers: boolean };
    }) => editClubReviewFn(clubId!, mediaId!, data.reviewId, data.reviewData),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['clubReviews', clubId, mediaId],
      });
      toast.success('Review updated successfully!');
      setEditingReview(null);
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update review';
      toast.error(errorMessage);
    },
  });
  if (!club) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center py-12 text-base-content/60">
          <h3 className="text-lg font-semibold mb-2">Loading...</h3>
        </div>
      </div>
    );
  }

  const reviews = reviewsData?.reviews || [];
  const canAddReview = club.isUserMember && club.userStatus === 'active';
  const userReview = reviews.find((review) => review.user._id === user?._id);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="space-y-6">
        {/* Add Review Form */}
        {canAddReview && !userReview && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title">Write a Review</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reviewForm.content.trim()) {
                    addReviewMutation.mutate(reviewForm);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="label">
                    <span className="label-text">Rating (optional)</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setReviewForm((prev) => ({
                            ...prev,
                            rating: prev.rating === star ? undefined : star,
                          }))
                        }
                        className="btn btn-ghost btn-sm p-1"
                      >
                        {reviewForm.rating && star <= reviewForm.rating ? (
                          <MdStar className="text-yellow-500" />
                        ) : (
                          <MdStarBorder className="text-base-content/40" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Review</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-32"
                    placeholder="Share your thoughts about this media..."
                    value={reviewForm.content}
                    onChange={(e) =>
                      setReviewForm((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={reviewForm.hasSpoilers}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          hasSpoilers: e.target.checked,
                        }))
                      }
                    />
                    <span className="label-text">Contains spoilers</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      addReviewMutation.isPending || !reviewForm.content.trim()
                    }
                  >
                    {addReviewMutation.isPending ? 'Posting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review._id} className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="w-10 h-10 rounded-full">
                          <img
                            src={review.user.avatar || '/default-avatar.png'}
                            alt={review.user.username}
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold">
                          {review.user.username}
                        </h4>
                        <p className="text-sm text-base-content/60">
                          {new Date(review.createdAt!).toLocaleDateString()}
                          {review.editedAt && (
                            <span className="ml-2 text-xs">(edited)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {review.rating && (
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <MdStar
                              key={star}
                              className={
                                star <= review.rating!
                                  ? 'text-yellow-500'
                                  : 'text-base-content/20'
                              }
                            />
                          ))}
                        </div>
                        <span className="text-sm ml-1">{review.rating}/5</span>
                      </div>
                    )}
                  </div>

                  {review.hasSpoilers && !showSpoilers ? (
                    <div className="mt-4 p-4 border border-warning rounded-lg bg-warning/10">
                      <div className="flex items-center gap-2 text-warning mb-2">
                        <MdWarning />
                        <span className="font-medium">Spoiler Warning</span>
                      </div>
                      <p className="text-sm mb-3">
                        This review contains spoilers.
                      </p>
                      <button
                        onClick={() => setShowSpoilers(true)}
                        className="btn btn-outline btn-warning btn-xs"
                      >
                        Show Spoilers
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      {review.hasSpoilers && (
                        <div className="flex items-center gap-2 text-warning mb-2">
                          <MdWarning className="text-sm" />
                          <span className="text-xs">Contains spoilers</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{review.content}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                      <LikeButton
                        isLiked={review.likes.includes(user?._id || '')}
                        likesCount={review.likes.length}
                        onToggleLike={() =>
                          toggleLikeMutation.mutate(review._id)
                        }
                        disabled={toggleLikeMutation.isPending || !user}
                        size="xs"
                      />
                    </div>
                    {review.user._id === user?._id && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setEditingReview(review)}
                        title="Edit review"
                      >
                        <MdEdit />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-base-content/60">
            <MdComment className="mx-auto text-4xl mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
            <p>Be the first to share your thoughts about this media!</p>
          </div>
        )}
      </div>

      {/* Edit Review Modal */}
      {editingReview && (
        <EditReviewModal
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          review={editingReview}
          onSubmit={(reviewData) =>
            editReviewMutation.mutate({
              reviewId: editingReview._id,
              reviewData,
            })
          }
          isLoading={editReviewMutation.isPending}
        />
      )}
    </div>
  );
}
