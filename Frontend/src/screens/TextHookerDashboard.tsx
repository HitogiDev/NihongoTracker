import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Field from '../components/ui/Field';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  getRecentTextSessionsFn,
  deleteTextSessionFn,
  checkRoomExistsFn,
  searchMediaFn,
  createBlankTextSessionFn,
} from '../api/trackerApi';
import Loader from '../components/Loader';
import { IMediaDocument, SearchResultType } from '../types';
import {
  BookOpen,
  Type,
  List,
  Trash2,
  Users,
  Crown,
  ChevronDown,
  Search,
  Clock,
  Gamepad2,
  FileText,
} from 'lucide-react';
import { numberWithCommas } from '../utils/utils';
import { toast } from 'react-toastify';
import { useState, useEffect, useRef, useCallback } from 'react';

function TextHookerDashboard() {
  const { t } = useTranslation('texthooker');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isBlankModalOpen, setIsBlankModalOpen] = useState(false);
  const [blankSessionName, setBlankSessionName] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{
    contentId: string;
    title: string;
  } | null>(null);
  const [roomMode, setRoomMode] = useState<'host' | 'guest'>('guest');
  const [roomId, setRoomId] = useState('');
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Media search state
  const [mediaSessionType, setMediaSessionType] = useState<'vn' | 'game'>('vn');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SearchResultType | null>(
    null
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['textSessions', 'recent'],
    queryFn: getRecentTextSessionsFn,
  });

  // Debounced search
  const handleSearch = useCallback(
    async (query: string, type: 'vn' | 'game') => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchMediaFn({
          type,
          search: query,
          perPage: 10,
        });
        setSearchResults(results);
      } catch (error) {
        toast.error(t('toast.searchFailed'));
      } finally {
        setIsSearching(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(searchQuery, mediaSessionType);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, mediaSessionType, handleSearch]);

  const handleStartMediaSession = () => {
    if (selectedMedia) {
      navigate(`/texthooker/${selectedMedia.contentId}`);
    }
  };

  const resetMediaModal = () => {
    setIsMediaModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedMedia(null);
    setMediaSessionType('vn');
  };

  const createBlankSessionMutation = useMutation({
    mutationFn: createBlankTextSessionFn,
    onSuccess: (session) => {
      setIsBlankModalOpen(false);
      setBlankSessionName('');
      navigate(`/texthooker/${session.blankId}`);
    },
    onError: () => {
      toast.error(t('toast.createFailed'));
    },
  });

  const handleCreateBlankSession = () => {
    const trimmed = blankSessionName.trim();
    if (!trimmed) return;
    createBlankSessionMutation.mutate(trimmed);
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTextSessionFn,
    onSuccess: () => {
      toast.success(t('toast.sessionDeleted'));
      queryClient.invalidateQueries({ queryKey: ['textSessions', 'recent'] });
      setIsDeleteModalOpen(false);
      setSessionToDelete(null);
    },
    onError: () => {
      toast.error(t('toast.deleteFailed'));
      setIsDeleteModalOpen(false);
    },
  });

  const handleDelete = (
    e: React.MouseEvent,
    contentId: string,
    title: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete({ contentId, title });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      deleteMutation.mutate(sessionToDelete.contentId);
    }
  };

  if (isLoading) return <Loader />;

  const { sessions, stats } = data || {
    sessions: [],
    stats: {
      totalSessions: 0,
      totalLines: 0,
      totalChars: 0,
      totalTimerSeconds: 0,
    },
  };

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return t('duration.hoursMinutes', { hours: h, minutes: m });
    return t('duration.minutes', { minutes: m });
  };

  const formatDurationShort = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0)
      return m > 0
        ? t('duration.hoursMinutes', { hours: h, minutes: m })
        : t('duration.hours', { hours: h });
    if (m > 0) return t('duration.minutes', { minutes: m });
    return t('duration.seconds', { seconds: totalSeconds });
  };

  return (
    <div className="min-h-screen pt-20 bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('dashboard.title')}</h1>
          <p className="text-base-content/70">{t('dashboard.subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="stats stats-vertical w-full overflow-hidden shadow-sm bg-base-100">
            <div className="stat">
              <div className="stat-figure text-primary">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="stat-title">{t('dashboard.stats.sessions')}</div>
              <div className="stat-value text-primary">
                {stats.totalSessions}
              </div>
              <div className="stat-desc">
                {t('dashboard.stats.sessionsDesc')}
              </div>
            </div>
          </div>

          <div className="stats stats-vertical w-full overflow-hidden shadow-sm bg-base-100">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <List className="w-8 h-8" />
              </div>
              <div className="stat-title">{t('dashboard.stats.lines')}</div>
              <div className="stat-value text-secondary">
                {numberWithCommas(stats.totalLines)}
              </div>
              <div className="stat-desc">{t('dashboard.stats.linesDesc')}</div>
            </div>
          </div>

          <div className="stats stats-vertical w-full overflow-hidden shadow-sm bg-base-100">
            <div className="stat">
              <div className="stat-figure text-accent">
                <Type className="w-8 h-8" />
              </div>
              <div className="stat-title">
                {t('dashboard.stats.characters')}
              </div>
              <div className="stat-value text-accent">
                {numberWithCommas(stats.totalChars)}
              </div>
              <div className="stat-desc">
                {t('dashboard.stats.charactersDesc')}
              </div>
            </div>
          </div>

          <div className="stats stats-vertical w-full overflow-hidden shadow-sm bg-base-100">
            <div className="stat">
              <div className="stat-figure text-info">
                <Clock className="w-8 h-8" />
              </div>
              <div className="stat-title">{t('dashboard.stats.time')}</div>
              <div className="stat-value text-info">
                {formatDuration(stats.totalTimerSeconds || 0)}
              </div>
              <div className="stat-desc">{t('dashboard.stats.timeDesc')}</div>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">
            {t('dashboard.recentSessions')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setIsJoinRoomOpen(true)}
              className="btn btn-primary btn-outline btn-sm"
            >
              <Users className="w-4 h-4" />
              {t('dashboard.joinRoom')}
            </button>
            <details className="dropdown dropdown-end">
              <summary className="btn btn-primary btn-sm">
                {t('dashboard.startSession')}
                <ChevronDown className="w-4 h-4" />
              </summary>
              <ul className="dropdown-content menu surface-raised z-10 w-52 p-2 mt-1">
                <li>
                  <button onClick={() => setIsBlankModalOpen(true)}>
                    <Type className="w-4 h-4" />
                    {t('dashboard.blankSession')}
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsMediaModalOpen(true)}>
                    <BookOpen className="w-4 h-4" />
                    {t('dashboard.mediaSessionOption')}
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sessions?.map((session) => {
            const media = (session.mediaId as IMediaDocument) || null;
            const isBlank = !media;
            if (isBlank && !session.blankId) return null;

            const sessionKey = media ? media.contentId : session.blankId!;
            const title = media
              ? media.title.contentTitleNative
              : session.name || t('dashboard.untitledSession');

            // Logging a session clears session.lines, so per-card totals
            // must include past logged history, not just the live buffer.
            const loggedLines = (session.sessionHistory ?? []).reduce(
              (sum, entry) => sum + (entry.linesLogged || 0),
              0
            );
            const loggedChars = (session.sessionHistory ?? []).reduce(
              (sum, entry) => sum + (entry.charactersLogged || 0),
              0
            );
            const unloggedChars = session.lines.reduce(
              (sum, line) => sum + (line.charsCount || 0),
              0
            );
            const totalLines = loggedLines + session.lines.length;
            const totalChars = loggedChars + unloggedChars;
            return (
              <Link
                key={session._id}
                to={`/texthooker/${sessionKey}`}
                className="group relative"
              >
                <div className="card surface hover:shadow-lg transition-all duration-200 h-full group-hover:scale-105">
                  <figure className="px-2 pt-2 relative">
                    {media ? (
                      <img
                        src={media.contentImage || media.coverImage}
                        alt={title}
                        className="rounded-lg w-full aspect-[2/3] object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (
                            target.src !== media.coverImage &&
                            media.coverImage
                          ) {
                            target.src = media.coverImage;
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] surface-muted flex items-center justify-center">
                        <FileText className="w-10 h-10 text-base-content/30" />
                      </div>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, sessionKey, title)}
                      className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title={t('dashboard.deleteSession')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </figure>
                  <div className="card-body p-3">
                    <h3
                      className="font-semibold text-sm line-clamp-2"
                      title={title}
                    >
                      {title}
                    </h3>
                    <div className="text-xs text-base-content/70 space-y-1">
                      <div className="flex items-center gap-1">
                        <List className="w-3 h-3" />
                        <span>
                          {t('dashboard.linesCount', {
                            count: totalLines,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Type className="w-3 h-3" />
                        <span>
                          {t('dashboard.charsCount', {
                            count: totalChars,
                          })}
                        </span>
                      </div>
                      {(session.timerSeconds ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatDurationShort(session.timerSeconds!)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-base-content/50 mt-2">
                      {new Date(
                        session.updatedAt || session.createdAt
                      ).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {sessions?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-16 h-16 text-base-content/30 mb-4" />
            <p className="text-xl text-base-content/70 mb-2">
              {t('dashboard.empty')}
            </p>
            <p className="text-base-content/50 mb-4 text-center">
              {t('dashboard.emptyBody')}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setIsBlankModalOpen(true)}
            >
              {t('dashboard.launchBlankSession')}
            </button>
          </div>
        )}
      </div>

      {/* Join Room Modal */}
      <dialog
        className={`modal modal-bottom sm:modal-middle ${isJoinRoomOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {t('room.title')}
            </h3>
            <button
              onClick={() => setIsJoinRoomOpen(false)}
              className="btn btn-ghost btn-sm btn-circle"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <Field label={t('room.joinAs')}>
              <div className="flex gap-2">
                <label className="label cursor-pointer border rounded-lg p-3 flex-1 border-base-300 hover:border-primary transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-warning" />
                      <span className="font-medium">{t('room.host')}</span>
                    </div>
                    <span className="text-xs opacity-70">
                      {t('room.createTab')}
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="join-mode"
                    className="radio radio-primary radio-sm"
                    value="host"
                    checked={roomMode === 'host'}
                    onChange={(e) => setRoomMode(e.target.value as 'host')}
                  />
                </label>
                <label className="label cursor-pointer border rounded-lg p-3 flex-1 border-base-300 hover:border-primary transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{t('room.guest')}</span>
                    </div>
                    <span className="text-xs opacity-70">
                      {t('room.joinTab')}
                    </span>
                  </div>
                  <input
                    type="radio"
                    name="join-mode"
                    className="radio radio-primary radio-sm"
                    value="guest"
                    checked={roomMode === 'guest'}
                    onChange={(e) => setRoomMode(e.target.value as 'guest')}
                  />
                </label>
              </div>
            </Field>

            <div className="gap-2">
              <span className="text-sm font-semibold leading-none">
                {t('dashboard.roomId')}
              </span>
              <input
                type="text"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setRoomError(null);
                }}
                className={`input w-full ${roomError ? 'input-error' : ''}`}
                placeholder={
                  roomMode === 'host'
                    ? t('room.createPlaceholder')
                    : t('room.joinPlaceholder')
                }
                aria-label={t('room.roomId')}
              />
              <span
                className={`text-xs leading-snug ${roomError ? 'text-error' : 'opacity-70'}`}
              >
                {roomError ||
                  (roomMode === 'host'
                    ? t('room.createHint')
                    : t('room.joinHint'))}
              </span>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsJoinRoomOpen(false);
                  setRoomMode('guest');
                  setRoomId('');
                  setRoomError(null);
                }}
              >
                {t('dashboard.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!roomId.trim() || isCheckingRoom}
                onClick={async () => {
                  if (!roomId.trim()) return;

                  setIsCheckingRoom(true);
                  setRoomError(null);

                  try {
                    const { exists } = await checkRoomExistsFn(roomId.trim());

                    if (roomMode === 'host' && exists) {
                      setRoomError(t('room.idTaken'));
                      setIsCheckingRoom(false);
                      return;
                    }

                    if (roomMode === 'guest' && !exists) {
                      setRoomError(t('room.notFound'));
                      setIsCheckingRoom(false);
                      return;
                    }

                    navigate(
                      `/texthooker/session?mode=${roomMode}&roomId=${roomId.trim()}`
                    );
                  } catch (error) {
                    toast.error(t('room.checkFailed'));
                    setIsCheckingRoom(false);
                  }
                }}
              >
                {isCheckingRoom ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : roomMode === 'host' ? (
                  t('room.create')
                ) : (
                  t('room.join')
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsJoinRoomOpen(false)}>
            {t('room.close')}
          </button>
        </form>
      </dialog>

      {/* Media Session Modal */}
      <dialog
        className={`modal modal-bottom sm:modal-middle ${isMediaModalOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {t('mediaSession.title')}
            </h3>
            <button
              onClick={resetMediaModal}
              className="btn btn-ghost btn-sm btn-circle"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {/* Media Type Selector */}
            <div>
              <label className="label mb-2">
                <span className="font-semibold">
                  {t('mediaSession.mediaType')}
                </span>
              </label>
              <div className="flex gap-2">
                <label
                  className={`label cursor-pointer border rounded-lg p-3 flex-1 transition-colors ${
                    mediaSessionType === 'vn'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 hover:border-primary'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {t('dashboard.visualNovel')}
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="media-session-type"
                    className="radio radio-primary radio-sm"
                    value="vn"
                    checked={mediaSessionType === 'vn'}
                    onChange={() => {
                      setMediaSessionType('vn');
                      setSearchQuery('');
                      setSearchResults([]);
                      setSelectedMedia(null);
                    }}
                  />
                </label>
                <label
                  className={`label cursor-pointer border rounded-lg px-3 flex-1 transition-colors ${
                    mediaSessionType === 'game'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 hover:border-primary'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {t('mediaSession.videoGame')}
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="media-session-type"
                    className="radio radio-primary radio-sm"
                    value="game"
                    checked={mediaSessionType === 'game'}
                    onChange={() => {
                      setMediaSessionType('game');
                      setSearchQuery('');
                      setSearchResults([]);
                      setSelectedMedia(null);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Search Input */}
            <div>
              <label className="input w-full flex items-center gap-2">
                <Search className="w-4 h-4 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="grow"
                  placeholder={t('mediaSession.searchPlaceholder', {
                    context: mediaSessionType === 'vn' ? 'vn' : 'game',
                  })}
                />
                {isSearching && (
                  <span className="loading loading-spinner loading-sm"></span>
                )}
              </label>
            </div>

            {/* Search Results */}
            <div className="max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((media) => (
                    <button
                      key={media._id}
                      onClick={() => setSelectedMedia(media)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        selectedMedia?._id === media._id
                          ? 'bg-primary/20 border border-primary'
                          : 'bg-base-200 hover:bg-base-300 border border-transparent'
                      }`}
                    >
                      <img
                        src={media.contentImage || media.coverImage}
                        alt={
                          media.title?.contentTitleNative ||
                          t('dashboard.cover')
                        }
                        className="w-12 h-16 object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm line-clamp-2">
                          {media.title?.contentTitleNative ||
                            media.title?.contentTitleEnglish ||
                            t('dashboard.unknownTitle')}
                        </p>
                        {media.title?.contentTitleEnglish &&
                          media.title?.contentTitleNative && (
                            <p className="text-xs text-base-content/60 line-clamp-1">
                              {media.title.contentTitleEnglish}
                            </p>
                          )}
                      </div>
                      {selectedMedia?._id === media._id && (
                        <div className="badge badge-primary badge-sm">
                          {t('dashboard.selected')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !isSearching ? (
                <div className="text-center py-8 text-base-content/50">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{t('mediaSession.noResults')}</p>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="text-center py-8 text-base-content/50">
                  {mediaSessionType === 'vn' ? (
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  ) : (
                    <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  )}
                  <p>
                    Search for a{' '}
                    {mediaSessionType === 'vn' ? 'visual novel' : 'video game'}{' '}
                    to start
                  </p>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-base-300">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetMediaModal}
              >
                {t('dashboard.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedMedia}
                onClick={handleStartMediaSession}
              >
                {t('dashboard.startSession')}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={resetMediaModal}>{t('room.close')}</button>
        </form>
      </dialog>

      {/* Blank Session Modal */}
      <dialog
        className={`modal modal-bottom sm:modal-middle ${isBlankModalOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Type className="w-5 h-5 text-primary" />
              {t('dashboard.nameYourSession')}
            </h3>
            <button
              onClick={() => {
                setIsBlankModalOpen(false);
                setBlankSessionName('');
              }}
              className="btn btn-ghost btn-sm btn-circle"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="gap-2">
              <span className="text-sm font-semibold leading-none">
                {t('dashboard.sessionName')}
              </span>
              <input
                type="text"
                autoFocus
                value={blankSessionName}
                onChange={(e) => setBlankSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateBlankSession();
                }}
                maxLength={100}
                className="input w-full"
                placeholder={t('mediaSession.namePlaceholder')}
                aria-label={t('room.sessionName')}
              />
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsBlankModalOpen(false);
                  setBlankSessionName('');
                }}
              >
                {t('dashboard.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !blankSessionName.trim() ||
                  createBlankSessionMutation.isPending
                }
                onClick={handleCreateBlankSession}
              >
                {createBlankSessionMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  t('dashboard.startSession')
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              setIsBlankModalOpen(false);
              setBlankSessionName('');
            }}
          >
            close
          </button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog
        className={`modal modal-bottom sm:modal-middle ${isDeleteModalOpen ? 'modal-open' : ''}`}
      >
        <div className="modal-box max-w-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-error">
              <Trash2 className="w-5 h-5" />
              {t('dashboard.deleteSessionTitle')}
            </h3>
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSessionToDelete(null);
              }}
              className="btn btn-ghost btn-sm btn-circle"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-base-content/80">
              {t('dashboard.deleteSessionConfirm')}
            </p>
            {sessionToDelete && (
              <div className="surface-muted p-3">
                <p className="font-semibold text-sm line-clamp-2">
                  {sessionToDelete.title}
                </p>
              </div>
            )}
            <p className="text-sm text-base-content/60">
              This action cannot be undone. All lines and progress will be
              permanently deleted.
            </p>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSessionToDelete(null);
                }}
              >
                {t('dashboard.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-error"
                disabled={deleteMutation.isPending}
                onClick={confirmDelete}
              >
                {deleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('dashboard.delete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={() => {
              setIsDeleteModalOpen(false);
              setSessionToDelete(null);
            }}
          >
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}

export default TextHookerDashboard;
