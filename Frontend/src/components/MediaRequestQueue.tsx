import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { Link } from 'react-router-dom';
import { getMediaRequestsFn, reviewMediaRequestFn } from '../api/trackerApi';
import type { IMediaRequest, MediaRequestStatus } from '../types';
import { useDateFormatting } from '../hooks/useDateFormatting';
import { getApiErrorMessage } from '../utils/apiError';

/** The shared date formatter adds time and zone unless opted out. */
const DATE_ONLY: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: undefined,
  minute: undefined,
  timeZoneName: undefined,
};

/** Module scope: key names, never text. */
const STATUS_TABS: {
  value: MediaRequestStatus;
  labelKey: ParseKeys<'admin'>;
}[] = [
  { value: 'pending', labelKey: 'mediaRequest.status.pending' },
  { value: 'approved', labelKey: 'mediaRequest.status.approved' },
  { value: 'rejected', labelKey: 'mediaRequest.status.rejected' },
];

function StatusBadge({ status }: { status: MediaRequestStatus }) {
  const { t } = useTranslation('admin');
  const cls =
    status === 'pending'
      ? 'badge-warning'
      : status === 'approved'
        ? 'badge-success'
        : 'badge-error';
  return (
    <span className={`badge ${cls}`}>{t(`mediaRequest.status.${status}`)}</span>
  );
}

/** `tv show` is the stored value; the translation key is camelCase. */
function mediaTypeKey(type: string): ParseKeys<'admin'> {
  return `mediaRequest.types.${
    type === 'tv show' ? 'tvShow' : type
  }` as ParseKeys<'admin'>;
}

function requesterName(request: IMediaRequest): string | null {
  if (typeof request.user === 'string') return request.user;
  return request.user?.username ?? null;
}

function reviewerName(request: IMediaRequest): string | null {
  if (!request.reviewedBy) return null;
  if (typeof request.reviewedBy === 'string') return request.reviewedBy;
  return request.reviewedBy.username ?? null;
}

// Admin/mod queue for reviewing user-submitted media requests. Shared by the
// admin dashboard "Requests" tab and the /media-request page (for mods).
export default function MediaRequestQueue() {
  const { t } = useTranslation('admin');
  const { formatDate } = useDateFormatting();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MediaRequestStatus>('pending');
  const [page, setPage] = useState(1);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['mediaRequests', status, page],
    queryFn: () => getMediaRequestsFn({ status, page, limit: 20 }),
    staleTime: 10_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reviewNote,
    }: {
      id: string;
      action: 'approve' | 'reject';
      reviewNote?: string;
    }) => reviewMediaRequestFn(id, { action, reviewNote }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ['mediaRequests'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="card-title">
            {t('queue.title')}
            {data?.pendingCount ? (
              <span className="badge badge-warning ml-2">
                {t('queue.pendingCount', { count: data.pendingCount })}
              </span>
            ) : null}
          </h3>
          <div className="tabs tabs-boxed">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`tab ${status === tab.value ? 'tab-active' : ''}`}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : !data?.requests.length ? (
          <div className="py-12 text-center text-base-content/60">
            {t('queue.empty', { context: status })}
          </div>
        ) : (
          <div className="space-y-4">
            {data.requests.map((request) => {
              const note = reviewNotes[request._id] ?? '';
              const reviewer = reviewerName(request);
              return (
                <div
                  key={request._id}
                  className="border border-base-300 rounded-xl p-4 flex flex-col md:flex-row gap-4"
                >
                  {request.coverImage ? (
                    <img
                      src={request.coverImage}
                      alt=""
                      className="w-20 h-28 object-cover rounded-lg shrink-0"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">
                        {request.title.contentTitleNative}
                      </span>
                      <span className="badge badge-ghost">
                        {t(mediaTypeKey(request.type))}
                      </span>
                      {request.isAdult ? (
                        <span className="badge badge-error">18+</span>
                      ) : null}
                      <StatusBadge status={request.status} />
                    </div>
                    {(request.title.contentTitleRomaji ||
                      request.title.contentTitleEnglish) && (
                      <p className="text-sm text-base-content/70">
                        {[
                          request.title.contentTitleRomaji,
                          request.title.contentTitleEnglish,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-base-content/60 mt-1">
                      <Trans
                        t={t}
                        i18nKey="queue.requestedBy"
                        values={{
                          username:
                            requesterName(request) ??
                            t('queue.unknownRequester'),
                          date: formatDate(request.createdAt, DATE_ONLY),
                        }}
                        components={{ b: <span className="font-medium" /> }}
                      />
                    </p>
                    {request.description?.length
                      ? request.description.map((desc) => (
                          <p
                            key={desc.language}
                            className="text-sm mt-2 whitespace-pre-wrap"
                          >
                            <span className="badge badge-ghost badge-sm mr-2 uppercase">
                              {desc.language}
                            </span>
                            {desc.description}
                          </p>
                        ))
                      : null}
                    {request.note ? (
                      <p className="text-sm mt-2 italic text-base-content/70">
                        {t('queue.note', { note: request.note })}
                      </p>
                    ) : null}
                    {request.referenceUrl ? (
                      <a
                        href={request.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary text-sm break-all"
                      >
                        {request.referenceUrl}
                      </a>
                    ) : null}

                    {request.status === 'pending' ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          className="input input-bordered input-sm w-full"
                          placeholder={t('queue.reviewNotePlaceholder')}
                          value={note}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [request._id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            className="btn btn-success btn-sm"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({
                                id: request._id,
                                action: 'approve',
                                reviewNote: note || undefined,
                              })
                            }
                          >
                            {t('queue.approve')}
                          </button>
                          <button
                            className="btn btn-error btn-sm"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              reviewMutation.mutate({
                                id: request._id,
                                action: 'reject',
                                reviewNote: note || undefined,
                              })
                            }
                          >
                            {t('queue.reject')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-base-content/60">
                        {reviewer
                          ? `${t('queue.reviewedBy', { username: reviewer })} `
                          : null}
                        {request.reviewNote ? (
                          <span className="italic">"{request.reviewNote}"</span>
                        ) : null}
                        {request.status === 'approved' &&
                        request.createdMediaContentId &&
                        request.createdMediaType ? (
                          <>
                            {' '}
                            <Link
                              to={`/${request.createdMediaType}/${request.createdMediaContentId}`}
                              className="link link-primary"
                            >
                              {t('queue.viewMedia')}
                            </Link>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex justify-center mt-6">
            <div className="join">
              <button
                className="join-item btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                «
              </button>
              <button className="join-item btn btn-sm">
                Page {data.page} / {data.totalPages}
              </button>
              <button
                className="join-item btn btn-sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                »
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
