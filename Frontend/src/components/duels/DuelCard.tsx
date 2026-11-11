import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Handshake, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { respondToDuelFn } from '../../api/duelsApi';
import type { DuelStatus, IDuel } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  formatDuelTimeLeft,
  getDuelOutcome,
  type DuelOutcome,
} from '../../utils/duels';
import { goalMediaTypeKey } from '../../utils/goalMediaTypes';
import { useUserDataStore } from '../../store/userData';
import Button from '../ui/Button';
import DuelVersus from './DuelVersus';

const STATUS_BADGE: Record<DuelStatus, string> = {
  pending: 'badge badge-warning badge-sm',
  active: 'badge badge-primary badge-sm',
  completed: 'badge badge-success badge-sm',
  declined: 'badge badge-ghost badge-sm',
  cancelled: 'badge badge-ghost badge-sm',
  expired: 'badge badge-ghost badge-sm',
};

// A finished duel shows its result as an accent strip and a footer line.
const OUTCOME_STYLE: Record<
  DuelOutcome,
  { strip: string; text: string; icon: LucideIcon }
> = {
  won: { strip: 'bg-success', text: 'text-success', icon: Trophy },
  lost: { strip: 'bg-error', text: 'text-error', icon: Flag },
  draw: { strip: 'bg-info', text: 'text-info', icon: Handshake },
};

export default function DuelCard({ duel }: { duel: IDuel }) {
  const { t } = useTranslation(['duels', 'common']);
  const queryClient = useQueryClient();
  const viewer = useUserDataStore((state) => state.user);
  const viewerId = viewer?._id;
  const isChallenger = duel.challenger._id === viewerId;
  const isOpponent = duel.opponent._id === viewerId;
  const outcome = getDuelOutcome(duel, viewerId);
  const rival = isChallenger ? duel.opponent : duel.challenger;
  // The viewer always faces the rival from the left side.
  const viewerOnLeft = isChallenger || isOpponent;
  const leftUser = isOpponent ? duel.opponent : duel.challenger;
  const rightUser = isOpponent ? duel.challenger : duel.opponent;
  const leftProgress = isOpponent
    ? duel.progress.opponent
    : duel.progress.challenger;
  const rightProgress = isOpponent
    ? duel.progress.challenger
    : duel.progress.opponent;
  let winnerSide: 'left' | 'right' | null = null;
  if (duel.status === 'completed' && duel.winner && !duel.isDraw) {
    winnerSide = duel.winner === leftUser._id ? 'left' : 'right';
  }

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
  } else if (outcome) {
    const { text, icon: OutcomeIcon } = OUTCOME_STYLE[outcome];
    footer = (
      <span className={`flex items-center gap-2 text-lg font-extrabold ${text}`}>
        <OutcomeIcon className="h-5 w-5" />
        {t(`card.${outcome}`)}
      </span>
    );
  }

  return (
    <article className="card surface relative overflow-hidden">
      {outcome && (
        <div
          className={`absolute inset-x-0 top-0 h-1 ${OUTCOME_STYLE[outcome].strip}`}
          aria-hidden="true"
        />
      )}
      <div className="card-body gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{summary}</h2>
          {!outcome && (
            <span className={STATUS_BADGE[duel.status]}>
              {t(`status.${duel.status}`)}
            </span>
          )}
        </div>

        <DuelVersus
          left={{
            username: leftUser.username,
            avatar: leftUser.avatar,
            label: viewerOnLeft ? t('card.you') : leftUser.username,
            current: leftProgress,
          }}
          right={{
            username: rightUser.username,
            avatar: rightUser.avatar,
            label: rightUser.username,
            current: rightProgress,
          }}
          target={duel.target}
          showProgress={showProgress}
          winner={winnerSide}
        />

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
