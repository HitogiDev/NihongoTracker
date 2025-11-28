import { ILog, IMediaDocument } from '../types';
import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignMediaFn, getUserLogsFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import useSearch from '../hooks/useSearch';
import { useUserDataStore } from '../store/userData';
import { useFilteredGroupedLogs } from '../hooks/useFilteredGroupedLogs.tsx';
import { useGroupLogs } from '../hooks/useGroupLogs.tsx';

interface TVShowLogsProps {
  username?: string;
  isActive?: boolean;
}

function TVShowLogs({ username, isActive = true }: TVShowLogsProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedShow, setSelectedShow] = useState<IMediaDocument | undefined>(
    undefined
  );
  const [selectedLogs, setSelectedLogs] = useState<ILog[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [assignedLogs, setAssignedLogs] = useState<ILog[]>([]);
  const [shouldSearch, setShouldSearch] = useState<boolean>(true);

  const { user } = useUserDataStore();
  const currentUsername = user?.username;

  const {
    data: tvShowResult,
    error: searchTvShowError,
    isLoading: isSearchingTvShow,
  } = useSearch('tv show', shouldSearch ? searchQuery : '');

  const {
    data: logs,
    error: logError,
    isLoading: isLoadingLogs,
  } = useQuery({
    queryKey: ['tvShowLogs', username, 'video'],
    queryFn: () =>
      getUserLogsFn(username as string, {
        limit: 0,
        type: ['video', 'tv show'],
      }),
    enabled: !!username && isActive,
    staleTime: 5 * 60 * 1000,
  });

  const queryClient = useQueryClient();

  if (searchTvShowError && searchTvShowError instanceof AxiosError) {
    toast.error(searchTvShowError.response?.data.message);
  }

  const handleCheckboxChange = useCallback((log: ILog) => {
    setSelectedLogs((prevSelectedLogs) =>
      prevSelectedLogs.includes(log)
        ? prevSelectedLogs.filter((selectedLog) => selectedLog !== log)
        : [...prevSelectedLogs, log]
    );
  }, []);

  const handleOpenGroup = useCallback(
    (group: ILog[] | null, title: string, groupIndex: number) => {
      if (!group) return;
      setSelectedGroup(groupIndex);
      setSelectedLogs(group);
      setSearchQuery(title);
      setShouldSearch(true);
    },
    []
  );

  const groupedLogs = useGroupLogs(logs, 'video');

  const filteredGroupedLogs = useFilteredGroupedLogs(
    logs,
    groupedLogs,
    assignedLogs
  );

  const { mutate: assignMedia, isPending: isAssigning } = useMutation({
    mutationFn: (
      data: {
        logsId: string[];
        contentMedia: IMediaDocument;
      }[]
    ) => assignMediaFn(data),
    onSuccess: () => {
      setAssignedLogs((prev) => [...prev, ...selectedLogs]);
      setSelectedLogs([]);
      setSelectedShow(undefined);
      setSearchQuery('');
      setSelectedGroup(null);

      queryClient.invalidateQueries({ queryKey: ['logsAssign'] });
      queryClient.invalidateQueries({ queryKey: ['logs', currentUsername] });
      queryClient.invalidateQueries({
        queryKey: ['ImmersionList', currentUsername],
      });
      queryClient.invalidateQueries({
        queryKey: ['userStats', currentUsername],
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          ['user', 'ranking'].includes(query.queryKey[0] as string),
      });
      queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });

      toast.success('Video logs converted to TV shows successfully');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error('Error assigning media');
      }
    },
  });

  const handleAssignMedia = useCallback(() => {
    if (!selectedShow) {
      toast.error('You need to select a TV show!');
      return;
    }
    if (selectedLogs.length === 0) {
      toast.error('You need to select at least one log!');
      return;
    }
    assignMedia([
      {
        logsId: selectedLogs.map((log) => log._id),
        contentMedia: {
          contentId: selectedShow.contentId,
          contentImage: selectedShow.contentImage,
          coverImage: selectedShow.coverImage,
          description: selectedShow.description,
          type: 'tv show',
          title: {
            contentTitleNative: selectedShow.title.contentTitleNative,
            contentTitleEnglish: selectedShow.title.contentTitleEnglish,
            contentTitleRomaji: selectedShow.title.contentTitleRomaji,
          },
          isAdult: selectedShow.isAdult,
          ...(selectedShow.episodes && {
            episodes: selectedShow.episodes,
          }),
          ...(selectedShow.episodeDuration && {
            episodeDuration: selectedShow.episodeDuration,
          }),
          ...(selectedShow.seasons && {
            seasons: selectedShow.seasons,
          }),
        } as IMediaDocument,
      },
    ]);
    setShouldSearch(false);
  }, [selectedShow, selectedLogs, assignMedia]);

  if (isLoadingLogs) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body text-center">
            <div className="flex justify-center mb-4">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
            <h2 className="card-title justify-center text-2xl mb-2">
              Loading Media Matcher
            </h2>
            <p className="text-base-content/70 mb-4">
              Preparing your logs for media matching...
            </p>
            <div className="divider">Please wait</div>
            <div className="alert alert-info">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="stroke-current shrink-0 w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <div className="text-sm">
                <div className="font-semibold">This may take a moment</div>
                <div>Loading and processing your media logs</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (logError) {
    return (
      <div className="alert alert-error">
        <span>Error loading video logs</span>
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      <h1 className="text-2xl font-bold text-center mb-4">TV Show Logs</h1>

      <div className="alert alert-info mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-current shrink-0 w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
        <span>
          View your TV show logs here. Select video logs to convert them to TV
          show type when needed.
        </span>
      </div>

      <div className="stats shadow mb-4 w-full">
        <div className="stat">
          <div className="stat-title">Selected Logs</div>
          <div className="stat-value">{selectedLogs.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Available Groups</div>
          <div className="stat-value">
            {Object.keys(filteredGroupedLogs).length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">Video Logs (Unmatched)</h2>
            <div className="divider my-1"></div>

            {Object.keys(filteredGroupedLogs).length > 0 ? (
              <div className="overflow-y-auto max-h-[60vh]">
                <div className="join join-vertical w-full">
                  {Object.entries(filteredGroupedLogs).map(
                    ([key, group], i) => (
                      <div
                        className="collapse collapse-arrow join-item border border-base-300 bg-base-100"
                        key={i}
                      >
                        <input
                          type="radio"
                          name="log-accordion"
                          checked={i === selectedGroup}
                          onChange={() => {
                            handleOpenGroup(group, key, i);
                          }}
                        />
                        <div className="collapse-title font-medium">
                          <div className="flex items-center gap-2">
                            <div className="badge badge-primary">
                              {group?.length || 0}
                            </div>
                            <span className="text-sm md:text-base">{key}</span>
                          </div>
                        </div>
                        <div className="collapse-content">
                          {group?.map((log, logIndex) => (
                            <div
                              className="flex items-center gap-4 py-2 hover:bg-base-200 rounded-md px-2"
                              key={logIndex}
                            >
                              <label onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={selectedLogs.includes(log)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleCheckboxChange(log);
                                  }}
                                />
                              </label>
                              <div className="grow">
                                <h3 className="text-sm">{log.description}</h3>
                                <p className="text-xs text-base-content/70">
                                  {new Date(log.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>No unassigned video logs found.</span>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">Find Matching TV Shows</h2>
            <div className="divider my-1"></div>

            <label className="input input-bordered input-primary flex items-center gap-2 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4 opacity-70"
              >
                <path
                  fillRule="evenodd"
                  d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="text"
                className="grow"
                placeholder="Search TV shows..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShouldSearch(true);
                }}
              />
            </label>

            <div className="overflow-y-auto max-h-[60vh]">
              {isSearchingTvShow ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="mt-2">Searching TV shows...</p>
                </div>
              ) : tvShowResult && tvShowResult.length > 0 ? (
                <div className="space-y-2">
                  {tvShowResult.map((show, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-3 rounded-lg hover:bg-base-300 cursor-pointer ${
                        selectedShow?.contentId === show.contentId
                          ? 'bg-primary/10 border border-primary'
                          : ''
                      }`}
                      onClick={() => setSelectedShow(show as IMediaDocument)}
                    >
                      <div className="w-12">
                        <label className="cursor-pointer flex items-center justify-center h-full">
                          <input
                            type="radio"
                            className="radio radio-primary radio-sm"
                            name="tvshow"
                            checked={selectedShow?.contentId === show.contentId}
                            onChange={() =>
                              setSelectedShow(show as IMediaDocument)
                            }
                          />
                        </label>
                      </div>

                      <div className="flex gap-3">
                        {show.contentImage && (
                          <div className="w-12 h-16 overflow-hidden rounded-md">
                            <img
                              src={show.contentImage}
                              alt={
                                show.title.contentTitleEnglish ||
                                show.title.contentTitleRomaji
                              }
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}

                        <div className="flex flex-col">
                          <span className="font-medium">
                            {show.title.contentTitleRomaji}
                          </span>
                          {show.title.contentTitleEnglish && (
                            <span className="text-sm opacity-70">
                              {show.title.contentTitleEnglish}
                            </span>
                          )}
                          {show.title.contentTitleNative && (
                            <span className="text-sm opacity-70">
                              {show.title.contentTitleNative}
                            </span>
                          )}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {show.episodes ? (
                              <span className="badge badge-sm">
                                {show.episodes} episodes
                              </span>
                            ) : null}
                            {show.seasons ? (
                              <span className="badge badge-sm badge-ghost">
                                {show.seasons} seasons
                              </span>
                            ) : null}
                            {show.episodeDuration ? (
                              <span className="badge badge-sm badge-outline">
                                {show.episodeDuration} min ep
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="alert alert-warning">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>No TV shows found. Try different keywords.</span>
                </div>
              ) : (
                <div className="alert alert-info">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span>
                    Select a log group or enter a TV show title to search
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Selected Logs</div>
            <div className="stat-value text-primary">{selectedLogs.length}</div>
          </div>
        </div>

        <button
          onClick={handleAssignMedia}
          disabled={isAssigning || !selectedShow || selectedLogs.length === 0}
          className={`btn btn-primary btn-lg ${isAssigning ? 'loading' : ''}`}
        >
          {isAssigning ? (
            <>
              <span className="loading loading-spinner"></span>
              Converting...
            </>
          ) : selectedLogs.some((log) => log.type === 'video') ? (
            'Convert Video Logs to TV Shows'
          ) : (
            'Assign TV Show'
          )}
        </button>
      </div>
    </div>
  );
}

export default TVShowLogs;
