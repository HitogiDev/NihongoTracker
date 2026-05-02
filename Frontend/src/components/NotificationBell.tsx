import { Bell, Inbox, AlertCircle, ChevronRight, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import { getNotificationSummaryFn } from '../api/notificationsApi';
import UserAvatar from './UserAvatar';
import {
  INotificationSummaryItem,
  INotificationSummarySection,
} from '../types';

const MAX_BADGE_COUNT = 99;

const formatBadgeCount = (count: number): string => {
  if (count > MAX_BADGE_COUNT) {
    return `${MAX_BADGE_COUNT}+`;
  }
  return `${count}`;
};

const getSectionStyles = (section: INotificationSummarySection) => {
  switch (section.type) {
    case 'club_join_requests':
      return {
        icon: UserPlus,
        badgeClass: 'badge-warning',
        iconBg: 'bg-warning/10',
        iconColor: 'text-warning',
      };
    default:
      return {
        icon: Bell,
        badgeClass: 'badge-primary',
        iconBg: 'bg-primary/10',
        iconColor: 'text-primary',
      };
  }
};

const getItemLink = (
  section: INotificationSummarySection,
  item: INotificationSummaryItem
): string | null => {
  if (section.type === 'club_join_requests') {
    const clubId = item.meta?.clubId || item.id;
    return `/clubs/${clubId}?tab=members`;
  }
  return null;
};

function NotificationBell() {
  const { user } = useUserDataStore();
  const isLoggedIn = Boolean(user);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: getNotificationSummaryFn,
    enabled: isLoggedIn,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const totalCount = data?.totalCount ?? 0;
  const sections = data?.sections ?? [];

  return (
    <div className="dropdown dropdown-bottom dropdown-end">
      {/* Bell Trigger */}
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm sm:btn-md btn-circle relative"
        aria-label={
          totalCount > 0 ? `Notifications (${totalCount})` : 'Notifications'
        }
      >
        <Bell className="w-4 h-4" />
        {totalCount > 0 && (
          <span className="badge badge-primary absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-0 text-[0.65rem]">
            {formatBadgeCount(totalCount)}
          </span>
        )}
      </div>

      {/* Dropdown */}
      <div
        tabIndex={0}
        className="dropdown-content z-[50] bg-base-100 text-base-content rounded-xl w-80 border border-base-300 shadow-lg mt-2"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-base-300/70">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
            {totalCount > 0 && (
              <Link
                to="/notifications"
                className="text-xs text-primary hover:underline font-medium"
              >
                View all
              </Link>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {!isLoggedIn ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-base-content/60 mb-3">
                Sign in to see your notifications.
              </p>
              <Link to="/login" className="btn btn-primary btn-sm">
                Log in
              </Link>
            </div>
          ) : isLoading ? (
            <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs"></span>
              Loading...
            </div>
          ) : isError ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
              <p className="text-sm text-base-content/60">
                Unable to load notifications.
              </p>
            </div>
          ) : sections.length === 0 ||
            sections.every((s) => s.items.length === 0) ? (
            <div className="px-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-base-200 flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-7 h-7 text-base-content/40" />
              </div>
              <p className="text-sm text-base-content/60">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="py-2">
              {sections.map((section) => {
                const styles = getSectionStyles(section);
                const SectionIcon = styles.icon;

                return (
                  <div key={section.type}>
                    {/* Section Header */}
                    <div className="px-4 py-1.5 flex items-center gap-2">
                      <SectionIcon
                        className={`w-3.5 h-3.5 ${styles.iconColor}`}
                      />
                      <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>

                    {/* Section Items */}
                    <div className="px-2 pb-2">
                      {section.items.map((item) => {
                        const link = getItemLink(section, item);
                        const showCountBadge = item.count > 1;
                        const requesterName =
                          item.meta?.username ??
                          item.label.split(' ')[0] ??
                          'U';
                        const requesterAvatar = item.meta?.avatar;

                        const content = (
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="avatar shrink-0">
                              <UserAvatar
                                username={requesterName}
                                avatar={requesterAvatar}
                                containerClassName="w-9 h-9 rounded-lg"
                                imageClassName="w-full h-full rounded-lg object-cover"
                                fallbackClassName="w-full h-full rounded-lg bg-base-300 flex items-center justify-center"
                                textClassName="text-xs font-semibold text-base-content/70"
                              />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm text-base-content leading-snug line-clamp-2">
                                {item.label}
                              </p>
                            </div>

                            {/* Right */}
                            <div className="flex items-center gap-2 shrink-0">
                              {showCountBadge && (
                                <span
                                  className={`badge ${styles.badgeClass} badge-sm`}
                                >
                                  {formatBadgeCount(item.count)}
                                </span>
                              )}
                              {link && (
                                <ChevronRight className="w-4 h-4 text-base-content/30" />
                              )}
                            </div>
                          </div>
                        );

                        const itemClass =
                          'flex items-start gap-2 rounded-lg px-2 py-2 transition-all duration-200 hover:bg-base-200';

                        return link ? (
                          <Link
                            key={`${section.type}-${item.id}`}
                            to={link}
                            className={itemClass}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div
                            key={`${section.type}-${item.id}`}
                            className={itemClass}
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {isLoggedIn && totalCount > 0 && (
          <div className="px-3 py-2 border-t border-base-300/70">
            <Link
              to="/notifications"
              className="btn btn-ghost btn-sm w-full text-primary"
            >
              View all notifications
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationBell;
