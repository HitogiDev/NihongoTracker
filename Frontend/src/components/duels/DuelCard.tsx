import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { respondToDuelFn } from '../../api/duelsApi';
import type { DuelStatus, IDuel, IDuelUser } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  formatDuelTimeLeft,
  getDuelOutcome,
  type DuelOutcome,
} from '../../utils/duels';
import { goalMediaTypeKey } from '../../utils/goalMediaTypes';
import { useUserDataStore } from '../../store/userData';
import UserAvatar from '../UserAvatar';
import Button from '../ui/Button';

const STATUS_BADGE: Record<DuelStatus, string> = {
  pending: 'badge badge-warning badge-sm',
  active: 'badge badge-primary badge-sm',
  completed: 'badge badge-success badge-sm',
  declined: 'badge badge-ghost badge-sm',
  cancelled: 'badge badge-ghost badge-sm',
  expired: 'badge badge-ghost badge-sm',
};

const OUTCOME_BADGE: Record<DuelOutcome, string> = {
  won: 'badge badge-success badge-sm',
  lost: 'badge badge-error badge-sm',
  draw: 'badge badge-info badge-sm',
};

interface ParticipantRowProps {
  user: IDuelUser;
  isViewer: boolean;
  current: number;
  target: number;
  isWinner: boolean;
  tone: 'challenger' | 'opponent';
  showProgress: boolean;
}

function ParticipantRow({
  user,
  isViewer,
  current,
  target,
  isWinner,
  tone,
  showProgress,
}: ParticipantRowProps) {
  const { t } = useTranslation('duels');
  const value = Math.min(current, target);
  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        username={user.username}
        avatar={user.avatar}
        containerClassName="w-9 h-9 rounded-full shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <Link
            to={`/user/${encodeURIComponent(user.username)}`}
            className="truncate font-medium link link-hover"
          >
            {isViewer ? t('card.you') : user.username}
          </Link>
          {showProgress && (
            <span
              className={`tabular-nums ${isWinner ? 'font-semibold text-success' : 'text-base-content/70'}`}
            >
              {t('card.progress', {
                current: Math.round(current).toLocaleString(),
                target: target.toLocaleString(),
              })}
            </span>
          )}
        </div>
        {showProgress && (
          <progress
            className={
              tone === 'challenger'
                ? 'progress progress-primary w-full'
                : 'progress progress-secondary w-full'
            }
            value={value}
            max={target}
          />
        )}
      </div>
    </div>
  );
}

export default function DuelCard({ duel }: { duel: IDuel }) {
  const { t } = useTranslation(['duels', 'common']);
  const queryClient = useQueryClient();
  const viewer = useUserDataStore((state) => state.user);
  const viewerId = viewer?._id;
  const isChallenger = duel.challenger._id === viewerId;
  const isOpponent = duel.opponent._id === viewerId;
  const outcome = getDuelOutcome(duel, viewerId);
  const rival = isChallenger ? duel.opponent : duel.challenger;

  const mutation = useMutation({
    mutationFn: (action: 'accept' | 'decline' | 'cancel' | 'rematch') =>
      respondToDuelFn(duel._id, action).then((result) => ({ result, action })),
    onSuccess: ({ action }) => {
      const toastKey = {
        accept: 'toasts.accepted',
        decline: 'toasts.declined',
        cancel: 'toasts.cancelled',
        rematch: 'toasts.rematchSent',
      } as const;
      toast.success(t(toastKey[action]));
      queryClient.invalidateQueries({ queryKey: ['duels'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const metric = t(`metrics.${duel.metric}`);
  const summary = duel.mediaType
    ? t('summary.media', {
        count: duel.durationDays,
        target: duel.target.toLocaleString(),
        metric,
        media: t(`common:mediaTypes.${goalMediaTypeKey(duel.mediaType)}`),
      })
    : t('summary.any', {
        count: duel.durationDays,
        target: duel.target.toLocaleString(),
        metric,
      });

  const showProgress = duel.status === 'active' || duel.status === 'completed';
  const msLeft = duel.endDate ? new Date(duel.endDate).getTime() - Date.now() : 0;
  const pendingMsLeft = new Date(duel.expiresAt).getTime() - Date.now();

  let footer;
  if (duel.status === 'active') {
    footer = (
      <span className="text-sm text-base-content/70">
        {msLeft > 0
          ? t('card.timeLeft', { time: formatDuelTimeLeft(msLeft) })
          : t('card.ended')}
      </span>
    );
  } else if (duel.status === 'pending') {
    footer = (
      <span className="text-sm text-base-content/70">
        {isOpponent
          ? t('card.incoming', { username: duel.challenger.username })
          : t('card.awaiting', { username: duel.opponent.username })}
        {' · '}
        {t('card.expiresIn', { time: formatDuelTimeLeft(pendingMsLeft) })}
      </span>
    );
  }

  return (
    <article className="card surface">
      <div className="card-body gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{summary}</h2>
          <div className="flex items-center gap-2">
            {outcome && (
              <span className={OUTCOME_BADGE[outcome]}>
                {t(`card.${outcome}`)}
              </span>
            )}
            <span className={STATUS_BADGE[duel.status]}>
              {t(`status.${duel.status}`)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ParticipantRow
            user={duel.challenger}
            isViewer={isChallenger}
            current={duel.progress.challenger}
            target={duel.target}
            isWinner={duel.winner === duel.challenger._id}
            tone="challenger"
            showProgress={showProgress}
          />
          <ParticipantRow
            user={duel.opponent}
            isViewer={isOpponent}
            current={duel.progress.opponent}
            target={duel.target}
            isWinner={duel.winner === duel.opponent._id}
            tone="opponent"
            showProgress={showProgress}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{footer}</div>
          <div className="flex items-center gap-2">
            {duel.status === 'pending' && isOpponent && (
              <>
                <Button
                  size="sm"
                  appearance="ghost"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate('decline')}
                >
                  {t('actions.decline')}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate('accept')}
                >
                  {t('actions.accept')}
                </Button>
              </>
            )}
            {duel.status === 'pending' && isChallenger && (
              <Button
                size="sm"
                appearance="ghost"
                loading={mutation.isPending}
                onClick={() => mutation.mutate('cancel')}
              >
                {t('actions.cancel')}
              </Button>
            )}
            {duel.status === 'completed' && (
              <Button
                size="sm"
                appearance="outline"
                loading={mutation.isPending}
                aria-label={`${t('actions.rematch')} ${rival.username}`}
                onClick={() => mutation.mutate('rematch')}
              >
                {t('actions.rematch')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
