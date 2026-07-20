import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import {
  createMediaRequestFn,
  getMyMediaRequestsFn,
} from '../api/trackerApi';
import MediaRequestQueue from '../components/MediaRequestQueue';
import type {
  ICreateMediaRequest,
  IMediaRequest,
  MediaRequestType,
} from '../types';

const MEDIA_TYPES: { value: MediaRequestType; label: string }[] = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'reading', label: 'Reading (LN/book)' },
  { value: 'vn', label: 'Visual Novel' },
  { value: 'movie', label: 'Movie' },
  { value: 'tv show', label: 'TV Show' },
  { value: 'game', label: 'Game' },
];

const EMPTY_FORM: ICreateMediaRequest = {
  title: {
    contentTitleNative: '',
    contentTitleRomaji: '',
    contentTitleEnglish: '',
  },
  type: 'anime',
  description: [],
  referenceUrl: '',
  coverImage: '',
  isAdult: false,
  note: '',
};

type DescriptionDraft = { eng: string; jpn: string; spa: string };

const EMPTY_DESCRIPTIONS: DescriptionDraft = { eng: '', jpn: '', spa: '' };

const DESCRIPTION_LANGUAGES: {
  key: keyof DescriptionDraft;
  language: 'eng' | 'jpn' | 'spa';
  label: string;
}[] = [
  { key: 'eng', language: 'eng', label: 'English' },
  { key: 'jpn', language: 'jpn', label: 'Japanese' },
  { key: 'spa', language: 'spa', label: 'Spanish' },
];

function statusBadge(status: IMediaRequest['status']) {
  const cls =
    status === 'pending'
      ? 'badge-warning'
      : status === 'approved'
        ? 'badge-success'
        : 'badge-error';
  return <span className={`badge ${cls} capitalize`}>{status}</span>;
}

export default function MediaRequestScreen() {
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ICreateMediaRequest>(EMPTY_FORM);
  const [descriptions, setDescriptions] =
    useState<DescriptionDraft>(EMPTY_DESCRIPTIONS);

  const roles = Array.isArray(user?.roles)
    ? (user?.roles as string[])
    : [user?.roles as string];
  const canReview = roles.includes('admin') || roles.includes('mod');

  const { data: mine, isLoading: mineLoading } = useQuery({
    queryKey: ['myMediaRequests'],
    queryFn: getMyMediaRequestsFn,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createMediaRequestFn,
    onSuccess: (res) => {
      toast.success(res.message);
      setForm(EMPTY_FORM);
      setDescriptions(EMPTY_DESCRIPTIONS);
      queryClient.invalidateQueries({ queryKey: ['myMediaRequests'] });
      queryClient.invalidateQueries({ queryKey: ['mediaRequests'] });
    },
    onError: (error) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : 'Failed to submit request';
      toast.error(message || 'Failed to submit request');
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.contentTitleNative.trim()) {
      toast.error('A native title is required');
      return;
    }
    createMutation.mutate({
      ...form,
      title: {
        contentTitleNative: form.title.contentTitleNative.trim(),
        contentTitleRomaji: form.title.contentTitleRomaji?.trim() || undefined,
        contentTitleEnglish:
          form.title.contentTitleEnglish?.trim() || undefined,
      },
      description: DESCRIPTION_LANGUAGES.filter(
        ({ key }) => descriptions[key].trim()
      ).map(({ key, language }) => ({
        description: descriptions[key].trim(),
        language,
      })),
      referenceUrl: form.referenceUrl?.trim() || undefined,
      coverImage: form.coverImage?.trim() || undefined,
      note: form.note?.trim() || undefined,
    });
  }

  return (
    <div className="min-h-screen bg-base-200 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Request Media</h1>
          <p className="text-base-content/70">
            Can't find a title in the database? Submit it here and an admin or
            moderator will review it.
          </p>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title mb-4">New request</h2>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">
                      Native title <span className="text-error">*</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={form.title.contentTitleNative}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        title: {
                          ...f.title,
                          contentTitleNative: e.target.value,
                        },
                      }))
                    }
                    placeholder="日本語のタイトル"
                    required
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Media type</span>
                  </div>
                  <select
                    className="select select-bordered w-full"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        type: e.target.value as MediaRequestType,
                      }))
                    }
                  >
                    {MEDIA_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Romaji title</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={form.title.contentTitleRomaji ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        title: {
                          ...f.title,
                          contentTitleRomaji: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">English title</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={form.title.contentTitleEnglish ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        title: {
                          ...f.title,
                          contentTitleEnglish: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Reference URL</span>
                  </div>
                  <input
                    type="url"
                    className="input input-bordered w-full"
                    value={form.referenceUrl ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, referenceUrl: e.target.value }))
                    }
                    placeholder="AniList / VNDB / IGDB link"
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Cover image URL</span>
                  </div>
                  <input
                    type="url"
                    className="input input-bordered w-full"
                    value={form.coverImage ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coverImage: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Descriptions{' '}
                  <span className="text-base-content/50 font-normal">
                    (all optional — fill in any languages you can)
                  </span>
                </p>
                {DESCRIPTION_LANGUAGES.map(({ key, label }) => (
                  <label key={key} className="form-control">
                    <div className="label">
                      <span className="label-text">
                        {label}{' '}
                        <span className="label-text-alt text-base-content/50">
                          optional
                        </span>
                      </span>
                    </div>
                    <textarea
                      className="textarea textarea-bordered w-full"
                      rows={3}
                      value={descriptions[key]}
                      onChange={(e) =>
                        setDescriptions((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Note to reviewer</span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  value={form.note ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Anything the reviewer should know"
                />
              </label>

              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-error"
                  checked={form.isAdult ?? false}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isAdult: e.target.checked }))
                  }
                />
                <span className="label-text">Contains adult content (18+)</span>
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Submit request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title mb-4">My requests</h2>
            {mineLoading ? (
              <div className="py-8 text-center">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : !mine?.requests.length ? (
              <p className="text-base-content/60 py-4">
                You haven't requested any media yet.
              </p>
            ) : (
              <div className="space-y-3">
                {mine.requests.map((request) => (
                  <div
                    key={request._id}
                    className="flex flex-wrap items-center justify-between gap-2 border border-base-300 rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {request.title.contentTitleNative}
                        </span>
                        <span className="badge badge-ghost capitalize">
                          {request.type}
                        </span>
                        {statusBadge(request.status)}
                      </div>
                      {request.reviewNote ? (
                        <p className="text-xs text-base-content/60 italic mt-1">
                          "{request.reviewNote}"
                        </p>
                      ) : null}
                    </div>
                    {request.status === 'approved' &&
                    request.createdMediaContentId &&
                    request.createdMediaType ? (
                      <Link
                        to={`/${request.createdMediaType}/${request.createdMediaContentId}`}
                        className="btn btn-sm btn-ghost"
                      >
                        View media
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canReview ? <MediaRequestQueue /> : null}
      </div>
    </div>
  );
}
