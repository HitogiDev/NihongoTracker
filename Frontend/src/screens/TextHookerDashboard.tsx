import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  getRecentTextSessionsFn,
  deleteTextSessionFn,
  checkRoomExistsFn,
} from '../api/trackerApi';
import Loader from '../components/Loader';
import { IMediaDocument } from '../types';
import { BookOpen, Type, List, Trash2, Users, Crown } from 'lucide-react';
import { numberWithCommas } from '../utils/utils';
import { toast } from 'react-toastify';
import { useState } from 'react';

function TextHookerDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [roomMode, setRoomMode] = useState<'host' | 'guest'>('guest');
  const [roomId, setRoomId] = useState('');
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['textSessions', 'recent'],
    queryFn: getRecentTextSessionsFn,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTextSessionFn,
    onSuccess: () => {
      toast.success('Session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['textSessions', 'recent'] });
    },
    onError: () => {
      toast.error('Failed to delete session');
    },
  });

  const handleDelete = (e: React.MouseEvent, contentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this session?')) {
      deleteMutation.mutate(contentId);
    }
  };

  if (isLoading) return <Loader />;

  const { sessions, stats } = data || {
    sessions: [],
    stats: { totalSessions: 0, totalLines: 0, totalChars: 0 },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
            <Link to="/texthooker/session" className="btn btn-primary btn-sm">
              Start Blank Session
            </Link>
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
                      onClick={(e) => handleDelete(e, media.contentId)}
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
    </div>
  );
}

export default TextHookerDashboard;
