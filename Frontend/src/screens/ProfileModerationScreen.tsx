import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import {
  ShieldAlert,
  Ban,
  Trophy,
  RefreshCw,
  Save,
  AlertTriangle,
  Clock3,
} from 'lucide-react';
import { toast } from 'react-toastify';

import {
  adminGetUserModerationFn,
  adminUpdateUserModerationFn,
} from '../api/trackerApi';
import { OutletProfileContextType } from '../types';
import { useUserDataStore } from '../store/userData';

type ModerationHistoryEntry = {
  field: 'rankingBanned' | 'banned' | 'banReason';
  previousValue: boolean | string;
  newValue: boolean | string;
  reasonSnapshot?: string;
  updatedAt: string;
  updatedByUsername?: string;
};

function formatHistoryDate(dateValue: string) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date';
  }

  return parsed.toLocaleString();
}

function getHistoryBadgeLabel(entry: ModerationHistoryEntry) {
  if (entry.field === 'rankingBanned') {
    return entry.newValue === true
      ? 'Ranking ban enabled'
      : 'Ranking ban removed';
  }

  if (entry.field === 'banned') {
    return entry.newValue === true ? 'Account banned' : 'Account unbanned';
  }

  return String(entry.newValue || '').trim()
    ? 'Ban reason updated'
    : 'Ban reason cleared';
}

function getHistoryBadgeClass(entry: ModerationHistoryEntry) {
  if (entry.field === 'rankingBanned') {
    return entry.newValue === true ? 'badge-warning' : 'badge-success';
  }

  if (entry.field === 'banned') {
    return entry.newValue === true ? 'badge-error' : 'badge-success';
  }

  return 'badge-info';
}

function getHistoryDescription(entry: ModerationHistoryEntry) {
  if (entry.field === 'banReason') {
    const previous = String(entry.previousValue || '').trim();
    const next = String(entry.newValue || '').trim();

    if (!previous && next) {
      return `Reason set to: ${next}`;
    }

    if (previous && !next) {
      return 'Reason was cleared';
    }

    return `Reason changed to: ${next || 'empty'}`;
  }

  const previous = entry.previousValue === true ? 'enabled' : 'disabled';
  const next = entry.newValue === true ? 'enabled' : 'disabled';
  return `Changed from ${previous} to ${next}`;
}

function ProfileModerationScreen() {
  const { username } = useOutletContext<OutletProfileContextType>();
  const loggedUser = useUserDataStore((state) => state.user);
  const queryClient = useQueryClient();

  const isAdmin = loggedUser?.roles?.includes('admin');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['profileModeration', username],
    queryFn: () => adminGetUserModerationFn(username),
    enabled: Boolean(username) && Boolean(isAdmin),
    staleTime: 0,
  });

  const [rankingBanned, setRankingBanned] = useState(false);
  const [banned, setBanned] = useState(false);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    if (!data?.moderation) return;

    setRankingBanned(Boolean(data.moderation.rankingBanned));
    setBanned(Boolean(data.moderation.banned));
    setBanReason(data.moderation.banReason || '');
  }, [data]);

  const sortedHistory = [...(data?.moderation?.history || [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const { mutate: saveModeration, isPending: isSaving } = useMutation({
    mutationFn: () =>
      adminUpdateUserModerationFn(username, {
        rankingBanned,
        banned,
        banReason,
      }),
    onSuccess: () => {
      toast.success('Moderation updated');
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key)) return false;
          return key.some((k) =>
            ['profileModeration', 'ranking', 'rankingSummary', 'user'].includes(
              String(k)
            )
          );
        },
      });
    },
    onError: () => {
      toast.error('Failed to update moderation');
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-3xl card bg-base-100 shadow-sm border border-error/30">
          <div className="card-body">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-error" />
              <h2 className="card-title text-error">Access denied</h2>
            </div>
            <p className="text-base-content/70">
              You need admin permissions to access profile moderation tools.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-3xl space-y-5">
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-warning" />
                  Moderation
                </h2>
                <p className="text-sm text-base-content/70 mt-1">
                  Manage moderation actions for <b>{username}</b>.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => void refetch()}
                disabled={isFetching || isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body gap-5">
            <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-base-300 px-4 py-3">
              <div className="min-w-0 flex items-start gap-3">
                <Trophy className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <span className="font-semibold text-base-content">
                    Ban from rankings
                  </span>
                  <p className="text-xs text-base-content/60 mt-1">
                    User will be hidden from global ranking and ranking summary.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-warning ml-auto mt-0.5 shrink-0"
                checked={rankingBanned}
                onChange={(e) => setRankingBanned(e.target.checked)}
              />
            </label>

            <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-base-300 px-4 py-3">
              <div className="min-w-0 flex items-start gap-3">
                <Ban className="w-5 h-5 text-error mt-0.5" />
                <div>
                  <span className="font-semibold text-base-content">
                    Ban user
                  </span>
                  <p className="text-xs text-base-content/60 mt-1">
                    User cannot log in while banned.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-error ml-auto mt-0.5 shrink-0"
                checked={banned}
                onChange={(e) => setBanned(e.target.checked)}
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-base-content">
                  Ban reason
                </span>
                <span className="text-xs text-base-content/60">
                  {banReason.length}/500
                </span>
              </div>
              <textarea
                className="textarea textarea-bordered w-full min-h-28"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Optional moderation note or ban reason"
                maxLength={500}
              />
            </div>

            <div className="card-actions justify-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => saveModeration()}
                disabled={isSaving || isLoading}
              >
                {isSaving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save moderation
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-base-content/70" />
              Moderation timeline
            </h3>

            {sortedHistory.length === 0 ? (
              <p className="text-sm text-base-content/60">
                No moderation actions recorded yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {sortedHistory.map((item, index) => {
                  const entry = item as ModerationHistoryEntry;

                  return (
                    <li
                      key={`${entry.field}-${entry.updatedAt}-${index}`}
                      className="rounded-lg border border-base-300 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`badge badge-soft ${getHistoryBadgeClass(entry)}`}
                        >
                          {getHistoryBadgeLabel(entry)}
                        </span>
                        <span className="text-xs text-base-content/60">
                          by {entry.updatedByUsername || 'Unknown admin'}
                        </span>
                        <span className="text-xs text-base-content/50">
                          {formatHistoryDate(entry.updatedAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-base-content/75">
                        {getHistoryDescription(entry)}
                      </p>

                      {entry.reasonSnapshot ? (
                        <p className="mt-2 text-xs text-base-content/60">
                          Reason snapshot: {entry.reasonSnapshot}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileModerationScreen;
