import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import {
  getMediaRequestsFn,
  reviewMediaRequestFn,
} from '../api/trackerApi';
import type { IMediaRequest, MediaRequestStatus } from '../types';

const STATUS_TABS: { value: MediaRequestStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadge(status: MediaRequestStatus) {
  const cls =
    status === 'pending'
      ? 'badge-warning'
      : status === 'approved'
        ? 'badge-success'
        : 'badge-error';
  return <span className={`badge ${cls} capitalize`}>{status}</span>;
}

function requesterName(request: IMediaRequest): string {
  if (typeof request.user === 'string') return request.user;
  return request.user?.username ?? 'Unknown';
}

function reviewerName(request: IMediaRequest): string | null {
  if (!request.reviewedBy) return null;
  if (typeof request.reviewedBy === 'string') return request.reviewedBy;
  return request.reviewedBy.username ?? null;
}

// Admin/mod queue for reviewing user-submitted media requests. Shared by the
// admin dashboard "Requests" tab and the /media-request page (for mods).
export default function MediaRequestQueue() {
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
    onError: () => toast.error('Failed to review request'),
  });

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="card-title">
            Media Requests
            {data?.pendingCount ? (
              <span className="badge badge-warning ml-2">
                {data.pendingCount} pending
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
                {tab.label}
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
            No {status} requests.
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
                      <span className="badge badge-ghost capitalize">
                        {request.type}
                      </span>
                      {request.isAdult ? (
                        <span className="badge badge-error">18+</span>
                      ) : null}
                      {statusBadge(request.status)}
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
                      Requested by{' '}
                      <span className="font-medium">
                        {requesterName(request)}
                      </span>{' '}
                      on {new Date(request.createdAt).toLocaleDateString()}
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
                        Note: {request.note}
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
                          placeholder="Review note (optional, shown to requester)"
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
                            Approve
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
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-base-content/60">
                        {reviewer ? <>Reviewed by {reviewer}. </> : null}
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
                              View media
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
