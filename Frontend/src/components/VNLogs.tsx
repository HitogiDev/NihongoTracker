import { useQuery } from '@tanstack/react-query';
import { getUserLogsFn, searchMediaFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { ILog, IMediaDocument } from '../types';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignMediaFn } from '../api/trackerApi';
import { useFilteredGroupedLogs } from '../hooks/useFilteredGroupedLogs.tsx';
import { useUserDataStore } from '../store/userData';
import useSearch from '../hooks/useSearch';
import { useGroupLogs } from '../hooks/useGroupLogs.tsx';

interface VNLogsProps {
  username?: string;
  isActive?: boolean;
}

function VNLogs({ username, isActive = true }: VNLogsProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVN, setSelectedVN] = useState<IMediaDocument | undefined>(
    undefined
  );
  const [selectedLogs, setSelectedLogs] = useState<ILog[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [assignedLogs, setAssignedLogs] = useState<ILog[]>([]);
  const [shouldSearch, setShouldSearch] = useState<boolean>(true);

  const { user } = useUserDataStore();
  const currentUsername = user?.username;

  const {
    data: logs,
    error: logError,
    isLoading: isLoadingLogs,
  } = useQuery({
    queryKey: ['vnLogs', username, 'vn'],
    queryFn: () => getUserLogsFn(username as string, { limit: 0, type: 'vn' }),
    enabled: !!username && isActive,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const queryClient = useQueryClient();

  const {
    data: searchResult,
    error: searchError,
    isLoading: isSearching,
  } = useSearch('vn', shouldSearch ? searchQuery : '');

  if (searchError && searchError instanceof AxiosError) {
    toast.error(searchError.response?.data.message);
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

  const groupedLogs = useGroupLogs(logs, 'vn');

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
      setSelectedVN(undefined);
      setSearchQuery('');
      setSelectedGroup(null);

      // Comprehensive query invalidation to update all related data
      queryClient.invalidateQueries({ queryKey: ['logsAssign'] });
      queryClient.invalidateQueries({ queryKey: ['logs', currentUsername] });
      queryClient.invalidateQueries({
        queryKey: ['ImmersionList', currentUsername],
      });
      // Invalidate user stats to update experience points and statistics
      queryClient.invalidateQueries({
        queryKey: ['userStats', currentUsername],
      });
      // Invalidate user profile data to update overall stats
      queryClient.invalidateQueries({
        predicate: (query) =>
          ['user', 'ranking'].includes(query.queryKey[0] as string),
      });
      // Invalidate daily goals as XP changes affect goal progress
      queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });

      toast.success('Media assigned successfully');
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
    if (!selectedVN) {
      toast.error('You need to select a visual novel!');
      return;
    }
    if (selectedLogs.length === 0) {
      toast.error('You need to select at least one log!');
      return;
    }
    assignMedia([
      {
        logsId: selectedLogs.map((log) => log._id),
        contentMedia: selectedVN,
      },
    ]);
    setShouldSearch(false);
  }, [selectedVN, selectedLogs, assignMedia]);

  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [showAutoMatchModal, setShowAutoMatchModal] = useState(false);

  const performAutoMatch = useCallback(async () => {
    setShowAutoMatchModal(false);
    setIsAutoMatching(true);
    try {
      const matches: Array<{
        logsId: string[];
        contentMedia: IMediaDocument;
      }> = [];

      // For VN, only search in our database
      for (const [groupName, logsGroup] of Object.entries(
        filteredGroupedLogs
      )) {
        try {
          const dbResults = await searchMediaFn({
            type: 'vn',
            search: groupName,
            perPage: 5,
          });

          if (dbResults && dbResults.length > 0) {
            const exactMatch = dbResults.find((vn) => {
              const titles = [
                vn.title.contentTitleRomaji,
                vn.title.contentTitleEnglish,
                vn.title.contentTitleNative,
                ...(vn.synonyms || []),
              ].filter(Boolean);

              return titles.some(
                (title) => title?.toLowerCase() === groupName.toLowerCase()
              );
            });

            if (exactMatch) {
              matches.push({
                logsId: logsGroup.map((log) => log._id),
                contentMedia: exactMatch,
              });
            }
          }
        } catch (error) {
          console.error(`DB search failed for: ${groupName}`, error);
        }
      }

      if (matches.length > 0) {
        // Split large batches to avoid "Request entity too large" errors
        const BATCH_SIZE = 50; // Process 50 assignments at a time
        const batches = [];
        for (let i = 0; i < matches.length; i += BATCH_SIZE) {
          batches.push(matches.slice(i, i + BATCH_SIZE));
        }

        let totalProcessed = 0;
        for (const batch of batches) {
          await new Promise<void>((resolve, reject) => {
            assignMedia(batch, {
              onSuccess: () => {
                totalProcessed += batch.reduce(
                  (sum, m) => sum + m.logsId.length,
                  0
                );
                resolve();
              },
              onError: (error) => {
                reject(error);
              },
            });
          });
        }

        // Update assigned logs after all batches are processed
        const assignedLogIds = matches.flatMap((m) => m.logsId);
        const newlyAssignedLogs =
          logs?.filter((log) => assignedLogIds.includes(log._id)) || [];
        setAssignedLogs((prev) => [...prev, ...newlyAssignedLogs]);

        queryClient.invalidateQueries({
          queryKey: ['vnLogs', username, 'vn'],
        });

        toast.success(
          `Auto-matched ${totalProcessed} logs to ${matches.length} visual novels`
        );
      } else {
        toast.info('No exact matches found in database');
      }
    } catch (error) {
      console.error('Auto-match error:', error);
      toast.error('Failed to auto-match logs');
    } finally {
      setIsAutoMatching(false);
    }
  }, [filteredGroupedLogs, assignMedia, logs, queryClient, username]);

  const handleAutoMatch = useCallback(async () => {
    if (Object.keys(filteredGroupedLogs).length === 0) {
      toast.info('No log groups available to match');
      return;
    }

    const groupCount = Object.keys(filteredGroupedLogs).length;
    if (groupCount > 20) {
      setShowAutoMatchModal(true);
      return;
    }

    await performAutoMatch();
  }, [filteredGroupedLogs, performAutoMatch]);

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

            <div className="flex justify-center gap-2 mt-4">
              <span className="loading loading-dots loading-sm"></span>
              <span
                className="loading loading-dots loading-sm"
                style={{ animationDelay: '0.2s' }}
              ></span>
              <span
                className="loading loading-dots loading-sm"
                style={{ animationDelay: '0.4s' }}
              ></span>
            </div>

            <div className="text-xs text-base-content/50 mt-2">
              Fetching logs from database...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (logError) {
    return (
      <div className="alert alert-error">
        <span>Error loading VN logs</span>
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      {/* Auto-match warning modal */}
      {showAutoMatchModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Large Batch Auto-Match</h3>
            <p className="py-4">
              You have {Object.keys(filteredGroupedLogs).length} log groups to
              process. This may take a few minutes to complete. Do you want to
              continue?
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowAutoMatchModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={performAutoMatch}>
                Continue
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setShowAutoMatchModal(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      <h1 className="text-2xl font-bold text-center mb-4">
        Assign Visual Novels to Logs
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 w-full">
        <div className="stats shadow flex-1">
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
        <button
          onClick={handleAutoMatch}
          disabled={
            isAutoMatching || Object.keys(filteredGroupedLogs).length === 0
          }
          className={`btn btn-secondary btn-lg ${isAutoMatching ? 'loading' : ''}`}
        >
          {isAutoMatching ? (
            <>
              <span className="loading loading-spinner"></span>
              Auto-matching...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Auto-Match All
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left panel - Log groups */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">Unassigned Logs</h2>
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
                          {group?.map((log, i) => (
                            <div
                              className="flex items-center gap-4 py-2 hover:bg-base-200 rounded-md px-2"
                              key={i}
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
                <span>No unassigned visual novel logs found.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - VN search */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">Find Matching Visual Novels</h2>
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
                placeholder="Search visual novels..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShouldSearch(true);
                }}
              />
            </label>

            <div className="overflow-y-auto max-h-[60vh]">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="mt-2">Searching visual novels...</p>
                </div>
              ) : searchResult && searchResult.length > 0 ? (
                <div className="space-y-2">
                  {searchResult.map((vn, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-3 rounded-lg hover:bg-base-300 cursor-pointer ${
                        selectedVN?.contentId === vn.contentId
                          ? 'bg-primary/10 border border-primary'
                          : ''
                      }`}
                      onClick={() => setSelectedVN(vn)}
                    >
                      <div className="w-12">
                        <label className="cursor-pointer flex items-center justify-center h-full">
                          <input
                            type="radio"
                            className="radio radio-primary radio-sm"
                            name="vn"
                            checked={selectedVN?.contentId === vn.contentId}
                            onChange={() => setSelectedVN(vn)}
                          />
                        </label>
                      </div>

                      <div className="flex gap-3">
                        {vn.contentImage && (
                          <div className="w-12 h-16 overflow-hidden rounded-md">
                            <img
                              src={vn.contentImage}
                              alt={
                                vn.title.contentTitleRomaji ||
                                vn.title.contentTitleNative
                              }
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}

                        <div className="flex flex-col">
                          <span className="font-medium">
                            {vn.title.contentTitleRomaji ||
                              vn.title.contentTitleNative}
                          </span>
                          {vn.title.contentTitleEnglish && (
                            <span className="text-sm opacity-70">
                              {vn.title.contentTitleEnglish}
                            </span>
                          )}
                          {vn.title.contentTitleNative &&
                            vn.title.contentTitleRomaji && (
                              <span className="text-sm opacity-70">
                                {vn.title.contentTitleNative}
                              </span>
                            )}
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
                  <span>No visual novels found. Try different keywords.</span>
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
                    Select a log group or enter a visual novel title to search
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
          disabled={isAssigning || !selectedVN || selectedLogs.length === 0}
          className={`btn btn-primary btn-lg ${isAssigning ? 'loading' : ''}`}
        >
          {isAssigning ? (
            <>
              <span className="loading loading-spinner"></span>
              Assigning...
            </>
          ) : (
            'Assign to Visual Novel'
          )}
        </button>
      </div>
    </div>
  );
}

export default VNLogs;
