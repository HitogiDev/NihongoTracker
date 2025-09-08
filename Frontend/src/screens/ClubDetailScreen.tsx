import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdGroup,
  MdPublic,
  MdLock,
  MdStar,
  MdEdit,
  MdPersonAdd,
  MdExitToApp,
  MdArrowBack,
  MdShield,
  MdVerified,
  MdPlayArrow,
  MdBook,
  MdMovie,
  MdMusicNote,
  MdAdd,
  MdThumbUp,
  MdClose,
  MdHowToVote,
} from 'react-icons/md';
import {
  getClubFn,
  joinClubFn,
  leaveClubFn,
  getClubMediaFn,
  addClubMediaFn,
} from '../api/clubApi';
import { useUserDataStore } from '../store/userData';
import { numberWithCommas } from '../utils/utils';
import CreateVotingWizard from '../components/club/CreateVotingWizard';
import VotingSystem from '../components/club/VotingSystem';

function ClubDetailScreen() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();

  // Fetch club data
  const {
    data: club,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['club', clubId],
    queryFn: () => getClubFn(clubId!),
    enabled: !!clubId,
  });

  // Fetch club media
  const { data: clubMedia, isLoading: isMediaLoading } = useQuery({
    queryKey: ['clubMedia', clubId],
    queryFn: () => getClubMediaFn(clubId!, true),
    enabled: !!clubId && !!club?.isUserMember,
  });

  // Join club mutation
  const joinMutation = useMutation({
    mutationFn: () => joinClubFn(clubId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast.success(data.message || 'Successfully joined the club!');
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to join club';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'response' in error) {
        const response = (
          error as { response?: { data?: { message?: string } } }
        ).response;
        if (response?.data?.message) {
          errorMessage = response.data.message;
        }
      }

      toast.error(errorMessage);
    },
  });

  // Leave club mutation
  const leaveMutation = useMutation({
    mutationFn: () => leaveClubFn(clubId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });

      // Check if club was disbanded (user was last member)
      if (club?.userRole === 'leader' && club.memberCount === 1) {
        toast.success('Club has been disbanded');
        navigate('/clubs');
      } else if (club?.userStatus === 'pending') {
        toast.success('Join request canceled');
      } else {
        toast.success('Successfully left the club');
        navigate('/clubs');
      }
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to leave club';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'response' in error) {
        const response = (
          error as { response?: { data?: { message?: string } } }
        ).response;
        if (response?.data?.message) {
          errorMessage = response.data.message;
        }
      }

      toast.error(errorMessage);
    },
  });

  // Add media modal state
  const [isAddMediaModalOpen, setIsAddMediaModalOpen] = useState(false);
  const [isCreateVotingWizardOpen, setIsCreateVotingWizardOpen] =
    useState(false);
  const [mediaForm, setMediaForm] = useState({
    mediaId: '',
    mediaType: 'anime' as
      | 'anime'
      | 'manga'
      | 'reading'
      | 'vn'
      | 'video'
      | 'movie',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  });

  // Add media mutation
  const addMediaMutation = useMutation({
    mutationFn: (mediaData: typeof mediaForm) =>
      addClubMediaFn(clubId!, mediaData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clubMedia', clubId] });
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast.success(data.message || 'Media added successfully!');
      setIsAddMediaModalOpen(false);
      setMediaForm({
        mediaId: '',
        mediaType: 'anime',
        title: '',
        description: '',
        startDate: '',
        endDate: '',
      });
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to add media';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'response' in error) {
        const response = (
          error as { response?: { data?: { message?: string } } }
        ).response;
        if (response?.data?.message) {
          errorMessage = response.data.message;
        }
      }

      toast.error(errorMessage);
    },
  });

  const levelColor = useMemo(() => {
    if (!club) return 'text-green-500';
    if (club.level >= 50) return 'text-purple-500';
    if (club.level >= 25) return 'text-orange-500';
    if (club.level >= 10) return 'text-blue-500';
    return 'text-green-500';
  }, [club]);

  const canManageClub = useMemo(() => {
    return club?.userRole === 'leader' || club?.userRole === 'moderator';
  }, [club?.userRole]);

  const canLeaveClub = useMemo(() => {
    if (!club?.isUserMember) return false;

    // If user is leader and there are other members, they can't leave without transferring leadership
    if (club.userRole === 'leader' && club.memberCount > 1) return false;

    return true;
  }, [club?.isUserMember, club?.userRole, club?.memberCount]);

  const getLeaveButtonText = useMemo(() => {
    if (!club) return 'Leave';

    if (club.userRole === 'leader') {
      if (club.memberCount === 1) {
        return 'Disband Club';
      }
      return 'Transfer Leadership First';
    }

    return 'Leave Club';
  }, [club]);

  const handleLeaveClick = () => {
    if (!club) return;

    // Show confirmation for leaders disbanding the club
    if (club.userRole === 'leader' && club.memberCount === 1) {
      if (
        window.confirm('This will permanently disband the club. Are you sure?')
      ) {
        leaveMutation.mutate();
      }
      return;
    }

    // Show confirmation for regular members
    if (window.confirm('Are you sure you want to leave this club?')) {
      leaveMutation.mutate();
    }
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'anime':
        return <MdPlayArrow className="text-lg" />;
      case 'manga':
      case 'reading':
        return <MdBook className="text-lg" />;
      case 'movie':
      case 'video':
        return <MdMovie className="text-lg" />;
      case 'music':
        return <MdMusicNote className="text-lg" />;
      case 'vn':
        return <MdPlayArrow className="text-lg" />;
      default:
        return <MdPlayArrow className="text-lg" />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader':
        return <MdShield className="text-yellow-500" />;
      case 'moderator':
        return <MdVerified className="text-blue-500" />;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'leader':
        return <span className="badge badge-warning badge-xs">Leader</span>;
      case 'moderator':
        return <span className="badge badge-info badge-xs">Moderator</span>;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-error mb-4">
              Club not found
            </h1>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/clubs')}
            >
              Back to Clubs
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header with Banner */}
      <div className="relative">
        {/* Banner */}
        <div className="h-48 sm:h-64 bg-gradient-to-br from-primary/20 to-secondary/20 relative overflow-hidden">
          {club.banner && (
            <img
              src={club.banner}
              alt={`${club.name} banner`}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Back Button */}
          <button
            className="absolute top-4 left-4 btn btn-circle btn-ghost bg-black/20 hover:bg-black/40 text-white border-none"
            onClick={() => navigate('/clubs')}
          >
            <MdArrowBack className="text-xl" />
          </button>

          {/* Privacy Badge */}
          <div className="absolute top-4 right-4">
            <div
              className={`badge gap-1 ${club.isPublic ? 'badge-success' : 'badge-warning'}`}
            >
              {club.isPublic ? (
                <MdPublic className="text-xs" />
              ) : (
                <MdLock className="text-xs" />
              )}
              {club.isPublic ? 'Public' : 'Private'}
            </div>
          </div>
        </div>

        {/* Club Info Overlay */}
        <div className="bg-base-100 border-b border-base-300 relative">
          <div className="container mx-auto px-4">
            {/* Club Avatar - Responsive positioning */}
            <div className="absolute left-1/2 transform -translate-x-1/2 -top-12 sm:left-4 sm:translate-x-0 sm:-top-16">
              <div className="avatar">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-base-100 p-1 shadow-xl">
                  {club.avatar ? (
                    <img
                      src={club.avatar}
                      alt={club.name}
                      className="rounded-full w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                      <MdGroup className="text-3xl text-primary" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Club Info Content */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-16 pb-4 sm:pt-4 sm:pb-4 sm:pl-40">
              {/* Club details - Centered on mobile, left-aligned on desktop */}
              <div className="flex flex-col items-center sm:items-start gap-3 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold">{club.name}</h1>
                  <div
                    className={`badge badge-ghost ${levelColor} font-semibold`}
                  >
                    Lv. {club.level}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-base-content/70">
                  <div className="flex items-center gap-1">
                    <MdGroup className="text-base" />
                    <span>
                      {club.memberCount}/{club.memberLimit} members
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MdStar className="text-base text-yellow-500" />
                    <span>{numberWithCommas(club.totalXp)} XP</span>
                  </div>
                </div>
              </div>

              {/* Action buttons - Centered on mobile, right-aligned on desktop */}
              <div className="flex gap-2 justify-center sm:justify-end mt-4 sm:mt-0">
                {user && club.isUserMember && club.userStatus === 'active' ? (
                  <>
                    {canManageClub && (
                      <button className="btn btn-secondary btn-sm">
                        <MdEdit className="text-lg" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    )}
                    <button
                      className={`btn btn-sm ${
                        club.userRole === 'leader' && club.memberCount > 1
                          ? 'btn-disabled'
                          : club.userRole === 'leader' && club.memberCount === 1
                            ? 'btn-warning'
                            : 'btn-error'
                      }`}
                      onClick={handleLeaveClick}
                      disabled={leaveMutation.isPending || !canLeaveClub}
                      title={
                        club.userRole === 'leader' && club.memberCount > 1
                          ? 'Transfer leadership to another member before leaving'
                          : undefined
                      }
                    >
                      <MdExitToApp className="text-lg" />
                      <span className="hidden sm:inline">
                        {leaveMutation.isPending
                          ? 'Processing...'
                          : getLeaveButtonText}
                      </span>
                    </button>
                  </>
                ) : user &&
                  club.isUserMember &&
                  club.userStatus === 'pending' ? (
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={handleLeaveClick}
                    disabled={leaveMutation.isPending}
                  >
                    <MdExitToApp className="text-lg" />
                    <span className="hidden sm:inline">
                      {leaveMutation.isPending
                        ? 'Canceling...'
                        : 'Cancel Request'}
                    </span>
                  </button>
                ) : user ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => joinMutation.mutate()}
                    disabled={
                      joinMutation.isPending ||
                      club.memberCount >= club.memberLimit
                    }
                  >
                    <MdPersonAdd className="text-lg" />
                    <span className="hidden sm:inline">
                      {joinMutation.isPending
                        ? club.isPublic
                          ? 'Joining...'
                          : 'Requesting...'
                        : club.isPublic
                          ? 'Join Club'
                          : 'Request to Join'}
                    </span>
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/login')}
                  >
                    <MdPersonAdd className="text-lg" />
                    <span className="hidden sm:inline">Login to Join</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Club Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {club.description && (
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg mb-4">About</h2>
                  <p className="text-base-content/80 whitespace-pre-wrap">
                    {club.description}
                  </p>
                </div>
              </div>
            )}

            {/* Rules */}
            {club.rules && (
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg mb-4">Rules</h2>
                  <p className="text-base-content/80 whitespace-pre-wrap">
                    {club.rules}
                  </p>
                </div>
              </div>
            )}

            {/* Club Media Section */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-lg">Club Media</h2>
                  {canManageClub && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setIsAddMediaModalOpen(true)}
                    >
                      <MdAdd className="text-lg" />
                      <span className="hidden sm:inline">Add Media</span>
                    </button>
                  )}
                </div>

                {isMediaLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : clubMedia?.media && clubMedia.media.length > 0 ? (
                  <div className="space-y-4">
                    {clubMedia.media.map((media) => (
                      <div
                        key={media._id}
                        className="border border-base-300 rounded-lg p-4 hover:bg-base-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 text-2xl text-primary">
                            {getMediaTypeIcon(media.mediaType)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-lg truncate">
                                {media.title}
                              </h3>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className={`badge ${
                                    media.isActive
                                      ? 'badge-success'
                                      : 'badge-ghost'
                                  } badge-sm`}
                                >
                                  {media.isActive ? 'Active' : 'Ended'}
                                </span>
                                <span className="badge badge-outline badge-sm capitalize">
                                  {media.mediaType}
                                </span>
                              </div>
                            </div>

                            {media.description && (
                              <p className="text-sm text-base-content/70 mb-3 line-clamp-2">
                                {media.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between text-xs text-base-content/60">
                              <div className="flex items-center gap-4">
                                <span>
                                  Start:{' '}
                                  {new Date(
                                    media.startDate
                                  ).toLocaleDateString()}
                                </span>
                                <span>
                                  End:{' '}
                                  {new Date(media.endDate).toLocaleDateString()}
                                </span>
                              </div>

                              {media.votes && media.votes.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <MdThumbUp className="text-sm" />
                                  <span>{media.votes.length} votes</span>
                                </div>
                              )}
                            </div>

                            {club.isUserMember &&
                              club.userStatus === 'active' && (
                                <div className="flex gap-2 mt-3">
                                  <button className="btn btn-outline btn-xs">
                                    View Reviews
                                  </button>
                                  <button className="btn btn-primary btn-xs">
                                    Add Review
                                  </button>
                                  {media.isActive && (
                                    <button className="btn btn-secondary btn-xs">
                                      Vote
                                    </button>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-base-content/60">
                    <MdBook className="mx-auto text-4xl mb-2 opacity-50" />
                    <p>No media added yet</p>
                    {canManageClub && (
                      <p className="text-sm mt-1">
                        Add the first media for your club members to enjoy!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Media Voting Section */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-lg flex items-center gap-2">
                    <MdHowToVote className="text-xl" />
                    Media Voting
                  </h2>
                  {canManageClub && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setIsCreateVotingWizardOpen(true)}
                    >
                      <MdAdd className="text-lg" />
                      <span className="hidden sm:inline">Create Voting</span>
                    </button>
                  )}
                </div>

                <VotingSystem club={club} canManageVoting={canManageClub} />
              </div>
            </div>
          </div>

          {/* Right Column - Members & Tags */}
          <div className="space-y-6">
            {/* Tags */}
            {club.tags && club.tags.length > 0 && (
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <h2 className="card-title text-lg mb-4">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {club.tags.map((tag) => (
                      <span key={tag} className="badge badge-outline">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Members */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4">
                  Members ({club.memberCount})
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {club.members
                    .filter((member) => member.status === 'active')
                    .sort((a, b) => {
                      // Sort by role: leader first, then moderator, then member
                      const roleOrder = { leader: 0, moderator: 1, member: 2 };
                      return roleOrder[a.role] - roleOrder[b.role];
                    })
                    .map((member, index) => (
                      <div
                        key={member.user._id || index}
                        className="flex items-center gap-3"
                      >
                        <div className="avatar">
                          <div className="w-10 h-10 rounded-full">
                            {member.user.avatar ? (
                              <img
                                src={member.user.avatar}
                                alt={member.user.username}
                                className="rounded-full w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-semibold">
                                  {member.user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {member.user.username}
                            </span>
                            {getRoleIcon(member.role)}
                          </div>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(member.role)}
                            <span className="text-xs text-base-content/70">
                              Joined{' '}
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Media Modal */}
      {isAddMediaModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Add New Media</h3>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setIsAddMediaModalOpen(false)}
              >
                <MdClose className="text-lg" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  mediaForm.title &&
                  mediaForm.startDate &&
                  mediaForm.endDate
                ) {
                  addMediaMutation.mutate(mediaForm);
                }
              }}
              className="space-y-4"
            >
              {/* Media Type */}
              <div>
                <label className="label">
                  <span className="label-text">Media Type</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={mediaForm.mediaType}
                  onChange={(e) =>
                    setMediaForm({
                      ...mediaForm,
                      mediaType: e.target.value as typeof mediaForm.mediaType,
                    })
                  }
                >
                  <option value="anime">Anime</option>
                  <option value="manga">Manga</option>
                  <option value="reading">Reading</option>
                  <option value="vn">Visual Novel</option>
                  <option value="video">Video</option>
                  <option value="movie">Movie</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="label">
                  <span className="label-text">Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter media title"
                  value={mediaForm.title}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, title: e.target.value })
                  }
                  required
                />
              </div>

              {/* Media ID (optional for external links) */}
              <div>
                <label className="label">
                  <span className="label-text">Media ID (optional)</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="AniList ID, MAL ID, etc."
                  value={mediaForm.mediaId}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, mediaId: e.target.value })
                  }
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Optional description or notes"
                  value={mediaForm.description}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="label">
                  <span className="label-text">Start Date *</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={mediaForm.startDate}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, startDate: e.target.value })
                  }
                  required
                />
              </div>

              {/* End Date */}
              <div>
                <label className="label">
                  <span className="label-text">End Date *</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={mediaForm.endDate}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, endDate: e.target.value })
                  }
                  required
                />
              </div>

              {/* Submit buttons */}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsAddMediaModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    addMediaMutation.isPending ||
                    !mediaForm.title ||
                    !mediaForm.startDate ||
                    !mediaForm.endDate
                  }
                >
                  {addMediaMutation.isPending ? 'Adding...' : 'Add Media'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Voting Wizard */}
      {club && (
        <CreateVotingWizard
          isOpen={isCreateVotingWizardOpen}
          onClose={() => setIsCreateVotingWizardOpen(false)}
          club={club}
        />
      )}
    </div>
  );
}

export default ClubDetailScreen;
