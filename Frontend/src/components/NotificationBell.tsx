import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Bell,
  Check,
  Inbox,
  AlertCircle,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useUserDataStore } from '../store/userData';
import {
  deleteNotificationFn,
  getNotificationListFn,
  markNotificationsAsReadFn,
} from '../api/notificationsApi';
import UserAvatar from './UserAvatar';
import { INotificationListItem } from '../types';
import { useNotificationCount } from '../hooks/useNotificationCount';

const MAX_BADGE_COUNT = 99;
const DROPDOWN_PAGE_SIZE = 5;
const DELETE_CONFIRM_STORAGE_KEY = 'notificationsDeleteConfirmDisabled';

const formatBadgeCount = (count: number): string => {
  if (count > MAX_BADGE_COUNT) {
    return `${MAX_BADGE_COUNT}+`;
  }

  return `${count}`;
};

function NotificationBell() {
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const isLoggedIn = Boolean(user);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const listSentinelRef = useRef<HTMLDivElement | null>(null);
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

  const dropdownQuery = useInfiniteQuery({
    queryKey: ['notifications', 'list', DROPDOWN_PAGE_SIZE],
    queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
      getNotificationListFn({ page: pageParam, limit: DROPDOWN_PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: isLoggedIn,
    staleTime: 1000 * 30,
    initialPageParam: 1,
  });

  const dropdownItems = useMemo(
    () => dropdownQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [dropdownQuery.data]
  );

  const markNotificationsAsReadMutation = useMutation({
    mutationFn: markNotificationsAsReadFn,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['notifications', 'summary'] });
      queryClient.refetchQueries({
        queryKey: ['notifications', 'list'],
        exact: false,
      });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: deleteNotificationFn,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['notifications', 'summary'] });
      queryClient.refetchQueries({ queryKey: ['notifications', 'list'] });
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

  const totalCount = useNotificationCount();

  useEffect(() => {
    const scrollContainer = listScrollRef.current;
    const sentinel = listSentinelRef.current;

    const hasNext = dropdownQuery.hasNextPage;
    const isFetchingNext = dropdownQuery.isFetchingNextPage;
    const fetchNext = dropdownQuery.fetchNextPage;

    if (!scrollContainer || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNext && !isFetchingNext) {
          fetchNext();
        }
      },
      { root: scrollContainer, rootMargin: '64px' }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [
    dropdownQuery.hasNextPage,
    dropdownQuery.isFetchingNextPage,
    dropdownQuery.fetchNextPage,
  ]);

  const renderNotificationItem = (item: INotificationListItem) => {
    const clubId = item.meta?.clubId || item.id;
    const link = `/clubs/${clubId}?tab=members`;
    const requesterName =
      item.meta?.username ?? item.label.split(' ')[0] ?? 'U';
    const requesterAvatar = item.meta?.avatar;
    const isUnread = !item.isRead;

    return (
      <div key={item.id} className="group relative overflow-hidden rounded-lg">
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-10 rounded-l-lg rounded-r-none bg-error text-error-content -translate-x-full transition-all duration-300 ease-out cursor-pointer hover:bg-error/90 group-hover:translate-x-0 group-hover:pointer-events-auto pointer-events-none flex items-center justify-center"
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
          className={`relative z-10 block w-full min-h-[4.25rem] rounded-lg border border-base-300/70 px-3 py-2 transition-all duration-300 ease-out group-hover:translate-x-10 group-hover:w-[calc(100%-2.5rem)] group-hover:rounded-l-none ${
            isUnread
              ? 'bg-base-100 border-l-4 border-l-primary'
              : 'bg-base-100/80 border-l-4 border-l-base-300'
          }`}
        >
          <div className="flex items-start gap-3">
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

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={`text-sm leading-snug line-clamp-2 ${
                    isUnread
                      ? 'text-base-content font-medium'
                      : 'text-base-content/65'
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
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
        </Link>
      </div>
    );
  };

  return (
    <div className="dropdown dropdown-bottom dropdown-end">
      <button
        type="button"
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
      </button>

      <div
        tabIndex={0}
        className="dropdown-content z-[50] w-80 rounded-xl border border-base-300 bg-base-100 text-base-content shadow-lg mt-2"
      >
        <div className="border-b border-base-300/70 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Notifications</span>
          </div>
        </div>

        <div
          ref={listScrollRef}
          className="h-[14rem] overflow-y-auto overscroll-contain"
        >
          {!isLoggedIn ? (
            <div className="px-4 py-6 text-center">
              <p className="mb-3 text-sm text-base-content/60">
                Sign in to see your notifications.
              </p>
              <Link to="/login" className="btn btn-primary btn-sm">
                Log in
              </Link>
            </div>
          ) : dropdownQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs"></span>
              Loading...
            </div>
          ) : dropdownQuery.isError ? (
            <div className="px-4 py-6 text-center">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 text-error" />
              <p className="text-sm text-base-content/60">
                Unable to load notifications.
              </p>
            </div>
          ) : dropdownItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-200">
                <Inbox className="h-7 w-7 text-base-content/40" />
              </div>
              <p className="text-sm text-base-content/60">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="space-y-2 px-2 py-2">
              {dropdownItems.map((item) => renderNotificationItem(item))}
              <div ref={listSentinelRef} className="h-6" />
              {dropdownQuery.isFetchingNextPage && (
                <div className="px-4 py-2 text-center text-xs text-base-content/50">
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>

        {isLoggedIn && (
          <div className="border-t border-base-300/70 px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/notifications"
                className="btn btn-ghost btn-sm text-primary"
              >
                Go to page
              </Link>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => markNotificationsAsReadMutation.mutate()}
              >
                Mark as read
              </button>
            </div>
          </div>
        )}
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

export default NotificationBell;
