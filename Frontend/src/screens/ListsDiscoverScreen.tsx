import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, Search } from 'lucide-react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { browseMediaListsFn, createMediaListFn } from '../api/listsApi';
import { MediaListMediaType } from '../types';
import { useUserDataStore } from '../store/userData';
import MediaListCard from '../components/MediaListCard';
import MediaListFormModal, {
  MediaListFormValues,
} from '../components/MediaListFormModal';

/**
 * Module scope, so it stores key names rather than text: a literal translated
 * here would be resolved once at import time and never update on a language
 * change.
 */
const MEDIA_TYPE_FILTERS: Array<{
  value: '' | MediaListMediaType;
  labelKey: ParseKeys<'media'>;
}> = [
  { value: '', labelKey: 'lists.filters.all' },
  { value: 'anime', labelKey: 'lists.filters.anime' },
  { value: 'manga', labelKey: 'lists.filters.manga' },
  { value: 'reading', labelKey: 'lists.filters.reading' },
  { value: 'vn', labelKey: 'lists.filters.vn' },
  { value: 'game', labelKey: 'lists.filters.game' },
  { value: 'video', labelKey: 'lists.filters.video' },
  { value: 'movie', labelKey: 'lists.filters.movie' },
  { value: 'tv show', labelKey: 'lists.filters.tvShow' },
  { value: 'book', labelKey: 'lists.filters.book' },
];

function ListsDiscoverScreen() {
  const { t } = useTranslation('media');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUserDataStore();

  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [sort, setSort] = useState<'popular' | 'recent' | 'updated'>('popular');
  const [mediaType, setMediaType] = useState<'' | MediaListMediaType>('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['mediaLists', { submittedSearch, sort, mediaType, page }],
    queryFn: () =>
      browseMediaListsFn({
        q: submittedSearch || undefined,
        sort,
        mediaType: mediaType || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });

  const createList = useMutation({
    mutationFn: (values: MediaListFormValues) => createMediaListFn(values),
    onSuccess: (result) => {
      setShowCreateModal(false);
      void queryClient.invalidateQueries({ queryKey: ['mediaLists'] });
      toast.success(t('lists.toast.created'));
      navigate(`/lists/${result.list._id}`);
    },
    onError: () => toast.error(t('lists.toast.createFailed')),
  });

  const lists = data?.lists ?? [];

  return (
    <div className="min-h-screen bg-base-200 pt-28 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{t('lists.discover.title')}</h1>
            <p className="text-base-content/70">
              {t('lists.discover.subtitle')}
            </p>
          </div>
          {currentUser && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" /> {t('lists.create')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <form
            className="join flex-1 min-w-64"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSubmittedSearch(search.trim());
            }}
          >
            <input
              className="input join-item flex-1"
              placeholder={t('lists.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="join-item btn btn-sm">
              <Search className="w-4 h-4" />
            </button>
          </form>

          <select
            className="select"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as typeof sort);
            }}
          >
            <option value="popular">{t('lists.sort.popular')}</option>
            <option value="recent">{t('lists.sort.recent')}</option>
            <option value="updated">{t('lists.sort.updated')}</option>
          </select>

          <select
            className="select"
            value={mediaType}
            onChange={(e) => {
              setPage(1);
              setMediaType(e.target.value as '' | MediaListMediaType);
            }}
          >
            {MEDIA_TYPE_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : lists.length === 0 ? (
          <p className="text-base-content/60 py-16 text-center">
            {t('lists.emptyDiscover')}
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-8 grid-cols-[repeat(auto-fill,278px)] justify-center sm:justify-start">
            {lists.map((list) => (
              <MediaListCard key={list._id} list={list} />
            ))}
          </div>
        )}

        {(page > 1 || data?.hasMore) && (
          <div className="join flex justify-center mt-8">
            <button
              type="button"
              className="join-item btn btn-sm"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              {t('lists.pagination.previous')}
            </button>
            <button type="button" className="join-item btn btn-sm no-animation">
              {t('lists.pagination.page', { page })}
            </button>
            <button
              type="button"
              className="join-item btn btn-sm"
              disabled={!data?.hasMore}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t('lists.pagination.next')}
            </button>
          </div>
        )}
      </div>

      <MediaListFormModal
        open={showCreateModal}
        isSubmitting={createList.isPending}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(values) => createList.mutate(values)}
      />
    </div>
  );
}

export default ListsDiscoverScreen;
