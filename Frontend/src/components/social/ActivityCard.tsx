import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  Film,
  Flame,
  Flag,
  Gamepad2,
  Headphones,
  Heart,
  MessageCircle,
  Tv,
  Video,
  Star,
  Target,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  removeActivityReactionFn,
  setActivityReactionFn,
} from '../../api/activitiesApi';
import { ActivityReactionType, ISocialActivity } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatRelativeDateInTimezone } from '../../utils/timezone';
import { getMediaTypeClasses } from '../../constants/mediaColors';
import { getLogTypeLabelKey } from '../../utils/logTypes';
import UserAvatar from '../UserAvatar';
import ActivityComments from './ActivityComments';
import { useUserDataStore } from '../../store/userData';

interface ActivityCardProps {
  activity: ISocialActivity;
  highlighted?: boolean;
}

function metadataString(activity: ISocialActivity, key: string): string {
  const value = activity.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function metadataNumber(activity: ISocialActivity, key: string): number {
  const value = activity.metadata?.[key];
  return typeof value === 'number' ? value : 0;
}

const LOG_TYPE_ICONS: Record<string, typeof BookOpen> = {
  anime: Tv,
  audio: Headphones,
  book: BookOpen,
  game: Gamepad2,
  manga: BookOpen,
  movie: Film,
  reading: BookOpen,
  'light-novel': BookOpen,
  'tv show': Tv,
  video: Video,
  vn: Gamepad2,
};

function mediaPath(activity: ISocialActivity): string | null {
  const mediaType =
    metadataString(activity, 'mediaType') || activity.targetType;
  const mediaId = metadataString(activity, 'mediaId') || activity.targetId;
  const supportedMediaTypes = new Set([
    'anime',
    'manga',
    'light-novel',
    'vn',
    'video',
    'audio',
    'movie',
    'tv show',
    'game',
    'book',
  ]);
  if (!supportedMediaTypes.has(mediaType)) return null;
  return mediaType && mediaId
    ? `/${encodeURIComponent(mediaType)}/${encodeURIComponent(mediaId)}`
    : null;
}

export default function ActivityCard({
  activity,
  highlighted = false,
}: ActivityCardProps) {
  const { t } = useTranslation('social');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const reactionMutation = useMutation({
    mutationFn: async (type: ActivityReactionType) => {
      if (activity.currentReaction === type) {
        await removeActivityReactionFn(activity._id);
        return;
      }

      await setActivityReactionFn(activity._id, type);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['socialActivities'] }),
        queryClient.invalidateQueries({ queryKey: ['mediaCommunity'] }),
      ]);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const mediaTitle = metadataString(activity, 'mediaTitle');
  const summary = metadataString(activity, 'summary');
  const description = metadataString(activity, 'description');
  const clubName = metadataString(activity, 'clubName');
  const achievementName = metadataString(activity, 'name');
  const challengeTitle = metadataString(activity, 'challengeTitle');
  const goalTitle = metadataString(activity, 'goalTitle');
  const mediaImage = metadataString(activity, 'mediaImage');
  const mediaType =
    metadataString(activity, 'mediaType') || activity.targetType;
  const linkedMediaPath = mediaPath(activity);
  const isImmersionActivity =
    activity.type === 'immersion_log' ||
    activity.type === 'notable_immersion_session';
  const descriptionAsSubject =
    isImmersionActivity && !linkedMediaPath ? description : '';
  const logType = metadataString(activity, 'logType').toLowerCase();
  const activityType = (logType || mediaType).toLowerCase() || 'other';
  const typeClasses = getMediaTypeClasses(activityType);
  const typeLabelKey = getLogTypeLabelKey(activityType);
  const typeLabel = typeLabelKey ? tCommon(typeLabelKey) : '';
  const hasLogType = isImmersionActivity && Boolean(typeLabel);
  const consumptionAction = logType.includes('audio')
    ? t('activity.listened')
    : ['anime', 'video', 'movie', 'tv show', 'vn'].includes(logType)
      ? t('activity.watched')
      : t('activity.read');
  const metricParts = [
    metadataNumber(activity, 'time')
      ? t('metrics.minutes', { count: metadataNumber(activity, 'time') })
      : '',
    metadataNumber(activity, 'chars')
      ? t('metrics.characters', { count: metadataNumber(activity, 'chars') })
      : '',
    metadataNumber(activity, 'pages')
      ? t('metrics.pages', { count: metadataNumber(activity, 'pages') })
      : '',
    metadataNumber(activity, 'episodes')
      ? t('metrics.episodes', { count: metadataNumber(activity, 'episodes') })
      : '',
  ].filter(Boolean);

  const activityCopy = (() => {
    switch (activity.type) {
      case 'immersion_log':
      case 'notable_immersion_session':
        return {
          Icon:
            activity.type === 'notable_immersion_session'
              ? Flame
              : (LOG_TYPE_ICONS[logType] ?? BookOpen),
          action:
            activity.type === 'notable_immersion_session'
              ? t('activity.notableSession')
              : consumptionAction,
          subject: linkedMediaPath
            ? mediaTitle
            : descriptionAsSubject || mediaTitle,
        };
      case 'achievement_unlocked':
        return {
          Icon: Award,
          action: t('activity.achievement'),
          subject: achievementName,
        };
      case 'media_review':
        return { Icon: Star, action: t('activity.review'), subject: summary };
      case 'club_joined':
        return {
          Icon: Users,
          action: t('activity.clubJoined'),
          subject: clubName,
        };
      case 'club_milestone':
        return {
          Icon: Users,
          action: t('activity.clubMilestone', {
            count: metadataNumber(activity, 'memberCount'),
          }),
          subject: clubName,
        };
      case 'club_challenge_started':
        return {
          Icon: Flag,
          action: t('activity.challengeStarted'),
          subject: challengeTitle,
        };
      case 'challenge_joined':
        return {
          Icon: Flag,
          action: t('activity.challengeJoined'),
          subject: challengeTitle,
        };
      case 'challenge_completed':
        return {
          Icon: Award,
          action: t('activity.challengeCompleted'),
          subject: challengeTitle,
        };
      case 'cooperative_goal_progress':
        return {
          Icon: Target,
          action: t('activity.goalProgress'),
          subject: goalTitle,
        };
      case 'cooperative_goal_completed':
        return {
          Icon: Award,
          action: t('activity.goalCompleted'),
          subject: goalTitle,
        };
      default:
        return { Icon: BookOpen, action: t('activity.generic'), subject: '' };
    }
  })();
  const { Icon } = activityCopy;
  const shouldBlurMedia =
    Boolean(currentUser?.settings?.blurAdultContent ?? true) &&
    (mediaType === 'vn'
      ? Boolean(activity.metadata?.isAdultImage)
      : Boolean(activity.metadata?.isAdult));

  return (
    <article
      id={`activity-${activity._id}`}
      className={`card card-sm surface-muted shadow-sm hover:shadow-lg transition-all duration-300 border ${hasLogType ? typeClasses.borderColor : 'border-base-300'} overflow-hidden ${highlighted ? 'ring-2 ring-primary' : ''}`}
    >
      {hasLogType && (
        <div className={`h-1 w-full ${typeClasses.accentColor}`} />
      )}
      <div className="card-body">
        <div className="flex items-start gap-3">
          <Link
            to={`/user/${encodeURIComponent(activity.actor.username)}`}
            className="shrink-0"
          >
            <div className="avatar">
              <UserAvatar
                username={activity.actor.username}
                avatar={activity.actor.avatar}
                containerClassName="w-11 rounded-full overflow-hidden"
                imageClassName="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                textClassName="text-sm font-semibold"
              />
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Link
                to={`/user/${encodeURIComponent(activity.actor.username)}`}
                className="link link-hover font-semibold"
              >
                {activity.actor.username}
              </Link>
            </div>
            <div className="mt-2 flex min-w-0 items-start gap-2 text-sm">
              <span className="shrink-0 text-base-content/70">
                {activityCopy.action}
              </span>
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${hasLogType ? typeClasses.color : 'text-primary'}`}
              />
              {activityCopy.subject &&
                (linkedMediaPath ? (
                  <Link
                    to={linkedMediaPath}
                    className="link link-hover min-w-0 flex-1 break-words font-medium leading-snug"
                  >
                    {activityCopy.subject}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                    {activityCopy.subject}
                  </span>
                ))}
            </div>
            {(hasLogType || activity.importance === 'important') && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasLogType && (
                  <span
                    className={`badge badge-soft badge-sm gap-1 ${typeClasses.bgColor} ${typeClasses.color}`}
                  >
                    {typeLabel}
                  </span>
                )}
                {activity.importance === 'important' && (
                  <span className="badge badge-soft badge-warning badge-sm gap-1">
                    <Star className="h-3 w-3" />
                    {t('activity.notable')}
                  </span>
                )}
              </div>
            )}
            {metricParts.length > 0 && (
              <p className="mt-1 text-sm text-base-content/70">
                {metricParts.join(' · ')}
              </p>
            )}
            {description && description !== activityCopy.subject && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/80">
                {description}
              </p>
            )}
            <p className="mt-1 text-xs text-base-content/60">
              {formatRelativeDateInTimezone(activity.occurredAt)}
            </p>
          </div>
          {mediaImage && linkedMediaPath && (
            <Link
              to={linkedMediaPath}
              className="h-24 w-16 shrink-0 overflow-hidden rounded-box ring-1 ring-base-content/10"
              aria-label={mediaTitle || activityCopy.subject}
            >
              <img
                src={mediaImage}
                alt={mediaTitle || activityCopy.subject}
                loading="lazy"
                className={`h-full w-full object-cover ${
                  shouldBlurMedia ? 'blur-md' : ''
                }`}
              />
            </Link>
          )}
        </div>

        <div className="card-actions mt-3 items-center gap-1 border-t border-base-300 pt-3">
          <button
            className={`btn btn-sm ${
              activity.currentReaction === 'like' ? 'btn-primary' : 'btn-ghost'
            }`}
            aria-label={t('reactions.like')}
            title={t('reactions.like')}
            disabled={reactionMutation.isPending || !currentUser}
            onClick={() => reactionMutation.mutate('like')}
          >
            <Heart
              className="h-4 w-4"
              fill={
                activity.currentReaction === 'like' ? 'currentColor' : 'none'
              }
            />
            {(activity.reactionCounts.like ?? 0) > 0 && (
              <span>{activity.reactionCounts.like}</span>
            )}
          </button>
          <button
            className="btn btn-ghost btn-sm ml-auto"
            disabled={!currentUser}
            onClick={() => setCommentsOpen((open) => !open)}
          >
            <MessageCircle className="h-4 w-4" />
            {activity.commentCount > 0 && <span>{activity.commentCount}</span>}
            <span className="sr-only">{t('comments.show')}</span>
          </button>
        </div>
        {commentsOpen && <ActivityComments activityId={activity._id} />}
      </div>
    </article>
  );
}
