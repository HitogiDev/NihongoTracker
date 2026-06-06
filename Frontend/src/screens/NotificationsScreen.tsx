import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ScrollText,
  Bell,
  Check,
  Clock3,
  ChevronRight,
  Inbox,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUserDataStore } from '../store/userData';
import UserAvatar from '../components/UserAvatar';
import {
  deleteNotificationFn,
  getNotificationListFn,
  markNotificationsAsReadFn,
  markNotificationsAsUnreadFn,
} from '../api/notificationsApi';
import { INotificationListItem } from '../types';

const PAGE_SIZE = 15;
const MAX_BADGE_COUNT = 99;
const DELETE_CONFIRM_STORAGE_KEY = 'notificationsDeleteConfirmDisabled';

const formatBadgeCount = (count: number): string => {
  if (count > MAX_BADGE_COUNT) {
    return `${MAX_BADGE_COUNT}+`;
  }

  return `${count}`;
};

function NotificationsScreen() {
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] =
    useState<INotificationListItem | null>(null);
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(false);
  const [deleteConfirmDontShowAgain, setDeleteConfirmDontShowAgain] =
    useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setSkipDeleteConfirm(
      window.localStorage.getItem(DELETE_CONFIRM_STORAGE_KEY) === 'true'
    );
  }, []);

  const markNotificationsAsReadMutation = useMutation({
    mutationFn: markNotificationsAsReadFn,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['notifications', 'summary'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const markNotificationsAsUnreadMutation = useMutation({
    mutationFn: markNotificationsAsUnreadFn,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['notifications', 'summary'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'list'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: deleteNotificationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['notifications', 'summary'] }),
        queryClient.refetchQueries({ queryKey: ['notifications', 'list'] }),
      ]);
    },
  });

  const handleDeleteRequest = (item: INotificationListItem) => {
    if (skipDeleteConfirm) {
      deleteNotificationMutation.mutate(item.id);
      return;
    }

    setDeleteConfirmItem(item);
    setDeleteConfirmDontShowAgain(false);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmItem) {
      return;
    }

    if (deleteConfirmDontShowAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(DELETE_CONFIRM_STORAGE_KEY, 'true');
      setSkipDeleteConfirm(true);
    }

    deleteNotificationMutation.mutate(deleteConfirmItem.id);
    setDeleteConfirmOpen(false);
    setDeleteConfirmItem(null);
    setDeleteConfirmDontShowAgain(false);
  };

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
      getNotificationListFn({ page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
    initialPageParam: 1,
  });

  const notificationItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  );

  const totalCount = data?.pages[0]?.total ?? 0;
  const unreadCount = notificationItems.filter((item) => !item.isRead).length;

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: '200px' }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function renderNotificationItem(item: INotificationListItem) {
    const clubId = item.meta?.clubId || item.id;
    const type = item.type || 'club_join_requests';
    const link =
      type === 'changelog' ? `/changelog` : `/clubs/${clubId}?tab=members`;
    const requesterName =
      item.meta?.username ?? item.label.split(' ')[0] ?? 'U';
    const requesterAvatar = item.meta?.avatar;
    const isUnread = !item.isRead;
    const timeLabel = formatDistanceToNow(new Date(item.createdAt), {
      addSuffix: true,
    });

    return (
      <div key={item.id} className="group relative overflow-hidden rounded-lg">
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-12 rounded-l-lg rounded-r-none bg-error text-error-content border-r-4 border-r-primary -translate-x-full transition-transform duration-300 ease-out cursor-pointer hover:bg-error/90 group-hover:translate-x-0 group-hover:pointer-events-auto pointer-events-none flex items-center justify-center z-10"
          title="Delete notification"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleDeleteRequest(item);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <Link
          to={link}
          className={`card w-full bg-base-100 border shadow-sm hover:shadow-md group-hover:border-primary/30 transition-[padding] duration-300 ease-out border-l-4 pr-12 group-hover:pl-12 rounded-lg ${
            isUnread ? 'border-l-primary' : 'border-l-base-300 opacity-80'
          }`}
        >
          <div className="card-body py-3.5 px-4">
            <div className="flex items-start gap-4">
              <div className="avatar shrink-0">
                {type === 'changelog' ? (
                  <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <ScrollText className="w-5 h-5" />
                  </div>
                ) : (
                  <UserAvatar
                    username={requesterName}
                    avatar={requesterAvatar}
                    containerClassName="w-11 h-11 rounded-lg"
                    imageClassName="w-full h-full rounded-lg object-cover"
                    fallbackClassName="w-full h-full rounded-lg bg-base-300 flex items-center justify-center"
                    textClassName="text-sm font-semibold text-base-content/70"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`text-sm font-medium truncate ${
                      isUnread ? 'text-base-content' : 'text-base-content/65'
                    }`}
                  >
                    {item.label}
                  </p>
                  <span
                    className={`badge badge-sm ${
                      isUnread ? 'badge-primary' : 'badge-ghost'
                    }`}
                  >
                    {isUnread ? 'Unread' : 'Read'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-base-content/50">
                  <Clock3 className="w-3 h-3" />
                  <span>{timeLabel}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {item.count > 1 && (
                  <span
                    className={`badge badge-sm ${
                      isUnread ? 'badge-warning' : 'badge-ghost'
                    }`}
                  >
                    {formatBadgeCount(item.count)}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-base-content/30" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Bell className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-base-content">
              Notifications
            </h1>
          </div>
          <p className="text-base-content/70 max-w-lg mx-auto">
            Browse every notification, including the ones you have already read.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-base-200 p-3">
                    <div className="text-xs uppercase tracking-wider text-base-content/50">
                      Total
                    </div>
                    <div className="text-2xl font-semibold">{totalCount}</div>
                  </div>
                  <div className="rounded-lg bg-base-200 p-3">
                    <div className="text-xs uppercase tracking-wider text-base-content/50">
                      Unread
                    </div>
                    <div className="text-2xl font-semibold">{unreadCount}</div>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm gap-2 w-full"
                  disabled={unreadCount === 0}
                  onClick={() => {
                    markNotificationsAsReadMutation.mutate();
                  }}
                  title={
                    unreadCount === 0
                      ? 'No unread notifications'
                      : 'Mark all notifications as read'
                  }
                >
                  <Check className="w-4 h-4" />
                  Mark as read
                </button>

                <button
                  className="btn btn-outline btn-sm gap-2 w-full"
                  onClick={() => markNotificationsAsUnreadMutation.mutate()}
                  title="Mark all notifications as unread"
                >
                  <Inbox className="w-4 h-4" />
                  Mark as unread
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-base-content">
                  All notifications
                </h2>
                <p className="text-sm text-base-content/60 mt-0.5">
                  Showing {notificationItems.length} of {totalCount}{' '}
                  notification
                  {totalCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

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
                    <Bell className="w-8 h-8 text-error" />
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
            ) : notificationItems.length === 0 ? (
              <div className="card bg-base-100 border border-base-300 shadow-sm">
                <div className="card-body items-center text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center mb-4">
                    <Inbox className="w-10 h-10 text-base-content/40" />
                  </div>
                  <h3 className="text-xl font-semibold text-base-content mb-1">
                    All caught up
                  </h3>
                  <p className="text-sm text-base-content/60 max-w-sm">
                    You do not have any notifications right now.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {notificationItems.map((item) => renderNotificationItem(item))}

                <div ref={loadMoreRef} className="h-8" />

                {isFetchingNextPage && (
                  <div className="flex items-center justify-center gap-2 text-sm text-base-content/60 py-4">
                    <span className="loading loading-spinner loading-xs"></span>
                    Loading more...
                  </div>
                )}

                {!hasNextPage && notificationItems.length > 0 && (
                  <div className="text-center text-sm text-base-content/50 py-2">
                    You have reached the end.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <dialog className={`modal ${deleteConfirmOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-sm border border-base-300 bg-base-100 text-base-content shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-error/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-base-content">
                Delete notification?
              </h3>
              <p className="text-sm text-base-content/70">
                This removes it from your notifications.
              </p>
            </div>
          </div>

          <p className="text-sm text-base-content/80 mb-4">
            {deleteConfirmItem?.label}
          </p>

          <label className="label cursor-pointer justify-start gap-3 py-2 text-base-content">
            <input
              type="checkbox"
              className="checkbox checkbox-primary checkbox-sm"
              checked={deleteConfirmDontShowAgain}
              onChange={(event) =>
                setDeleteConfirmDontShowAgain(event.target.checked)
              }
            />
            <span className="label-text flex items-center gap-2 text-base-content/90">
              Don't show again
            </span>
          </label>

          <div className="modal-action mt-5 gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteConfirmItem(null);
                setDeleteConfirmDontShowAgain(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error gap-2"
              onClick={handleConfirmDelete}
            >
              <Check className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            aria-label="Close delete confirmation"
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmItem(null);
              setDeleteConfirmDontShowAgain(false);
            }}
          >
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}

export default NotificationsScreen;
