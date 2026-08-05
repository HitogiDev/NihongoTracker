import { ILog, IMediaDocument } from '../types';
import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignMediaFn, getUserLogsFn, searchMediaFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import useSearch from '../hooks/useSearch';
import { useUserDataStore } from '../store/userData';
import { useFilteredGroupedLogs } from '../hooks/useFilteredGroupedLogs.tsx';
import { useGroupLogs } from '../hooks/useGroupLogs.tsx';
import DismissLogsButton from './DismissLogsButton';
import { useTranslation } from 'react-i18next';

interface BookLogsProps {
  username?: string;
  isActive?: boolean;
}

function BookLogs({ username, isActive = true }: BookLogsProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<IMediaDocument | undefined>(
    undefined
  );
  const [selectedLogs, setSelectedLogs] = useState<ILog[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [assignedLogs, setAssignedLogs] = useState<ILog[]>([]);
  const [shouldSearch, setShouldSearch] = useState<boolean>(true);

  const { user } = useUserDataStore();
  const currentUsername = user?.username;

  const {
    data: bookResult,
    error: searchBookError,
    isLoading: isSearchingBook,
  } = useSearch('book', shouldSearch ? searchQuery : '');

  const {
    data: logs,
    error: logError,
    isLoading: isLoadingLogs,
  } = useQuery({
    queryKey: ['bookLogs', username, 'book'],
    queryFn: () =>
      getUserLogsFn(username as string, { limit: 0, type: 'book' }),
    enabled: !!username && isActive,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const queryClient = useQueryClient();

  if (searchBookError && searchBookError instanceof AxiosError) {
    toast.error(searchBookError.response?.data.message);
  }

  const handleCheckboxChange = useCallback((log: ILog) => {
    setSelectedLogs((prevSelectedLogs) =>
      prevSelectedLogs.includes(log)
        ? prevSelectedLogs.filter((selectedLog) => selectedLog !== log)
        : [...prevSelectedLogs, log]
    );
  }, []);

  const handleLogsDismissed = useCallback(() => {
    setAssignedLogs((prev) => [...prev, ...selectedLogs]);
    setSelectedLogs([]);
    setSelectedGroup(null);
  }, [selectedLogs]);

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

  const groupedLogs = useGroupLogs(logs, 'book');

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
      setSelectedBook(undefined);
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

      toast.success(t('matcher.assignSuccess'));
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(t('matcher.assignError'));
      }
    },
  });

  const handleAssignMedia = useCallback(() => {
    if (!selectedBook) {
      toast.error(
        t('matcher.selectOne', { type: t('common:mediaTypesPlural.book') })
      );
      return;
    }
    if (selectedLogs.length === 0) {
      toast.error(t('matcher.selectAtLeastOneLog'));
      return;
    }
    assignMedia([
      {
        logsId: selectedLogs.map((log) => log._id),
        contentMedia: {
          contentId: selectedBook.contentId,
          contentImage: selectedBook.contentImage,
          coverImage: selectedBook.coverImage,
          description: selectedBook.description,
          type: 'book',
          title: {
            contentTitleNative: selectedBook.title.contentTitleNative,
            contentTitleEnglish: selectedBook.title.contentTitleEnglish,
            contentTitleRomaji: selectedBook.title.contentTitleRomaji,
          },
          isAdult: selectedBook.isAdult,
          ...(selectedBook.pageCount && {
            pageCount: selectedBook.pageCount,
          }),
          ...(selectedBook.authors && {
            authors: selectedBook.authors,
          }),
          ...(selectedBook.publishedDate && {
            publishedDate: selectedBook.publishedDate,
          }),
        } as IMediaDocument,
      },
    ]);
    setShouldSearch(false);
  }, [selectedBook, selectedLogs, assignMedia, t]);

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

      for (const [groupName, logsGroup] of Object.entries(
        filteredGroupedLogs
      )) {
        try {
          const dbResults = await searchMediaFn({
            type: 'book',
            search: groupName,
            perPage: 5,
          });

          if (dbResults && dbResults.length > 0) {
            const exactMatch = dbResults.find((book) => {
              const titles = [
                book.title.contentTitleRomaji,
                book.title.contentTitleEnglish,
                book.title.contentTitleNative,
                ...(book.synonyms || []),
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
          console.error(`Search failed for: ${groupName}`, error);
        }
      }

      if (matches.length > 0) {
        const BATCH_SIZE = 50;
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
                  (toUpdateCount, toUpdate) =>
                    toUpdateCount + toUpdate.logsId.length,
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

        const assignedLogIds = matches.flatMap((m) => m.logsId);
        const newlyAssignedLogs =
          logs?.filter((log) => assignedLogIds.includes(log._id)) || [];
        setAssignedLogs((prev) => [...prev, ...newlyAssignedLogs]);

        queryClient.invalidateQueries({
          queryKey: ['bookLogs', username, 'book'],
        });

        toast.success(
          t('matcher.autoMatchedSuccess', {
            count: totalProcessed,
            matches: matches.length,
            type: t('common:mediaTypesPlural.book'),
          })
        );
      } else {
        toast.info(t('matcher.noExactMatches'));
      }
    } catch (error) {
      console.error('Auto-match error:', error);
      toast.error(t('matcher.autoMatchFailed'));
    } finally {
      setIsAutoMatching(false);
    }
  }, [filteredGroupedLogs, assignMedia, logs, queryClient, username, t]);

  const handleAutoMatch = useCallback(async () => {
    if (Object.keys(filteredGroupedLogs).length === 0) {
      toast.info(t('matcher.noGroups'));
      return;
    }

    const groupCount = Object.keys(filteredGroupedLogs).length;
    if (groupCount > 20) {
      setShowAutoMatchModal(true);
      return;
    }

    await performAutoMatch();
  }, [filteredGroupedLogs, performAutoMatch, t]);

  if (isLoadingLogs) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-4">
        <div className="card bg-base-100 shadow-sm w-full max-w-md">
          <div className="card-body text-center">
            <div className="flex justify-center mb-4">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
            <h2 className="card-title justify-center text-2xl mb-2">
              {t('matcher.loadingTitle')}
            </h2>
            <p className="text-base-content/70 mb-4">
              {t('matcher.preparing')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (logError) {
    return (
      <div className="alert alert-error">
        <span>
          {t('matcher.errorLoading', {
            type: t('common:mediaTypesPlural.book'),
          })}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      {/* Auto-match warning modal */}
      {showAutoMatchModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {t('matcher.largeBatchTitle')}
            </h3>
            <p className="py-4">
              {t('matcher.largeBatchBody', {
                count: Object.keys(filteredGroupedLogs).length,
              })}
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowAutoMatchModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={performAutoMatch}>
                {t('common.continue')}
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
        {t('matcher.assignTitle', { type: t('common:mediaTypesPlural.book') })}
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 w-full">
        <div className="stats shadow flex-1">
          <div className="stat">
            <div className="stat-title">{t('matcher.selectedLogs')}</div>
            <div className="stat-value">{selectedLogs.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">{t('matcher.availableGroups')}</div>
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
              {t('matcher.autoMatching')}
            </>
          ) : (
            t('matcher.autoMatchAll')
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left panel - Log groups */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">{t('matcher.unassignedLogs')}</h2>
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
                          name="book-log-accordion"
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
                                  {log.unknownDate
                                    ? t('create.unknownDate')
                                    : new Date(log.date).toLocaleDateString()}
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
                <span>
                  {t('matcher.noUnassigned', {
                    type: t('common:mediaTypesPlural.book'),
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - Book search */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body p-4">
            <h2 className="card-title">
              {t('matcher.findMatching', {
                type: t('common:mediaTypesPlural.book'),
              })}
            </h2>
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
                placeholder={t('matcher.searchPlaceholder', {
                  type: t('common:mediaTypesPlural.book'),
                })}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShouldSearch(true);
                }}
              />
            </label>

            <div className="overflow-y-auto max-h-[60vh]">
              {isSearchingBook ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p className="mt-2">
                    {t('matcher.searching', {
                      type: t('common:mediaTypesPlural.book'),
                    })}
                  </p>
                </div>
              ) : bookResult && bookResult.length > 0 ? (
                <div className="space-y-2">
                  {bookResult.map((book, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 p-3 rounded-lg hover:bg-base-300 cursor-pointer ${
                        selectedBook?.contentId === book.contentId
                          ? 'bg-primary/10 border border-primary'
                          : ''
                      }`}
                      onClick={() => setSelectedBook(book)}
                    >
                      <div className="w-12">
                        <label className="cursor-pointer flex items-center justify-center h-full">
                          <input
                            type="radio"
                            className="radio radio-primary radio-sm"
                            name="book"
                            checked={selectedBook?.contentId === book.contentId}
                            onChange={() => setSelectedBook(book)}
                          />
                        </label>
                      </div>

                      <div className="flex gap-3">
                        {book.contentImage && (
                          <div className="w-12 h-16 overflow-hidden rounded-md">
                            <img
                              src={book.contentImage}
                              alt={
                                book.title.contentTitleEnglish ||
                                book.title.contentTitleNative
                              }
                              className="object-cover w-full h-full"
                            />
                          </div>
                        )}

                        <div className="flex flex-col">
                          <span className="font-medium">
                            {book.title.contentTitleNative}
                          </span>
                          {book.title.contentTitleEnglish &&
                            book.title.contentTitleEnglish !==
                              book.title.contentTitleNative && (
                              <span className="text-sm opacity-70">
                                {book.title.contentTitleEnglish}
                              </span>
                            )}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {book.authors && book.authors.length > 0 && (
                              <span className="text-xs badge badge-sm">
                                {book.authors.join(', ')}
                              </span>
                            )}
                            {book.pageCount && (
                              <span className="text-xs badge badge-sm">
                                {book.pageCount} pages
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="alert alert-warning">
                  <span>
                    {t('matcher.noneFound', {
                      type: t('common:mediaTypesPlural.book'),
                    })}
                  </span>
                </div>
              ) : (
                <div className="alert alert-info">
                  <span>
                    {t('matcher.selectGroupOrTitle', {
                      type: t('common:mediaTypesPlural.book'),
                    })}
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
            <div className="stat-title">{t('matcher.selectedLogs')}</div>
            <div className="stat-value text-primary">{selectedLogs.length}</div>
          </div>
        </div>

        <button
          onClick={handleAssignMedia}
          disabled={isAssigning || !selectedBook || selectedLogs.length === 0}
          className={`btn btn-primary btn-lg ${isAssigning ? 'loading' : ''}`}
        >
          {isAssigning ? (
            <>
              <span className="loading loading-spinner"></span>
              {t('matcher.assigning')}
            </>
          ) : (
            t('matcher.assignTo', {
              type: t('common:mediaTypes.book'),
            })
          )}
        </button>

        <DismissLogsButton
          selectedLogs={selectedLogs}
          onDismissed={handleLogsDismissed}
        />
      </div>
    </div>
  );
}

export default BookLogs;
