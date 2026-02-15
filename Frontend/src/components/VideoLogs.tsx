import { ILog, IMediaDocument } from '../types';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  assignMediaFn,
  getUserLogsFn,
  searchYouTubeVideoFn,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { useUserDataStore } from '../store/userData';
import { useFilteredGroupedLogs } from '../hooks/useFilteredGroupedLogs.tsx';
import { useGroupLogs } from '../hooks/useGroupLogs.tsx';

interface VideoLogsProps {
  username?: string;
  isActive?: boolean;
}

function VideoLogs({ username, isActive = true }: VideoLogsProps) {
  const [selectedLogs, setSelectedLogs] = useState<ILog[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [assignedLogs, setAssignedLogs] = useState<ILog[]>([]);
  const [autoMatchingProgress, setAutoMatchingProgress] = useState<{
    current: number;
    total: number;
    isRunning: boolean;
  }>({ current: 0, total: 0, isRunning: false });

  const { user } = useUserDataStore();
  const currentUsername = user?.username;

  const {
    data: logs,
    error: logError,
    isLoading: isLoadingLogs,
  } = useQuery({
    queryKey: ['videoLogs', username, 'video'],
    queryFn: () =>
      getUserLogsFn(username as string, { limit: 0, type: 'video' }),
    enabled: !!username && isActive,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const queryClient = useQueryClient();

  const handleCheckboxChange = useCallback((log: ILog) => {
    setSelectedLogs((prevSelectedLogs) =>
      prevSelectedLogs.includes(log)
        ? prevSelectedLogs.filter((selectedLog) => selectedLog !== log)
        : [...prevSelectedLogs, log]
    );
  }, []);

  const handleOpenGroup = useCallback(
    (group: ILog[] | null, groupIndex: number) => {
      if (!group) return;
      setSelectedGroup(groupIndex);
      setSelectedLogs(group);
    },
    []
  );

  const extractYouTubeUrl = useCallback(
    (description: string): string | null => {
      const youtubeRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#\s]+)/;
      const match = description.match(youtubeRegex);
      return match ? match[0] : null;
    },
    []
  );

  const groupedLogs = useGroupLogs(logs, 'video');

  const filteredGroupedLogs = useFilteredGroupedLogs(
    logs,
    groupedLogs,
    assignedLogs
  );

  const logsWithYouTubeUrls = (() => {
    if (!logs) return [];
    return logs.filter((log) => {
      if (log.mediaId || !log.description) return false;
      return extractYouTubeUrl(log.description) !== null;
    });
  })();

  const { mutate: assignMedia, isPending: isAssigning } = useMutation({
    mutationFn: (
      data: {
        logsId: string[];
        contentMedia: IMediaDocument;
      }[]
    ) => assignMediaFn(data),
    onSuccess: (_, variables) => {
      if (!autoMatchingProgress.isRunning) {
        const totalLogs = variables.reduce(
          (sum, item) => sum + item.logsId.length,
          0
        );
        const channelCount = variables.length;

        setAssignedLogs((prev) => [...prev, ...selectedLogs]);
        setSelectedLogs([]);
        setSelectedGroup(null);

        queryClient.invalidateQueries({
          queryKey: ['videoLogs', username, 'video'],
        });
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

        toast.success(
          `Successfully assigned ${totalLogs} video logs to ${channelCount} YouTube channels`
        );
      }
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error('Error assigning media');
      }
    },
  });

  const handleAutoMatch = useCallback(async () => {
    if (logsWithYouTubeUrls.length === 0) {
      toast.info('No video logs with YouTube URLs found to auto-match');
      return;
    }

    setAutoMatchingProgress({
      current: 0,
      total: logsWithYouTubeUrls.length,
      isRunning: true,
    });

    const channelGroups = new Map<
      string,
      { logs: ILog[]; channel: IMediaDocument }
    >();
    let processed = 0;

    try {
      for (const log of logsWithYouTubeUrls) {
        const youtubeUrl = extractYouTubeUrl(log.description!);
        if (!youtubeUrl) continue;

        try {
          const result = await searchYouTubeVideoFn(youtubeUrl);
          if (result?.channel) {
            const channelId = result.channel.contentId;

            if (channelGroups.has(channelId)) {
              channelGroups.get(channelId)!.logs.push(log);
            } else {
              channelGroups.set(channelId, {
                logs: [log],
                channel: result.channel,
              });
            }
          }
        } catch (error) {
          console.error(
            `Failed to process YouTube URL for log ${log._id}:`,
            error
          );
        }

        processed++;
        setAutoMatchingProgress((prev) => ({ ...prev, current: processed }));
      }

      const assignmentData = Array.from(channelGroups.values()).map(
        ({ logs, channel }) => ({
          logsId: logs.map((log) => log._id),
          contentMedia: {
            contentId: channel.contentId,
            contentImage: channel.contentImage,
            coverImage: channel.contentImage,
            description: channel.description,
            type: 'video' as const,
            title: channel.title,
            isAdult: channel.isAdult,
          } as IMediaDocument,
        })
      );

      if (assignmentData.length > 0) {
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < assignmentData.length; i += BATCH_SIZE) {
          batches.push(assignmentData.slice(i, i + BATCH_SIZE));
        }

        let totalProcessed = 0;
        for (const batch of batches) {
          await new Promise<void>((resolve, reject) => {
            assignMedia(batch, {
              onSuccess: () => {
                totalProcessed += batch.reduce(
                  (sum, item) => sum + item.logsId.length,
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

        // Show final success message
        const totalChannels = assignmentData.length;
        toast.success(
          `Successfully assigned ${totalProcessed} video logs to ${totalChannels} YouTube channels`
        );

        // Update state after all batches are processed
        setAssignedLogs((prev) => [...prev, ...selectedLogs]);
        setSelectedLogs([]);
        setSelectedGroup(null);

        // Comprehensive query invalidation to update all related data
        queryClient.invalidateQueries({
          queryKey: ['videoLogs', username, 'video'],
        });
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
      } else {
        toast.info('No valid YouTube channels found for auto-matching');
      }
    } catch (error) {
      toast.error('Error during auto-matching process');
      console.error('Auto-matching error:', error);
    } finally {
      setAutoMatchingProgress({ current: 0, total: 0, isRunning: false });
    }
  }, [
    logsWithYouTubeUrls,
    extractYouTubeUrl,
    assignMedia,
    queryClient,
    currentUsername,
    username,
    selectedLogs,
  ]);

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
      <h1 className="text-2xl font-bold text-center mb-4">
        Assign YouTube Channels to Video Logs
      </h1>

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
        <div className="stat">
          <div className="stat-title">Auto-Matchable</div>
          <div className="stat-value text-success">
            {logsWithYouTubeUrls.length}
          </div>
        </div>
      </div>

      {/* Auto-match section */}
      {logsWithYouTubeUrls.length > 0 && (
        <div className="card bg-primary/10 border border-primary mb-6">
          <div className="card-body">
            <h3 className="card-title text-primary">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Auto-Match YouTube Videos
            </h3>
            <p className="text-sm mb-4">
              Found {logsWithYouTubeUrls.length} video logs with YouTube URLs
              that can be automatically matched to their channels.
            </p>

            {autoMatchingProgress.isRunning ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Auto-matching in progress...</span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={autoMatchingProgress.current}
                  max={autoMatchingProgress.total}
                ></progress>
                <p className="text-sm text-base-content/70">
                  Processing {autoMatchingProgress.current} of{' '}
                  {autoMatchingProgress.total} videos
                </p>
              </div>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleAutoMatch}
                disabled={isAssigning}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Auto-Match {logsWithYouTubeUrls.length} Videos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual matching section */}
      <div className="card bg-base-200 shadow-lg">
        <div className="card-body p-4">
          <h2 className="card-title">Manual Video Log Groups</h2>
          <div className="divider my-1"></div>

          {Object.keys(filteredGroupedLogs).length > 0 ? (
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="join join-vertical w-full">
                {Object.entries(filteredGroupedLogs).map(([key, group], i) => (
                  <div
                    className="collapse collapse-arrow join-item border border-base-300 bg-base-100"
                    key={i}
                  >
                    <input
                      type="radio"
                      name="log-accordion"
                      checked={i === selectedGroup}
                      onChange={() => {
                        handleOpenGroup(group, i);
                      }}
                    />
                    <div className="collapse-title font-medium">
                      <div className="flex items-center gap-2">
                        <div className="badge badge-primary">
                          {group?.length || 0}
                        </div>
                        <span className="text-sm md:text-base">{key}</span>
                        {group &&
                          group[0] &&
                          extractYouTubeUrl(group[0].description || '') && (
                            <div className="badge badge-success badge-sm">
                              <svg
                                className="w-3 h-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                              </svg>
                              YouTube
                            </div>
                          )}
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
                            {extractYouTubeUrl(log.description || '') && (
                              <div className="text-xs text-success mt-1">
                                Contains YouTube URL
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
    </div>
  );
}

export default VideoLogs;
