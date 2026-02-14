import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  getRecentTextSessionsFn,
  deleteTextSessionFn,
  checkRoomExistsFn,
  searchMediaFn,
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
  Gamepad2,
  BookText,
  Clock,
} from 'lucide-react';
import { numberWithCommas } from '../utils/utils';
import { toast } from 'react-toastify';
import { useState, useEffect, useRef, useCallback } from 'react';

function TextHookerDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
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
  const [mediaType, setMediaType] = useState<'vn' | 'reading'>('vn');
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
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchMediaFn({
          type: mediaType,
          search: query,
          perPage: 10,
        });
        setSearchResults(results);
      } catch (error) {
        toast.error('Failed to search media');
      } finally {
        setIsSearching(false);
      }
    },
    [mediaType]
  );

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSearch]);

  // Reset search when media type changes
  useEffect(() => {
    setSearchResults([]);
    setSelectedMedia(null);
    // Re-search if there's a query when type changes
    if (searchQuery.trim()) {
      const search = async () => {
        setIsSearching(true);
        try {
          const results = await searchMediaFn({
            type: mediaType,
            search: searchQuery,
            perPage: 10,
          });
          setSearchResults(results);
        } catch (error) {
          toast.error('Failed to search media');
        } finally {
          setIsSearching(false);
        }
      };
      search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType]);

  const handleMediaTypeChange = (type: 'vn' | 'reading') => {
    setMediaType(type);
  };

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
    setMediaType('vn');
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTextSessionFn,
    onSuccess: () => {
      toast.success('Session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['textSessions', 'recent'] });
      setIsDeleteModalOpen(false);
      setSessionToDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete session');
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
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDurationShort = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
    if (m > 0) return `${m}m`;
    return `${totalSeconds}s`;
  };

  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">TextHooker Dashboard</h1>
          <p className="text-base-content/70">
            Track your reading progress with the TextHooker
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="stats shadow bg-base-200">
            <div className="stat">
              <div className="stat-figure text-primary">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="stat-title">Total Sessions</div>
              <div className="stat-value text-primary">
                {stats.totalSessions}
              </div>
              <div className="stat-desc">Active reading materials</div>
            </div>
          </div>

          <div className="stats shadow bg-base-200">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <List className="w-8 h-8" />
              </div>
              <div className="stat-title">Total Lines</div>
              <div className="stat-value text-secondary">
                {numberWithCommas(stats.totalLines)}
              </div>
              <div className="stat-desc">Lines captured</div>
            </div>
          </div>

          <div className="stats shadow bg-base-200">
            <div className="stat">
              <div className="stat-figure text-accent">
                <Type className="w-8 h-8" />
              </div>
              <div className="stat-title">Total Characters</div>
              <div className="stat-value text-accent">
                {numberWithCommas(stats.totalChars)}
              </div>
              <div className="stat-desc">Japanese characters read</div>
            </div>
          </div>

          <div className="stats shadow bg-base-200">
            <div className="stat">
              <div className="stat-figure text-info">
                <Clock className="w-8 h-8" />
              </div>
              <div className="stat-title">Total Time</div>
              <div className="stat-value text-info">
                {formatDuration(stats.totalTimerSeconds || 0)}
              </div>
              <div className="stat-desc">Time tracked reading</div>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Recent Sessions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setIsJoinRoomOpen(true)}
              className="btn btn-outline btn-primary btn-sm"
            >
              <Users size={16} />
              Join Room
            </button>
            <details className="dropdown dropdown-end">
              <summary className="btn btn-primary btn-sm">
                Start Session
                <ChevronDown size={16} />
              </summary>
              <ul className="dropdown-content menu bg-base-200 rounded-box z-10 w-52 p-2 shadow-lg mt-1">
                <li>
                  <Link to="/texthooker/session">
                    <Type size={16} />
                    Blank Session
                  </Link>
                </li>
                <li>
                  <button onClick={() => setIsMediaModalOpen(true)}>
                    <BookOpen size={16} />
                    Media Session
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {sessions?.map((session) => {
            const media = session.mediaId as IMediaDocument;
            if (!media) return null;
            const totalChars = session.lines.reduce(
              (sum, l) => sum + (l.charsCount || 0),
              0
            );
            return (
              <Link
                key={session._id}
                to={`/texthooker/${media.contentId}`}
                className="group relative"
              >
                <div className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-200 h-full group-hover:scale-105">
                  <figure className="px-2 pt-2 relative">
                    <img
                      src={media.contentImage || media.coverImage}
                      alt={media.title.contentTitleNative}
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
                    <button
                      onClick={(e) =>
                        handleDelete(
                          e,
                          media.contentId,
                          media.title.contentTitleNative
                        )
                      }
                      className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </figure>
                  <div className="card-body p-3">
                    <h3
                      className="font-semibold text-sm line-clamp-2"
                      title={media.title.contentTitleNative}
                    >
                      {media.title.contentTitleNative}
                    </h3>
                    <div className="text-xs text-base-content/70 space-y-1">
                      <div className="flex items-center gap-1">
                        <List className="w-3 h-3" />
                        <span>{session.lines.length} lines</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Type className="w-3 h-3" />
                        <span>{numberWithCommas(totalChars)} chars</span>
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
            <p className="text-xl text-base-content/70 mb-2">No sessions yet</p>
            <p className="text-base-content/50 mb-4 text-center">
              Start a TextHooker session from a media page or launch a blank
              session anytime.
            </p>
            <Link to="/texthooker/session" className="btn btn-primary">
              Launch Blank Session
            </Link>
          </div>
        )}
      </div>

      {/* Join Room Modal */}
      <dialog className={`modal ${isJoinRoomOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Join Collaborative Room
            </h3>
            <button
              onClick={() => setIsJoinRoomOpen(false)}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Join as</span>
              </label>
              <div className="flex gap-2">
                <label className="label cursor-pointer border rounded-lg p-3 flex-1 border-base-300 hover:border-primary transition-colors">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Crown size={16} className="text-warning" />
                      <span className="label-text font-medium">Host</span>
                    </div>
                    <span className="text-xs opacity-70">
                      Create & share room
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
                      <Users size={16} />
                      <span className="label-text font-medium">Guest</span>
                    </div>
                    <span className="text-xs opacity-70">
                      Join existing room
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
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Room ID</span>
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setRoomError(null);
                }}
                className={`input input-bordered ${roomError ? 'input-error' : ''}`}
                placeholder={
                  roomMode === 'host' ? 'Create a room name' : 'Enter room ID'
                }
              />
              <label className="label">
                <span
                  className={`label-text-alt ${roomError ? 'text-error' : 'opacity-70'}`}
                >
                  {roomError ||
                    (roomMode === 'host'
                      ? 'Choose a unique name for your room'
                      : 'Get the room ID from the host')}
                </span>
              </label>
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
                Cancel
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
                      setRoomError(
                        'Room ID already exists. Please choose another name.'
                      );
                      setIsCheckingRoom(false);
                      return;
                    }

                    if (roomMode === 'guest' && !exists) {
                      setRoomError(
                        'Room not found. Check the Room ID or ask the host.'
                      );
                      setIsCheckingRoom(false);
                      return;
                    }

                    navigate(
                      `/texthooker/session?mode=${roomMode}&roomId=${roomId.trim()}`
                    );
                  } catch (error) {
                    toast.error('Failed to check room availability');
                    setIsCheckingRoom(false);
                  }
                }}
              >
                {isCheckingRoom ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : roomMode === 'host' ? (
                  'Create Room'
                ) : (
                  'Join Room'
                )}
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsJoinRoomOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Media Session Modal */}
      <dialog className={`modal ${isMediaModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Start Media Session
            </h3>
            <button
              onClick={resetMediaModal}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Media Type Selector */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Media Type</span>
              </label>
              <div className="flex gap-2">
                <label
                  className={`label cursor-pointer border rounded-lg p-3 flex-1 transition-colors ${
                    mediaType === 'vn'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Gamepad2 size={18} />
                    <span className="label-text font-medium">Visual Novel</span>
                  </div>
                  <input
                    type="radio"
                    name="media-type"
                    className="radio radio-primary radio-sm"
                    value="vn"
                    checked={mediaType === 'vn'}
                    onChange={() => handleMediaTypeChange('vn')}
                  />
                </label>
                <label
                  className={`label cursor-pointer border rounded-lg p-3 flex-1 transition-colors ${
                    mediaType === 'reading'
                      ? 'border-primary bg-primary/10'
                      : 'border-base-300 hover:border-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookText size={18} />
                    <span className="label-text font-medium">Reading</span>
                  </div>
                  <input
                    type="radio"
                    name="media-type"
                    className="radio radio-primary radio-sm"
                    value="reading"
                    checked={mediaType === 'reading'}
                    onChange={() => handleMediaTypeChange('reading')}
                  />
                </label>
              </div>
            </div>

            {/* Search Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Search {mediaType === 'vn' ? 'Visual Novel' : 'Book'}
                </span>
              </label>
              <label className="input w-full flex items-center gap-2">
                <Search size={16} className="opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="grow"
                  placeholder={`Search for a ${mediaType === 'vn' ? 'visual novel' : 'book'}...`}
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
                        alt={media.title?.contentTitleNative || 'Cover'}
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
                            'Unknown Title'}
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
                          Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !isSearching ? (
                <div className="text-center py-8 text-base-content/50">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No results found</p>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="text-center py-8 text-base-content/50">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>
                    Search for a {mediaType === 'vn' ? 'visual novel' : 'book'}{' '}
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
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedMedia}
                onClick={handleStartMediaSession}
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={resetMediaModal}>close</button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog className={`modal ${isDeleteModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-error">
              <Trash2 className="w-5 h-5" />
              Delete Session
            </h3>
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSessionToDelete(null);
              }}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-base-content/80">
              Are you sure you want to delete this session?
            </p>
            {sessionToDelete && (
              <div className="bg-base-200 p-3 rounded-lg">
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
                Cancel
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
                    <Trash2 size={16} />
                    Delete
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
