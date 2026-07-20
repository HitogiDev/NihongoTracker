import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import {
  searchMediaFn,
  getMediaFn,
  adminUpdateMediaFn,
} from '../api/trackerApi';
import type { IMediaDocument, SearchResultType } from '../types';

// Types that are searchable via the meilisearch-backed /media/search endpoint.
const SEARCH_TYPES: { value: string; label: string }[] = [
  { value: 'anime', label: 'Anime' },
  { value: 'manga', label: 'Manga' },
  { value: 'reading', label: 'Reading' },
  { value: 'vn', label: 'Visual Novel' },
  { value: 'movie', label: 'Movie' },
  { value: 'tv_show', label: 'TV Show' },
  { value: 'game', label: 'Game' },
];

type EditState = IMediaDocument & {
  _genresText: string;
  _synonymsText: string;
  _platformsText: string;
  _descEng: string;
  _descJpn: string;
  _descSpa: string;
};

function descFor(media: IMediaDocument, language: 'eng' | 'jpn' | 'spa') {
  return media.description?.find((d) => d.language === language)?.description ?? '';
}

function toEditState(media: IMediaDocument): EditState {
  return {
    ...media,
    _genresText: (media.genres ?? []).join(', '),
    _synonymsText: (media.synonyms ?? []).join(', '),
    _platformsText: (media.platforms ?? []).join(', '),
    _descEng: descFor(media, 'eng'),
    _descJpn: descFor(media, 'jpn'),
    _descSpa: descFor(media, 'spa'),
  };
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parse a numeric input; empty string clears the field (null).
function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

export default function MediaEditPanel() {
  const queryClient = useQueryClient();
  const [type, setType] = useState('anime');
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['adminMediaSearch', type, debounced],
    queryFn: () => searchMediaFn({ type, search: debounced, perPage: 20 }),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<IMediaDocument>;
    }) => adminUpdateMediaFn(id, payload),
    onSuccess: (res) => {
      toast.success(res.message);
      setEdit(null);
      queryClient.invalidateQueries({ queryKey: ['adminMediaSearch'] });
    },
    onError: (error) => {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.message
          : 'Failed to update media';
      toast.error(message || 'Failed to update media');
    },
  });

  async function openEditor(result: SearchResultType) {
    try {
      setLoadingDoc(true);
      const media = await getMediaFn(result.contentId, result.type as string);
      setEdit(toEditState(media));
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoadingDoc(false);
    }
  }

  function save() {
    if (!edit?._id) return;
    const payload: Partial<IMediaDocument> = {
      title: {
        contentTitleNative: edit.title.contentTitleNative,
        contentTitleRomaji: edit.title.contentTitleRomaji,
        contentTitleEnglish: edit.title.contentTitleEnglish,
      },
      coverImage: edit.coverImage,
      contentImage: edit.contentImage,
      isAdult: edit.isAdult,
      genres: splitList(edit._genresText),
      synonyms: splitList(edit._synonymsText),
      description: (
        [
          ['eng', edit._descEng],
          ['jpn', edit._descJpn],
          ['spa', edit._descSpa],
        ] as const
      )
        .filter(([, text]) => text.trim())
        .map(([language, text]) => ({
          description: text.trim(),
          language,
        })),
    };

    // Only include type-relevant numeric/array fields.
    const t = edit.type;
    if (t === 'anime' || t === 'tv show') {
      payload.episodes = edit.episodes ?? undefined;
      payload.episodeDuration = edit.episodeDuration ?? undefined;
    }
    if (t === 'tv show') payload.seasons = edit.seasons ?? undefined;
    if (t === 'manga' || t === 'reading') {
      payload.chapters = edit.chapters ?? undefined;
      payload.volumes = edit.volumes ?? undefined;
    }
    if (t === 'manga' || t === 'reading' || t === 'vn')
      payload.characters = edit.characters ?? undefined;
    if (t === 'movie') payload.runtime = edit.runtime ?? undefined;
    if (t === 'game') payload.platforms = splitList(edit._platformsText);

    saveMutation.mutate({ id: edit._id, payload });
  }

  const numberField = (
    label: string,
    key: 'episodes' | 'episodeDuration' | 'seasons' | 'chapters' | 'volumes' | 'characters' | 'runtime'
  ) => (
    <label className="form-control">
      <div className="label">
        <span className="label-text">{label}</span>
      </div>
      <input
        type="number"
        className="input input-bordered w-full"
        value={edit?.[key] ?? ''}
        onChange={(e) =>
          setEdit((prev) =>
            prev ? { ...prev, [key]: numOrNull(e.target.value) } : prev
          )
        }
      />
    </label>
  );

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body">
        <h3 className="card-title mb-4">Edit Media</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="select select-bordered"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {SEARCH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Search media (min 2 chars)..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="mt-4">
          {isFetching ? (
            <div className="py-8 text-center">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : debounced.length < 2 ? (
            <p className="text-base-content/60 py-4">
              Type at least 2 characters to search.
            </p>
          ) : !results?.length ? (
            <p className="text-base-content/60 py-4">No media found.</p>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.contentId}`}
                  type="button"
                  className="flex w-full items-center gap-3 border border-base-300 rounded-lg p-2 text-left hover:bg-base-200 transition"
                  onClick={() => openEditor(result)}
                  disabled={loadingDoc}
                >
                  {result.contentImage ? (
                    <img
                      src={result.contentImage}
                      alt=""
                      className="w-10 h-14 object-cover rounded shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {result.title.contentTitleNative}
                    </div>
                    <div className="text-xs text-base-content/60 truncate">
                      {result.title.contentTitleEnglish ||
                        result.title.contentTitleRomaji}
                    </div>
                  </div>
                  <span className="badge badge-ghost capitalize ml-auto shrink-0">
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {edit && (
        <dialog className="modal" open>
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-1">Edit Media</h3>
            <p className="text-sm text-base-content/60 mb-4 capitalize">
              {edit.type} · {edit.contentId}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">
                    Native title <span className="text-error">*</span>
                  </span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={edit.title.contentTitleNative}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      title: {
                        ...edit.title,
                        contentTitleNative: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Romaji title</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={edit.title.contentTitleRomaji ?? ''}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      title: {
                        ...edit.title,
                        contentTitleRomaji: e.target.value,
                      },
                    })
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
                  value={edit.title.contentTitleEnglish ?? ''}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      title: {
                        ...edit.title,
                        contentTitleEnglish: e.target.value,
                      },
                    })
                  }
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Cover image URL</span>
                </div>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  value={edit.coverImage ?? ''}
                  onChange={(e) =>
                    setEdit({ ...edit, coverImage: e.target.value })
                  }
                />
              </label>
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Content image URL</span>
                </div>
                <input
                  type="url"
                  className="input input-bordered w-full"
                  value={edit.contentImage ?? ''}
                  onChange={(e) =>
                    setEdit({ ...edit, contentImage: e.target.value })
                  }
                />
              </label>

              {(edit.type === 'anime' || edit.type === 'tv show') &&
                numberField('Episodes', 'episodes')}
              {(edit.type === 'anime' || edit.type === 'tv show') &&
                numberField('Episode duration (min)', 'episodeDuration')}
              {edit.type === 'tv show' && numberField('Seasons', 'seasons')}
              {(edit.type === 'manga' || edit.type === 'reading') &&
                numberField('Chapters', 'chapters')}
              {(edit.type === 'manga' || edit.type === 'reading') &&
                numberField('Volumes', 'volumes')}
              {(edit.type === 'manga' ||
                edit.type === 'reading' ||
                edit.type === 'vn') &&
                numberField('Characters', 'characters')}
              {edit.type === 'movie' && numberField('Runtime (min)', 'runtime')}

              {edit.type === 'game' && (
                <label className="form-control md:col-span-2">
                  <div className="label">
                    <span className="label-text">
                      Platforms (comma-separated)
                    </span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={edit._platformsText}
                    onChange={(e) =>
                      setEdit({ ...edit, _platformsText: e.target.value })
                    }
                  />
                </label>
              )}

              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">Genres (comma-separated)</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={edit._genresText}
                  onChange={(e) =>
                    setEdit({ ...edit, _genresText: e.target.value })
                  }
                />
              </label>
              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">Synonyms (comma-separated)</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={edit._synonymsText}
                  onChange={(e) =>
                    setEdit({ ...edit, _synonymsText: e.target.value })
                  }
                />
              </label>

              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">Description (English)</span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  value={edit._descEng}
                  onChange={(e) =>
                    setEdit({ ...edit, _descEng: e.target.value })
                  }
                />
              </label>
              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">
                    Description (Japanese){' '}
                    <span className="label-text-alt text-base-content/50">
                      optional
                    </span>
                  </span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  value={edit._descJpn}
                  onChange={(e) =>
                    setEdit({ ...edit, _descJpn: e.target.value })
                  }
                />
              </label>
              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">
                    Description (Spanish){' '}
                    <span className="label-text-alt text-base-content/50">
                      optional
                    </span>
                  </span>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={4}
                  value={edit._descSpa}
                  onChange={(e) =>
                    setEdit({ ...edit, _descSpa: e.target.value })
                  }
                />
              </label>

              <label className="label cursor-pointer justify-start gap-3 md:col-span-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-error"
                  checked={edit.isAdult}
                  onChange={(e) =>
                    setEdit({ ...edit, isAdult: e.target.checked })
                  }
                />
                <span className="label-text">Adult content (18+)</span>
              </label>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setEdit(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
