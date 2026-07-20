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
import { browseMediaListsFn, createMediaListFn } from '../api/listsApi';
import { MediaListMediaType } from '../types';
import { useUserDataStore } from '../store/userData';
import MediaListCard from '../components/MediaListCard';
import MediaListFormModal, {
  MediaListFormValues,
} from '../components/MediaListFormModal';

const MEDIA_TYPE_FILTERS: Array<{
  value: '' | MediaListMediaType;
  label: string;
}> = [
  { value: '', label: 'All types' },
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'reading', label: 'Reading' },
  { value: 'vn', label: 'Visual novels' },
  { value: 'game', label: 'Games' },
  { value: 'video', label: 'Video' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv show', label: 'TV shows' },
];

function ListsDiscoverScreen() {
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
      toast.success('List created');
      navigate(`/lists/${result.list._id}`);
    },
    onError: () => toast.error('Could not create the list'),
  });

  const lists = data?.lists ?? [];

  return (
    <div className="min-h-screen bg-base-200 pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Lists</h1>
            <p className="text-base-content/70">
              Curated media collections from the community.
            </p>
          </div>
          {currentUser && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" /> New list
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
              className="input input-bordered join-item flex-1"
              placeholder="Search lists"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn join-item">
              <Search className="w-4 h-4" />
            </button>
          </form>

          <select
            className="select select-bordered"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as typeof sort);
            }}
          >
            <option value="popular">Most liked</option>
            <option value="recent">Newest</option>
            <option value="updated">Recently updated</option>
          </select>

          <select
            className="select select-bordered"
            value={mediaType}
            onChange={(e) => {
              setPage(1);
              setMediaType(e.target.value as '' | MediaListMediaType);
            }}
          >
            {MEDIA_TYPE_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
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
            No lists found.
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
              className="btn join-item"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Previous
            </button>
            <button type="button" className="btn join-item no-animation">
              Page {page}
            </button>
            <button
              type="button"
              className="btn join-item"
              disabled={!data?.hasMore}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
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
