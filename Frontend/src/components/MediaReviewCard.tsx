import { Link } from 'react-router-dom';
import { Ellipsis, Pencil, Share2, Trash } from 'lucide-react';
import { toast } from 'react-toastify';
import LikeButton from './LikeButton';
import { IMediaReview } from '../types';
import UserAvatar from './UserAvatar';

interface MediaReviewCardProps {
  review: IMediaReview;
  currentUserId?: string;
  onEdit: (review: IMediaReview) => void;
  onDelete: (reviewId: string) => void;
  onLike: (reviewId: string) => void;
  likeDisabled?: boolean;
  ratingColorClass?: string;
}

function MediaReviewCard({
  review,
  currentUserId,
  onEdit,
  onDelete,
  onLike,
  likeDisabled = false,
  ratingColorClass = 'bg-primary',
}: MediaReviewCardProps) {
  const isOwner = review.user._id === currentUserId;

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

  function handleShare(reviewId: string) {
    const shareUrl = `${window.location.origin}/review/${reviewId}`;

    if (navigator.share) {
      navigator
        .share({
          title: 'NihongoTracker Review',
          text: 'Check out this review!',
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
    <div className="card bg-base-200/60 shadow-sm group">
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/user/${encodeURIComponent(review.user.username)}`}
              className="hover:opacity-80 transition-opacity"
            >
              <div className="avatar">
                <UserAvatar
                  username={review.user.username}
                  avatar={review.user.avatar}
                  containerClassName="w-9 h-9 rounded-full"
                  imageClassName="w-full h-full rounded-full object-cover"
                  fallbackClassName="w-full h-full rounded-full bg-base-300 flex items-center justify-center"
                  textClassName="text-xs font-semibold"
                />
              </div>
            </Link>
            <div>
              <Link
                to={`/user/${encodeURIComponent(review.user.username)}`}
                className="link link-hover"
              >
                <h4 className="font-semibold">{review.user.username}</h4>
              </Link>
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
          </div>

          <div className="flex items-center gap-1">
            <div className="dropdown dropdown-end">
              <button
                tabIndex={0}
                className="btn btn-ghost btn-xs btn-circle opacity-100 hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200"
                aria-label="Review options"
              >
                <Ellipsis className="w-4 h-4" />
              </button>
              <ul className="dropdown-content menu p-2 shadow-sm bg-base-100 rounded-box w-36 border border-base-300 z-50">
                <li>
                  <button
                    onClick={() => handleShare(review._id)}
                    className="text-success hover:bg-success/10 gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                </li>
                {isOwner && (
                  <>
                    <li>
                      <button
                        onClick={() => onEdit(review)}
                        className="text-warning hover:bg-warning/10 gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => onDelete(review._id)}
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

            {review.rating && (
              <div className="rating rating-sm rating-half pointer-events-none">
                <input
                  type="radio"
                  className="rating-hidden"
                  checked={false}
                  readOnly
                />
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
                  <input
                    key={value}
                    type="radio"
                    className={`mask mask-star ${
                      value % 1 === 0.5 ? 'mask-half-1' : 'mask-half-2'
                    } ${ratingColorClass}`}
                    checked={review.rating === value}
                    readOnly
                    tabIndex={-1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm text-base-content/85 leading-relaxed italic">
          “{review.summary}”
        </p>

        <Link
          to={`/review/${review._id}`}
          className="link link-hover link-primary text-sm mt-2 inline-flex"
        >
          Read full review
        </Link>

        <div className="flex items-center mt-4">
          <LikeButton
            isLiked={review.likes.includes(currentUserId || '')}
            likesCount={review.likes.length}
            onToggleLike={() => onLike(review._id)}
            disabled={likeDisabled}
            size="xs"
          />
        </div>
      </div>
    </div>
  );
}

export default MediaReviewCard;
