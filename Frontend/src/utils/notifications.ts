import {
  Award,
  Bell,
  BookOpen,
  Flame,
  Heart,
  MessageCircle,
  Megaphone,
  Sparkles,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  Vote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { INotificationListItem, NotificationType } from '../types';

type NotificationKind = NotificationType | 'club_join_requests';

const ICONS: Record<NotificationKind, LucideIcon> = {
  review_like: Heart,
  review_comment: MessageCircle,
  comment_reply: MessageCircle,
  comment_like: Heart,
  mention: MessageCircle,
  follow: UserPlus,
  club_join_request: Users,
  club_join_requests: Users,
  club_join_approved: UserPlus,
  club_join_rejected: UserMinus,
  club_member_removed: UserMinus,
  club_media_added: BookOpen,
  club_voting_started: Vote,
  club_voting_finished: Vote,
  club_leadership_transferred: Users,
  media_request_approved: Sparkles,
  media_request_rejected: Sparkles,
  achievement_unlocked: Trophy,
  level_up: Award,
  goal_completed: Target,
  streak_lost: Flame,
  changelog: Megaphone,
  system: Bell,
};

/** Soft accent for the standalone icon tile (shown when there is no avatar). */
const ACCENTS: Partial<Record<NotificationKind, string>> = {
  review_like: 'text-error bg-error/10',
  comment_like: 'text-error bg-error/10',
  review_comment: 'text-info bg-info/10',
  comment_reply: 'text-info bg-info/10',
  mention: 'text-info bg-info/10',
  follow: 'text-primary bg-primary/10',
  club_join_request: 'text-primary bg-primary/10',
  club_join_requests: 'text-primary bg-primary/10',
  club_media_added: 'text-primary bg-primary/10',
  club_voting_started: 'text-primary bg-primary/10',
  club_voting_finished: 'text-primary bg-primary/10',
  club_leadership_transferred: 'text-primary bg-primary/10',
  achievement_unlocked: 'text-warning bg-warning/10',
  level_up: 'text-warning bg-warning/10',
  goal_completed: 'text-success bg-success/10',
  media_request_approved: 'text-success bg-success/10',
  club_join_approved: 'text-success bg-success/10',
  media_request_rejected: 'text-error bg-error/10',
  club_join_rejected: 'text-error bg-error/10',
  club_member_removed: 'text-error bg-error/10',
  streak_lost: 'text-error bg-error/10',
  changelog: 'text-primary bg-primary/10',
};

/**
 * Solid accent for the small badge that overlaps the avatar. It must be opaque:
 * a translucent background lets the avatar show through and the icon vanishes.
 */
const BADGE_ACCENTS: Partial<Record<NotificationKind, string>> = {
  review_like: 'bg-error text-error-content',
  comment_like: 'bg-error text-error-content',
  review_comment: 'bg-info text-info-content',
  comment_reply: 'bg-info text-info-content',
  mention: 'bg-info text-info-content',
  follow: 'bg-primary text-primary-content',
  club_join_request: 'bg-primary text-primary-content',
  club_join_requests: 'bg-primary text-primary-content',
  club_media_added: 'bg-primary text-primary-content',
  club_voting_started: 'bg-primary text-primary-content',
  club_voting_finished: 'bg-primary text-primary-content',
  club_leadership_transferred: 'bg-primary text-primary-content',
  achievement_unlocked: 'bg-warning text-warning-content',
  level_up: 'bg-warning text-warning-content',
  goal_completed: 'bg-success text-success-content',
  media_request_approved: 'bg-success text-success-content',
  club_join_approved: 'bg-success text-success-content',
  media_request_rejected: 'bg-error text-error-content',
  club_join_rejected: 'bg-error text-error-content',
  club_member_removed: 'bg-error text-error-content',
  streak_lost: 'bg-error text-error-content',
  changelog: 'bg-primary text-primary-content',
  system: 'bg-neutral text-neutral-content',
};

export function getNotificationIcon(type?: string): LucideIcon {
  return ICONS[(type ?? 'system') as NotificationKind] ?? Bell;
}

export function getNotificationAccent(type?: string): string {
  return (
    ACCENTS[(type ?? 'system') as NotificationKind] ??
    'text-base-content/70 bg-base-300'
  );
}

export function getNotificationBadgeAccent(type?: string): string {
  return (
    BADGE_ACCENTS[(type ?? 'system') as NotificationKind] ??
    'bg-neutral text-neutral-content'
  );
}

/**
 * Stored notifications carry their own `link`. Legacy derived notifications
 * (club join requests, changelog) still need the hardcoded fallbacks.
 */
export function getNotificationLink(item: INotificationListItem): string {
  if (item.link) {
    return item.link;
  }

  if (item.type === 'changelog') {
    return '/changelog';
  }

  const clubId = item.meta?.clubId || item.id;
  return `/clubs/${clubId}?tab=members`;
}

/** Show the actor avatar only when there is a real actor behind the event. */
export function getNotificationAvatar(
  item: INotificationListItem
): { username: string; avatar?: string } | null {
  const username = item.meta?.username;
  if (!username) {
    return null;
  }

  return { username, avatar: item.meta?.avatar };
}
