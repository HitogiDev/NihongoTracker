import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IMediaReview } from '../types';
import { BarChart3 } from 'lucide-react';

interface ReviewRatingSummaryProps {
  reviews: IMediaReview[];
  className?: string;
  reviewsTabPath: string;
  variant?: 'card' | 'inline';
}

const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function formatRatingLabel(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function ReviewRatingSummary({
  reviews,
  className = '',
  reviewsTabPath,
  variant = 'card',
}: ReviewRatingSummaryProps) {
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [pinnedBucket, setPinnedBucket] = useState<number | null>(null);

  const ratedReviews = reviews.filter(
    (review): review is IMediaReview & { rating: number } =>
      typeof review.rating === 'number'
  );

  if (ratedReviews.length === 0) {
    return null;
  }

  const totalRatings = ratedReviews.length;
  const averageRating =
    ratedReviews.reduce((sum, review) => sum + review.rating, 0) / totalRatings;
  const roundedAverage = Math.round(averageRating * 2) / 2;

  const countsByRating = new Map<number, number>();
  for (const bucket of RATING_BUCKETS) {
    countsByRating.set(bucket, 0);
  }

  for (const review of ratedReviews) {
    const current = countsByRating.get(review.rating) || 0;
    countsByRating.set(review.rating, current + 1);
  }

  const maxCount = Math.max(...Array.from(countsByRating.values()), 1);
  const activeBucket = hoveredBucket ?? pinnedBucket;
  const isInline = variant === 'inline';
  const containerClasses = isInline
    ? `w-full max-w-[22rem] ${className}`.trim()
    : `card bg-base-100 shadow-sm ${className}`.trim();
  const bodyClasses = isInline ? 'rounded-box bg-base-200/35 p-3' : 'card-body';

  return (
    <div className={containerClasses}>
      <div className={bodyClasses}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {!isInline && (
              <h2 className="card-title text-xl mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Community Rating
              </h2>
            )}

            <div className="flex items-stretch gap-0.5 h-11">
              {RATING_BUCKETS.map((bucket) => {
                const count = countsByRating.get(bucket) || 0;
                const barHeight = Math.max((count / maxCount) * 100, 20);
                const percentage = Math.round((count / totalRatings) * 100);
                const isHighlighted = activeBucket === bucket;
                const tooltipText = `${count.toLocaleString()} vote${count === 1 ? '' : 's'} • ${formatRatingLabel(bucket)}★ (${percentage}%)`;

                return (
                  <div
                    key={bucket}
                    className={`tooltip tooltip-top flex-1 ${
                      isHighlighted ? 'tooltip-open' : ''
                    }`}
                    data-tip={tooltipText}
                  >
                    <button
                      type="button"
                      className={`relative h-full w-full p-0 border-0 bg-transparent rounded-[2px] transition-colors duration-200 ${
                        isHighlighted
                          ? 'bg-primary/10'
                          : 'hover:bg-primary/10 focus-visible:bg-primary/10'
                      }`}
                      aria-label={tooltipText}
                      onMouseEnter={() => setHoveredBucket(bucket)}
                      onMouseLeave={() => setHoveredBucket(null)}
                      onFocus={() => setHoveredBucket(bucket)}
                      onBlur={() => setHoveredBucket(null)}
                      onClick={() =>
                        setPinnedBucket((current) =>
                          current === bucket ? null : bucket
                        )
                      }
                    >
                      {count > 0 && (
                        <span
                          className={`absolute inset-x-0 bottom-0 rounded-t-[2px] transition-all duration-300 ${
                            isHighlighted ? 'bg-primary' : 'bg-primary/70'
                          }`}
                          style={{ height: `${barHeight}%` }}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-base-content/50 tabular-nums">
              <span>0.5</span>
              <span>5.0</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-3xl font-semibold leading-none text-base-content tabular-nums">
              {averageRating.toFixed(1)}
            </p>
            <div className="mt-1 flex justify-end" aria-hidden>
              <div className="rating rating-xs rating-half pointer-events-none">
                <input
                  type="radio"
                  className="rating-hidden"
                  checked={false}
                  readOnly
                />
                {RATING_BUCKETS.map((value) => (
                  <input
                    key={value}
                    type="radio"
                    className={`mask mask-star ${
                      value % 1 === 0.5 ? 'mask-half-1' : 'mask-half-2'
                    } bg-primary`}
                    checked={roundedAverage === value}
                    readOnly
                    tabIndex={-1}
                  />
                ))}
              </div>
            </div>
            <Link
              to={reviewsTabPath}
              className="link link-hover mt-1 inline-block text-[11px] text-base-content/60 tabular-nums"
            >
              {totalRatings} rating{totalRatings === 1 ? '' : 's'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewRatingSummary;
