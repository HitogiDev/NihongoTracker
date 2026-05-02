import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Check,
  Inbox,
  UserPlus,
  Bell,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { getNotificationSummaryFn } from '../api/notificationsApi';
import { useUserDataStore } from '../store/userData';
import UserAvatar from '../components/UserAvatar';
import {
  INotificationSummaryItem,
  INotificationSummarySection,
  NotificationSectionType,
} from '../types';

const MAX_BADGE_COUNT = 99;

type NotificationFilterKey = 'all' | NotificationSectionType;

type NotificationFilter = {
  key: NotificationFilterKey;
  label: string;
  icon: React.ElementType;
};

const FILTERS: NotificationFilter[] = [
  { key: 'all', label: 'All', icon: Bell },
  { key: 'club_join_requests', label: 'Join Requests', icon: UserPlus },
];

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
        accentColor: 'border-l-warning',
        iconBg: 'bg-warning/10',
        iconColor: 'text-warning',
      };
    default:
      return {
        icon: Bell,
        badgeClass: 'badge-primary',
        accentColor: 'border-l-primary',
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

function NotificationsScreen() {
  const { user } = useUserDataStore();
  const [selectedFilter, setSelectedFilter] =
    useState<NotificationFilterKey>('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: getNotificationSummaryFn,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const sections = useMemo(() => data?.sections ?? [], [data?.sections]);
  const totalCount = data?.totalCount ?? 0;

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: totalCount,
    };

    sections.forEach((section) => {
      counts[section.type] = section.items.reduce(
        (sum, item) => sum + item.count,
        0
      );
    });

    return counts;
  }, [sections, totalCount]);

  const visibleSections = useMemo(() => {
    if (selectedFilter === 'all') {
      return sections;
    }
    return sections.filter((section) => section.type === selectedFilter);
  }, [sections, selectedFilter]);

  const activeFilter = FILTERS.find((f) => f.key === selectedFilter);
  const visibleItemCount = visibleSections.reduce(
    (sum, s) => sum + s.items.length,
    0
  );

  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Bell className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-base-content">
              Notifications
            </h1>
          </div>
          <p className="text-base-content/70 max-w-lg mx-auto">
            Stay on top of your club updates, join requests, and other important
            activity.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Filters */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            {/* Filter Card */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body p-4">
                <h3 className="font-semibold text-sm text-base-content/70 uppercase tracking-wider mb-3 px-2">
                  Filters
                </h3>
                <div className="space-y-1">
                  {FILTERS.map((filter) => {
                    const count = sectionCounts[filter.key] ?? 0;
                    const isSelected = selectedFilter === filter.key;
                    const FilterIcon = filter.icon;

                    return (
                      <button
                        key={filter.key}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isSelected
                            ? 'bg-primary text-primary-content shadow-sm'
                            : 'text-base-content hover:bg-base-200'
                        }`}
                        onClick={() => setSelectedFilter(filter.key)}
                      >
                        <div className="flex items-center gap-2.5">
                          <FilterIcon
                            className={`w-4 h-4 ${isSelected ? 'text-primary-content' : 'text-base-content/60'}`}
                          />
                          <span>{filter.label}</span>
                        </div>
                        {count > 0 && !isSelected && (
                          <span className="badge badge-primary badge-sm">
                            {formatBadgeCount(count)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body p-4">
                <button
                  className="btn btn-primary btn-sm gap-2 w-full"
                  disabled={totalCount === 0}
                  title={
                    totalCount === 0
                      ? 'No unread notifications'
                      : 'Mark all notifications as read'
                  }
                >
                  <Check className="w-4 h-4" />
                  Mark all as read
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Section Title */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-base-content">
                  {activeFilter?.label || 'All'}
                </h2>
                {visibleItemCount > 0 && (
                  <p className="text-sm text-base-content/60 mt-0.5">
                    {visibleItemCount} notification
                    {visibleItemCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Content States */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`notification-skeleton-${index}`}
                    className="card bg-base-100 border border-base-300 shadow-sm"
                  >
                    <div className="card-body py-4 flex items-center gap-4">
                      <div className="skeleton w-11 h-11 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-3/4" />
                        <div className="skeleton h-3 w-1/2" />
                      </div>
                      <div className="skeleton h-6 w-12 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="card-body items-center text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-3">
                    <AlertCircle className="w-8 h-8 text-error" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    Unable to load notifications
                  </h3>
                  <p className="text-sm text-base-content/60 max-w-sm mt-1">
                    Something went wrong while fetching your notifications.
                    Please try again later.
                  </p>
                </div>
              </div>
            ) : visibleSections.length === 0 ||
              visibleSections.every((s) => s.items.length === 0) ? (
              <div className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="card-body items-center text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center mb-4">
                    <Inbox className="w-10 h-10 text-base-content/40" />
                  </div>
                  <h3 className="text-xl font-semibold text-base-content mb-1">
                    All caught up
                  </h3>
                  <p className="text-sm text-base-content/60 max-w-sm">
                    {selectedFilter === 'all'
                      ? "You don't have any notifications right now."
                      : `You don't have any ${activeFilter?.label.toLowerCase()} at the moment.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {visibleSections.map((section) => {
                  const styles = getSectionStyles(section);
                  const SectionIcon = styles.icon;

                  return (
                    <div key={section.type}>
                      {/* Section Header */}
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <SectionIcon
                          className={`w-4 h-4 ${styles.iconColor}`}
                        />
                        <h3 className="text-sm font-semibold text-base-content/80 uppercase tracking-wider">
                          {section.title}
                        </h3>
                        <div className="flex-1 h-px bg-base-300/70" />
                      </div>

                      {/* Section Items */}
                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const link = getItemLink(section, item);
                          const showCountBadge = item.count > 1;
                          const requesterName =
                            item.meta?.username ??
                            item.label.split(' ')[0] ??
                            'U';
                          const requesterAvatar = item.meta?.avatar;

                          const cardContent = (
                            <div className="flex items-center gap-4">
                              {/* User Avatar */}
                              <div className="avatar shrink-0">
                                <UserAvatar
                                  username={requesterName}
                                  avatar={requesterAvatar}
                                  containerClassName="w-11 h-11 rounded-lg"
                                  imageClassName="w-full h-full rounded-lg object-cover"
                                  fallbackClassName="w-full h-full rounded-lg bg-base-300 flex items-center justify-center"
                                  textClassName="text-sm font-semibold text-base-content/70"
                                />
                              </div>

                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-base-content truncate">
                                  {item.label}
                                </p>
                                <p className="text-xs text-base-content/50 mt-0.5">
                                  {section.title}
                                </p>
                              </div>

                              {/* Right Side */}
                              <div className="flex items-center gap-3 shrink-0">
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

                          const cardClass = `card bg-base-100 border border-base-300 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 border-l-4 ${styles.accentColor}`;

                          return link ? (
                            <Link
                              key={`${section.type}-${item.id}`}
                              to={link}
                              className={`${cardClass} block`}
                            >
                              <div className="card-body py-3.5 px-4">
                                {cardContent}
                              </div>
                            </Link>
                          ) : (
                            <div
                              key={`${section.type}-${item.id}`}
                              className={cardClass}
                            >
                              <div className="card-body py-3.5 px-4">
                                {cardContent}
                              </div>
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
        </div>
      </div>
    </div>
  );
}

export default NotificationsScreen;
