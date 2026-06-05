import { useCallback, useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ILog } from '../types';
import {
  Video,
  Clock,
  TrendingUp,
  Calendar,
  ListVideo,
  X,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { toast } from 'react-toastify';
import queryClient from '../queryClient';
import { AxiosError } from 'axios';
import { deleteLogsBulkFn, adminDeleteLogsBulkFn } from '../api/trackerApi';
import { useUserDataStore } from '../store/userData';
import LogCard from './LogCard';

const PAGE_SIZE = 10;

// Reuse the video type config from LogCard's palette
const videoTypeConfig = {
  color: 'text-[#2cc9a4]',
  bgColor: 'bg-[#2cc9a4]/10',
  borderColor: 'border-[#2cc9a4]/30',
  accentColor: 'bg-[#2cc9a4]',
};

function PlaylistBatchCard({ logs, user }: { logs: ILog[]; user?: string }) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const deleteConfirmModalRef = useRef<HTMLDialogElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { formatRelativeDate, formatDateTime } = useDateFormatting();
  const { user: currentUser } = useUserDataStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // How many logs are currently rendered in the modal list
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Determine which delete function to use (same logic as LogCard)
  const isAdmin = currentUser?.roles?.includes('admin');
  const isOwner = user === currentUser?.username;
  const shouldUseAdminEndpoints = isAdmin && !isOwner;

  // ── Bulk delete mutation ────────────────────────────────────────────────────
  // onSuccess receives (data, variables) — variables is the logIds array,
  // so we can always show the correct count in the toast without stale closures.
  const { mutate: bulkDeleteLogs, isPending: loadingBulkDelete } = useMutation(
    {
      mutationFn: async (logIds: string[]) => {
        // Single bulk-delete request — avoids concurrent Mongoose VersionError
        await (
          shouldUseAdminEndpoints
            ? adminDeleteLogsBulkFn(logIds)
            : deleteLogsBulkFn(logIds)
        );
      },
      onSuccess: (_data, variables) => {
        void queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            if (!Array.isArray(key)) return false;
            return key.some((k) => k === 'logs' || k === 'user');
          },
        });
        queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });

        // variables = the logIds array passed to mutate() — always correct
        const count = variables.length;
        toast.success(
          `${count} log${count !== 1 ? 's' : ''} deleted successfully!`
        );
        deleteConfirmModalRef.current?.close();
        setSelectedLogIds(new Set());
      },
      onError: (error) => {
        const errorMessage =
          error instanceof AxiosError
            ? error.response?.data.message
            : 'An error occurred';
        toast.error(errorMessage);
      },
    }
  );

  // ── Open / close modal ──────────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setIsModalOpen(true);
    setContentReady(false);
    setVisibleCount(PAGE_SIZE); // reset pagination each time the modal opens
    modalRef.current?.showModal();
    // Defer heavy LogCard rendering so the skeleton screen appears first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContentReady(true);
      });
    });
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setContentReady(false);
    setSelectedLogIds(new Set());
    requestAnimationFrame(() => {
      modalRef.current?.close();
    });
  }, []);

  // Handle Escape key — prevent default so we control the close sequence
  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      closeModal();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [closeModal]);

  // ── Infinite scroll via IntersectionObserver ────────────────────────────────
  useEffect(() => {
    if (!contentReady) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, logs.length));
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [contentReady, logs.length]);

  // ── Early return (after all hooks) ─────────────────────────────────────────
  if (logs.length === 0) return null;

  const representative = logs[0];
  const playlistTitle = representative.playlistBatchTitle ?? 'Playlist';

  // Aggregate stats
  const totalXp = logs.reduce((sum, l) => sum + l.xp, 0);
  const totalTime = logs.reduce((sum, l) => sum + (l.time ?? 0), 0);
  const videoCount = logs.length;

  const relativeDate = representative.unknownDate
    ? 'Unknown'
    : representative.date
      ? formatRelativeDate(representative.date)
      : '';
  const fullDate = representative.unknownDate
    ? 'Unknown date'
    : representative.date
      ? formatDateTime(representative.date)
      : '';

  const formatTime = (mins: number) => {
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const timeLabel = formatTime(totalTime);

  const channelName =
    representative.media &&
    typeof representative.media === 'object' &&
    representative.media.title?.contentTitleNative
      ? representative.media.title.contentTitleNative
      : undefined;

  // ── Selection helpers ───────────────────────────────────────────────────────
  const handleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLogIds.size === logs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(logs.map((log) => log._id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedLogIds.size === 0) return;
    deleteConfirmModalRef.current?.showModal();
  };

  const confirmBulkDelete = () => {
    bulkDeleteLogs(Array.from(selectedLogIds));
  };

  const skeletonCount = Math.min(videoCount, 5);
  const canModerate = user === currentUser?.username || isAdmin;
  const allSelected = selectedLogIds.size === logs.length && logs.length > 0;
  const someSelected =
    selectedLogIds.size > 0 && selectedLogIds.size < logs.length;

  // XP that would be lost if selected logs are deleted
  const selectedXpLoss = logs
    .filter((log) => selectedLogIds.has(log._id))
    .reduce((sum, log) => sum + log.xp, 0);

  // The slice currently shown in the list
  const visibleLogs = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Summary card ────────────────────────────────────────────────────── */}
      <article
        className={`card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 border ${videoTypeConfig.borderColor} group rounded-t-none`}
        role="article"
        aria-label={`Playlist: ${playlistTitle}`}
      >
        <div className={`h-1 w-full ${videoTypeConfig.accentColor}`} />

        <div className="card-body p-4 space-y-3">
          <header className="flex justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`badge badge-outline ${videoTypeConfig.color} gap-1 shrink-0`}
              >
                <ListVideo className="w-3 h-3" />
                <span className="text-xs font-medium">Playlist</span>
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  className="font-bold text-base leading-tight text-base-content group-hover:text-primary transition-colors duration-200"
                  title={playlistTitle}
                >
                  {playlistTitle}
                </h2>
                {channelName && (
                  <p className="text-sm text-base-content/60 mt-1 leading-tight">
                    {channelName}
                  </p>
                )}
                <p className="text-sm text-base-content/50 mt-1">
                  Logged {videoCount} video
                  {videoCount !== 1 ? 's' : ''} from this playlist
                </p>
              </div>
            </div>
          </header>

          <div className="flex flex-wrap gap-2">
            <div
              className={`badge badge-soft gap-1 ${videoTypeConfig.bgColor} ${videoTypeConfig.color}`}
            >
              <Video className="w-3 h-3" />
              <span className="text-xs">
                Videos: <span className="font-semibold">{videoCount}</span>
              </span>
            </div>
            {timeLabel && (
              <div
                className={`badge badge-soft gap-1 ${videoTypeConfig.bgColor} ${videoTypeConfig.color}`}
              >
                <Clock className="w-3 h-3" />
                <span className="text-xs">
                  Time: <span className="font-semibold">{timeLabel}</span>
                </span>
              </div>
            )}
          </div>

          <footer className="flex justify-between items-center pt-2 border-t border-base-300">
            <div className="flex items-center gap-2">
              <div
                className="tooltip tooltip-left md:tooltip-top"
                data-tip={`Total experience: ${totalXp} points`}
              >
                <div
                  className={`badge badge-outline ${videoTypeConfig.color} gap-1`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-bold">{totalXp} XP</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-xs btn-ghost gap-1 text-base-content/60 hover:text-base-content"
                onClick={openModal}
              >
                <ListVideo className="w-3 h-3" />
                View {videoCount} video{videoCount !== 1 ? 's' : ''}
              </button>
            </div>

            <div className="tooltip tooltip-left" data-tip={fullDate}>
              <time
                className="text-xs text-base-content/60 hover:text-base-content transition-colors duration-200 cursor-help flex items-center gap-1"
                dateTime={
                  !representative.unknownDate && representative.date
                    ? typeof representative.date === 'string'
                      ? representative.date
                      : representative.date.toISOString()
                    : undefined
                }
              >
                <Calendar className="w-3 h-3" />
                {relativeDate}
              </time>
            </div>
          </footer>
        </div>
      </article>

      {/* ── Videos Modal ──────────────────────────────────────────────────────── */}
      <dialog
        ref={modalRef}
        className="modal modal-bottom sm:modal-middle"
        aria-labelledby="playlist-modal-title"
      >
        <div className="modal-box max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Modal Header */}
          <div className="bg-base-200/70 backdrop-blur-sm border-b border-base-content/10 px-5 pt-5 pb-4 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${videoTypeConfig.bgColor}`}>
                    <ListVideo className={`w-4 h-4 ${videoTypeConfig.color}`} />
                  </div>
                  <h3
                    id="playlist-modal-title"
                    className="font-bold text-lg leading-tight truncate"
                  >
                    {playlistTitle}
                  </h3>
                </div>
                <p className="text-sm text-base-content/60 pl-8">
                  {videoCount} video{videoCount !== 1 ? 's' : ''} •{' '}
                  <span className={`font-semibold ${videoTypeConfig.color}`}>
                    {totalXp} XP
                  </span>
                  {timeLabel ? ` • ${timeLabel}` : ''}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-circle btn-ghost flex-shrink-0"
                onClick={closeModal}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selection toolbar (owner/admin only) */}
            {canModerate && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-content/10">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors duration-150"
                  onClick={handleSelectAll}
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : someSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary/50" />
                  ) : (
                    <Square className="w-4 h-4 text-base-content/40" />
                  )}
                  <span>
                    {allSelected
                      ? 'Deselect all'
                      : someSelected
                        ? `${selectedLogIds.size} selected`
                        : 'Select all'}
                  </span>
                </button>

                {selectedLogIds.size > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-error gap-1.5"
                    onClick={handleBulkDelete}
                    disabled={loadingBulkDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {selectedLogIds.size}{' '}
                    {selectedLogIds.size === 1 ? 'log' : 'logs'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable log list */}
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto flex-1 p-4 space-y-2"
          >
            {/* Skeletons while content loads */}
            {isModalOpen && !contentReady
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <div key={i} className="skeleton h-32 w-full rounded-xl" />
                ))
              : null}

            {/* Log rows — only the current page slice */}
            {isModalOpen && contentReady
              ? visibleLogs.map((log) => {
                  const isSelected = selectedLogIds.has(log._id);

                  return (
                    <div
                      key={log._id}
                      className={[
                        'group/row flex gap-3 items-start rounded-xl p-2 transition-all duration-150',
                        canModerate
                          ? 'cursor-pointer hover:bg-base-200/70'
                          : '',
                        isSelected
                          ? 'bg-primary/8 ring-1 ring-primary/40 shadow-sm'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        if (canModerate) handleSelectLog(log._id);
                      }}
                    >
                      {/* Custom checkbox */}
                      {canModerate && (
                        <div className="flex-shrink-0 pt-3.5 pl-1">
                          <div
                            className={[
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-base-content/30 group-hover/row:border-primary/60',
                            ].join(' ')}
                          >
                            {isSelected && (
                              <svg
                                className="w-2.5 h-2.5 text-primary-content"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {/* LogCard — stopPropagation so internal buttons
                          don't bubble up and accidentally toggle selection */}
                      <div
                        className="flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LogCard
                          log={log}
                          user={user}
                          selectionMode={canModerate}
                        />
                      </div>
                    </div>
                  );
                })
              : null}

            {/* Sentinel — triggers loading the next page when visible */}
            {isModalOpen && contentReady && (
              <div ref={sentinelRef} className="py-1">
                {hasMore && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-base-content/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading more…
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {isModalOpen && contentReady && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-base-content/50">
                <ListVideo className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No videos in this playlist</p>
              </div>
            )}
          </div>

          {/* Footer: loaded count indicator */}
          {isModalOpen && contentReady && logs.length > 0 && (
            <div className="flex-shrink-0 border-t border-base-content/10 px-5 py-2 text-xs text-base-content/40 text-center">
              Showing {Math.min(visibleCount, logs.length)} of {logs.length} videos
            </div>
          )}
        </div>

        {/* Backdrop */}
        <div className="modal-backdrop" onClick={closeModal} />
      </dialog>

      {/* ── Bulk Delete Confirmation Modal ─────────────────────────────────────── */}
      <dialog
        ref={deleteConfirmModalRef}
        className="modal modal-bottom sm:modal-middle"
        aria-labelledby="bulk-delete-modal-title"
        aria-describedby="bulk-delete-modal-desc"
      >
        <div className="modal-box border border-error/20 max-w-md">
          <div className="flex gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-error w-6 h-6" />
            </div>
            <div>
              {/*
               * Use selectedLogIds.size directly — it's live React state so
               * it's always correct when this dialog opens.
               * (The old pendingDeleteCountRef was a plain ref whose mutation
               *  didn't trigger a re-render, so the dialog always showed
               *  the previous value.)
               */}
              <h3
                id="bulk-delete-modal-title"
                className="font-bold text-lg text-error"
              >
                Delete {selectedLogIds.size}{' '}
                {selectedLogIds.size === 1 ? 'Log' : 'Logs'}?
              </h3>
              <p className="text-sm text-base-content/60 mt-0.5">
                This action cannot be undone
              </p>
            </div>
          </div>

          <div className="divider my-4" />

          <div id="bulk-delete-modal-desc" className="space-y-3">
            <p className="text-base-content text-sm">
              You are about to permanently delete{' '}
              <strong>{selectedLogIds.size}</strong>{' '}
              {selectedLogIds.size === 1 ? 'log entry' : 'log entries'} from{' '}
              <em>{playlistTitle}</em>.
            </p>

            {selectedXpLoss > 0 && (
              <div className="alert alert-warning py-3 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    You will lose {selectedXpLoss} XP
                  </div>
                  <div className="opacity-75 text-xs mt-0.5">
                    {selectedLogIds.size} log
                    {selectedLogIds.size !== 1 ? 's' : ''} •{' '}
                    {selectedLogIds.size === logs.length
                      ? 'entire playlist'
                      : `${selectedLogIds.size} of ${logs.length} videos`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-action flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={confirmBulkDelete}
              disabled={loadingBulkDelete}
              className="btn btn-error w-full sm:w-auto order-2 sm:order-1"
            >
              {loadingBulkDelete ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete {selectedLogIds.size}{' '}
                  {selectedLogIds.size === 1 ? 'Log' : 'Logs'}
                </>
              )}
            </button>
            <form
              method="dialog"
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              <button
                className="btn btn-outline w-full"
                type="submit"
                disabled={loadingBulkDelete}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close modal">close</button>
        </form>
      </dialog>
    </>
  );
}

export default PlaylistBatchCard;
