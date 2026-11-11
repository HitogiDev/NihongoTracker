import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserAvatar from '../UserAvatar';

export interface DuelVersusSide {
  username: string;
  avatar?: string;
  /** Text under the avatar, such as "You" or the username. */
  label: string;
  current: number;
  /**
   * Starting value for the progress animation. The bar renders at this value
   * and keeps the final value in `data-value` for the caller to animate.
   */
  from?: number;
}

interface DuelVersusProps {
  left: DuelVersusSide;
  right: DuelVersusSide;
  target: number;
  showProgress: boolean;
  winner?: 'left' | 'right' | null;
  /** Link the names to the profiles. Off inside overlays. */
  linkNames?: boolean;
  size?: 'md' | 'lg';
}

const AVATAR_SIZE = {
  md: 'w-14 h-14 sm:w-16 sm:h-16 rounded-full',
  lg: 'w-16 h-16 sm:w-20 sm:h-20 rounded-full',
} as const;

const AVATAR_RING = {
  left: 'rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100',
  right: 'rounded-full ring-2 ring-secondary ring-offset-2 ring-offset-base-100',
} as const;

const WINNER_RING =
  'rounded-full ring-4 ring-warning ring-offset-2 ring-offset-base-100 shadow-lg shadow-warning/40';

// The right bar is mirrored so both bars grow toward the center.
const BAR_CLASS = {
  left: 'progress progress-primary w-full',
  right: 'progress progress-secondary w-full -scale-x-100',
} as const;

function Side({
  side,
  position,
  target,
  showProgress,
  state,
  linkNames,
  size,
}: {
  side: DuelVersusSide;
  position: 'left' | 'right';
  target: number;
  showProgress: boolean;
  state: 'winner' | 'loser' | 'neutral';
  linkNames: boolean;
  size: 'md' | 'lg';
}) {
  let avatarRingClass: string = AVATAR_RING[position];
  if (state === 'winner') avatarRingClass = WINNER_RING;
  if (state === 'loser') avatarRingClass = `${AVATAR_RING[position]} opacity-50 grayscale`;
  const startValue = Math.min(side.from ?? side.current, target);
  const endValue = Math.min(side.current, target);
  const name = linkNames ? (
    <Link
      to={`/user/${encodeURIComponent(side.username)}`}
      className="link link-hover block max-w-full truncate font-semibold"
    >
      {side.label}
    </Link>
  ) : (
    <span className="block max-w-full truncate font-semibold">{side.label}</span>
  );

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <div className="relative">
        {state === 'winner' && (
          <Crown className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 fill-warning text-warning" />
        )}
        <div className={avatarRingClass}>
          <UserAvatar
            username={side.username}
            avatar={side.avatar}
            containerClassName={AVATAR_SIZE[size]}
            textClassName="text-lg font-bold"
          />
        </div>
      </div>
      <div className="w-full min-w-0 text-sm">{name}</div>
      {showProgress && (
        <div className="w-full">
          <progress
            className={BAR_CLASS[position]}
            value={startValue}
            data-value={endValue}
            max={target}
          />
          <div className="mt-0.5 text-xs tabular-nums text-base-content/70">
            <span
              className={`font-bold ${
                state === 'winner' ? 'text-success' : 'text-base-content'
              }`}
            >
              {Math.round(side.current).toLocaleString()}
            </span>
            {' / '}
            {target.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

/** Two participants face to face, with a VS badge and mirrored progress bars. */
export default function DuelVersus({
  left,
  right,
  target,
  showProgress,
  winner = null,
  linkNames = true,
  size = 'md',
}: DuelVersusProps) {
  const stateOf = (position: 'left' | 'right') => {
    if (!winner) return 'neutral';
    return winner === position ? 'winner' : 'loser';
  };

  return (
    <div className="mx-auto grid w-full max-w-lg grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 pt-5">
      <Side
        side={left}
        position="left"
        target={target}
        showProgress={showProgress}
        state={stateOf('left')}
        linkNames={linkNames}
        size={size}
      />
      <div
        className={
          size === 'lg'
            ? 'mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-base-content text-sm font-black italic text-base-100 shadow-lg sm:mt-7'
            : 'mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-base-content text-xs font-black italic text-base-100 shadow-sm sm:mt-5'
        }
        aria-hidden="true"
      >
        VS
      </div>
      <Side
        side={right}
        position="right"
        target={target}
        showProgress={showProgress}
        state={stateOf('right')}
        linkNames={linkNames}
        size={size}
      />
    </div>
  );
}
