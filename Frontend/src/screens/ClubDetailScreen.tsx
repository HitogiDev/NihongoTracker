import { useMemo, useState } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdGroup,
  MdEdit,
  MdPersonAdd,
  MdExitToApp,
  MdShield,
  MdVerified,
  MdPlayArrow,
  MdBook,
  MdMovie,
  MdMusicNote,
  MdAdd,
  MdClose,
  MdHowToVote,
  MdLeaderboard,
  MdInfo,
  MdPeople,
  MdSettings,
} from 'react-icons/md';
import {
  getClubFn,
  joinClubFn,
  leaveClubFn,
  getClubMediaFn,
  addClubMediaFn,
  getPendingMembershipRequestsFn,
  manageMembershipRequestFn,
  transferLeadershipFn,
  updateClubWithFilesFn,
} from '../api/clubApi';
import useSearch from '../hooks/useSearch';
import { IMediaDocument } from '../types.d';
import { useUserDataStore } from '../store/userData';
import CreateVotingWizard from '../components/club/CreateVotingWizard';
import VotingSystem from '../components/club/VotingSystem';
import ClubRankingsTab from '../components/ClubRankingsTab';
import QuickLog from '../components/QuickLog';
import RecentActivity from '../components/club/RecentActivity';

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
  const [showVotingManagement, setShowVotingManagement] = useState(false);
  const [isEditClubModalOpen, setIsEditClubModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);

  // Confirmation modal states
  const [isDisbandConfirmModalOpen, setIsDisbandConfirmModalOpen] =
    useState(false);
  const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState(false);
  const [isTransferLeadershipModalOpen, setIsTransferLeadershipModalOpen] =
    useState(false);
  const [selectedNewLeader, setSelectedNewLeader] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'media' | 'members' | 'rankings'
  >('overview');
  const [selectedMedia, setSelectedMedia] = useState<{
    _id: string;
    mediaId: string;
    mediaType: string;
    title: string;
  } | null>(null);
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
    // Add media data for creation if media doesn't exist
    mediaData: undefined as Partial<IMediaDocument> | undefined,
  });

  // Search state for media autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Use the search hook for media search
  const { data: searchResults, isLoading: isSearching } = useSearch(
    mediaForm.mediaType,
    searchQuery,
    undefined,
    1,
    10
  );

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
        mediaData: undefined,
      });
      // Reset search state
      setSearchQuery('');
      setShowResults(false);
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

  const canManageClub = useMemo(() => {
    return club?.userRole === 'leader' || club?.userRole === 'moderator';
  }, [club?.userRole]);

  // Pending membership requests (leaders only)
  const { data: pendingRequests, refetch: refetchPending } = useQuery({
    queryKey: ['clubPending', clubId],
    queryFn: () => getPendingMembershipRequestsFn(clubId!),
    enabled: !!clubId && club?.userRole === 'leader',
  });

  const membershipActionMutation = useMutation({
    mutationFn: ({
      memberId,
      action,
    }: {
      memberId: string;
      action: 'approve' | 'reject';
    }) => manageMembershipRequestFn(clubId!, memberId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      refetchPending();
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to update membership';
      if (error instanceof Error) errorMessage = error.message;
      toast.error(errorMessage);
    },
  });

  // Transfer leadership mutation
  const transferLeadershipMutation = useMutation({
    mutationFn: (newLeaderId: string) =>
      transferLeadershipFn(clubId!, newLeaderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast.success('Leadership transferred successfully!');
      setIsTransferLeadershipModalOpen(false);
      setSelectedNewLeader(null);
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to transfer leadership';
      if (error instanceof Error) errorMessage = error.message;
      toast.error(errorMessage);
    },
  });

  // Edit club form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    isPublic: true,
    tags: [] as string[],
    rules: '',
    memberLimit: 100,
  });

  // File upload state for edit
  const [editFiles, setEditFiles] = useState<{
    avatar?: File;
    banner?: File;
  }>({});

  const [editPreviews, setEditPreviews] = useState<{
    avatar?: string;
    banner?: string;
  }>({});

  // Update club mutation
  const updateClubMutation = useMutation({
    mutationFn: (updateData: typeof editForm) => {
      return updateClubWithFilesFn(clubId!, {
        ...updateData,
        avatarFile: editFiles.avatar,
        bannerFile: editFiles.banner,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast.success('Club updated successfully!');
      setIsEditClubModalOpen(false);
      // Clear file selections
      setEditFiles({});
      setEditPreviews({});
    },
    onError: (error: unknown) => {
      let errorMessage = 'Failed to update club';
      if (error instanceof Error) errorMessage = error.message;
      toast.error(errorMessage);
    },
  });

  // Initialize edit form when club data is loaded
  React.useEffect(() => {
    if (club) {
      setEditForm({
        name: club.name,
        description: club.description || '',
        isPublic: club.isPublic,
        tags: club.tags || [],
        rules: club.rules || '',
        memberLimit: club.memberLimit,
      });
    }
  }, [club]);

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
      setIsDisbandConfirmModalOpen(true);
      return;
    }

    // Show confirmation for regular members
    setIsLeaveConfirmModalOpen(true);
  };

  // Handle selecting media from search results
  const handleSelectResult = (result: IMediaDocument) => {
    const title =
      result.title.contentTitleEnglish ||
      result.title.contentTitleRomaji ||
      result.title.contentTitleNative;

    // Get description from the first available description
    const description = result.description?.[0]?.description || '';
    const cleanDescription = description
      .replace(/<[^>]*>/g, '')
      .substring(0, 200);

    setMediaForm((prev) => ({
      ...prev,
      mediaId: result.contentId,
      title,
      description: cleanDescription ? cleanDescription + '...' : '',
      // Store full media data for potential creation
      mediaData: {
        contentId: result.contentId,
        contentTitleNative: result.title.contentTitleNative,
        contentTitleEnglish: result.title.contentTitleEnglish,
        contentTitleRomaji: result.title.contentTitleRomaji,
        contentImage: result.contentImage,
        coverImage: result.coverImage,
        episodes: result.episodes,
        episodeDuration: result.episodeDuration,
        runtime: result.runtime,
        chapters: result.chapters,
        volumes: result.volumes,
        isAdult: result.isAdult,
        description: result.description,
        synonyms: result.synonyms,
      },
    }));
    setSearchQuery(title);
    setShowResults(false);
  };

  // Handle search input
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  // Handle closing add media modal
  const handleCloseAddMediaModal = () => {
    setIsAddMediaModalOpen(false);
    setSearchQuery('');
    setShowResults(false);
    setMediaForm({
      mediaId: '',
      mediaType: 'anime',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      mediaData: undefined,
    });
  };

  // Handle closing edit club modal
  const handleCloseEditModal = () => {
    setIsEditClubModalOpen(false);
    // Reset form to original club data
    if (club) {
      setEditForm({
        name: club.name,
        description: club.description || '',
        isPublic: club.isPublic,
        tags: club.tags || [],
        rules: club.rules || '',
        memberLimit: club.memberLimit,
      });
    }
    // Clear file selections
    setEditFiles({});
    setEditPreviews({});
  };

  // Handle file selection for edit modal
  const handleEditFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'banner'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    // Update file state
    setEditFiles((prev) => ({ ...prev, [type]: file }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setEditPreviews((prev) => ({ ...prev, [type]: result }));
    };
    reader.readAsDataURL(file);
  };

  // Remove selected file
  const handleEditFileRemove = (type: 'avatar' | 'banner') => {
    setEditFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[type];
      return newFiles;
    });
    setEditPreviews((prev) => {
      const newPreviews = { ...prev };
      delete newPreviews[type];
      return newPreviews;
    });
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
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-base-content/70">
                  <div className="flex items-center gap-1">
                    <MdGroup className="text-base" />
                    <span>
                      {club.memberCount}/{club.memberLimit} members
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons - Centered on mobile, right-aligned on desktop */}
              <div className="flex gap-2 justify-center sm:justify-end mt-4 sm:mt-0">
                {user && club.isUserMember && club.userStatus === 'active' ? (
                  <>
                    {canManageClub && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditClubModalOpen(true)}
                      >
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
        {/* Tab Navigation */}
        <div className="tabs tabs-boxed mb-8 w-fit mx-auto">
          <button
            className={`tab ${activeTab === 'overview' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <MdInfo className="mr-2" />
            Overview
          </button>
          <button
            className={`tab ${activeTab === 'media' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <MdPlayArrow className="mr-2" />
            Media
          </button>
          <button
            className={`tab ${activeTab === 'members' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <MdPeople className="mr-2" />
            Members
            {club?.userRole === 'leader' &&
              pendingRequests?.pending &&
              pendingRequests.pending.length > 0 && (
                <span className="badge badge-warning badge-sm ml-2">
                  {pendingRequests.pending.length}
                </span>
              )}
          </button>
          <button
            className={`tab ${activeTab === 'rankings' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('rankings')}
          >
            <MdLeaderboard className="mr-2" />
            Rankings
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
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

              {/* Media Voting Section */}
              <div className="card bg-base-100 shadow-sm">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="card-title text-lg flex items-center gap-2">
                      <MdHowToVote className="text-xl" />
                      Media Voting
                    </h2>
                    {canManageClub && (
                      <div className="flex gap-2">
                        <button
                          className={`btn btn-outline btn-sm ${showVotingManagement ? 'btn-primary' : ''}`}
                          onClick={() =>
                            setShowVotingManagement(!showVotingManagement)
                          }
                        >
                          <MdSettings className="text-lg" />
                          <span className="hidden sm:inline">
                            {showVotingManagement ? 'Hide' : 'Manage'}
                          </span>
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setIsCreateVotingWizardOpen(true)}
                        >
                          <MdAdd className="text-lg" />
                          <span className="hidden sm:inline">
                            Create Voting
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  <VotingSystem
                    club={club}
                    canManageVoting={canManageClub}
                    showManagement={showVotingManagement}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Tags and Recent Activity */}
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

              {/* Recent Activity */}
              {club.isUserMember && club.userStatus === 'active' && (
                <RecentActivity clubId={club._id} />
              )}
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="max-w-6xl mx-auto">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clubMedia.media.map((media) => (
                      <div
                        key={media._id}
                        className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200 border border-base-300"
                      >
                        {/* Media Image/Banner */}
                        <figure className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20">
                          {media.mediaDocument?.contentImage ||
                          media.mediaDocument?.coverImage ? (
                            <img
                              src={
                                media.mediaDocument.contentImage ||
                                media.mediaDocument.coverImage
                              }
                              alt={media.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-6xl text-base-content/30">
                              {getMediaTypeIcon(media.mediaType)}
                            </div>
                          )}

                          {/* Status Badge */}
                          <div className="absolute top-2 right-2">
                            <span
                              className={`badge ${
                                media.isActive ? 'badge-success' : 'badge-ghost'
                              } badge-sm`}
                            >
                              {media.isActive ? 'Active' : 'Ended'}
                            </span>
                          </div>

                          {/* Media Type Badge */}
                          <div className="absolute top-2 left-2">
                            <span className="badge badge-primary badge-sm capitalize">
                              {media.mediaType}
                            </span>
                          </div>
                        </figure>

                        <div className="card-body p-4">
                          <h3 className="card-title text-base font-semibold line-clamp-2 mb-2">
                            {media.title}
                          </h3>

                          {media.description && (
                            <p className="text-sm text-base-content/70 line-clamp-3 mb-3">
                              {media.description}
                            </p>
                          )}

                          <div className="flex flex-col gap-2 text-xs text-base-content/60 mb-4">
                            <div className="flex items-center justify-between">
                              <span>
                                Start:{' '}
                                {new Date(media.startDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>
                                End:{' '}
                                {new Date(media.endDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Added by: {media.addedBy.username}</span>
                            </div>
                          </div>

                          {club.isUserMember &&
                            club.userStatus === 'active' && (
                              <div className="card-actions justify-between">
                                <button
                                  className="btn btn-outline btn-sm flex-1"
                                  onClick={() =>
                                    navigate(
                                      `/clubs/${clubId}/media/${media._id}`
                                    )
                                  }
                                >
                                  View Details
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setSelectedMedia({
                                      _id: media._id || '',
                                      mediaId: media.mediaId,
                                      mediaType: media.mediaType,
                                      title: media.title,
                                    });
                                    setLogModalOpen(true);
                                  }}
                                  title="Quick Log"
                                >
                                  Log
                                </button>
                              </div>
                            )}
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
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="max-w-4xl mx-auto">
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-lg mb-4">
                  Members ({club.memberCount})
                </h2>
                {club.userRole === 'leader' &&
                  pendingRequests?.pending &&
                  pendingRequests.pending.length > 0 && (
                    <div className="mb-8">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        Pending Requests
                        <span className="badge badge-warning badge-sm">
                          {pendingRequests.pending.length}
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {pendingRequests.pending.map((member) => (
                          <div
                            key={member.user._id}
                            className="flex items-center gap-3 p-3 rounded border border-base-300 bg-base-100"
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
                                      {member.user.username
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                {member.user.username}
                              </div>
                              <div className="text-xs text-base-content/60">
                                Requested{' '}
                                {new Date(member.joinedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() =>
                                  membershipActionMutation.mutate({
                                    memberId: member.user._id,
                                    action: 'approve',
                                  })
                                }
                                disabled={membershipActionMutation.isPending}
                              >
                                {membershipActionMutation.isPending
                                  ? '...'
                                  : 'Approve'}
                              </button>
                              <button
                                className="btn btn-xs btn-error"
                                onClick={() =>
                                  membershipActionMutation.mutate({
                                    memberId: member.user._id,
                                    action: 'reject',
                                  })
                                }
                                disabled={membershipActionMutation.isPending}
                              >
                                {membershipActionMutation.isPending
                                  ? '...'
                                  : 'Reject'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="divider my-6" />
                    </div>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        className="card bg-base-100 border border-base-300 shadow-sm"
                      >
                        <div className="card-body p-4">
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="w-12 h-12 rounded-full">
                                {member.user.avatar ? (
                                  <img
                                    src={member.user.avatar}
                                    alt={member.user.username}
                                    className="rounded-full w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary font-semibold">
                                      {member.user.username
                                        .charAt(0)
                                        .toUpperCase()}
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
                              <div className="flex flex-col gap-1">
                                {getRoleBadge(member.role)}
                                <span className="text-xs text-base-content/70">
                                  Joined{' '}
                                  {new Date(
                                    member.joinedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Leadership Transfer Action - Only show for current leader */}
                          {club?.userRole === 'leader' &&
                            member.role !== 'leader' &&
                            member.user._id !== user?._id && (
                              <div className="mt-3 pt-3 border-t border-base-300">
                                <button
                                  className="btn btn-outline btn-xs w-full"
                                  onClick={() => {
                                    setSelectedNewLeader({
                                      userId: member.user._id,
                                      username: member.user.username,
                                    });
                                    setIsTransferLeadershipModalOpen(true);
                                  }}
                                  disabled={
                                    transferLeadershipMutation.isPending
                                  }
                                >
                                  Transfer Leadership
                                </button>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rankings Tab */}
        {activeTab === 'rankings' && clubId && (
          <ClubRankingsTab clubId={clubId} />
        )}
      </div>

      {/* Add Media Modal */}
      {isAddMediaModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Add New Media</h3>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={handleCloseAddMediaModal}
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
                  onChange={(e) => {
                    setMediaForm({
                      ...mediaForm,
                      mediaType: e.target.value as typeof mediaForm.mediaType,
                    });
                    // Reset search when media type changes
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                >
                  <option value="anime">Anime</option>
                  <option value="manga">Manga</option>
                  <option value="reading">Reading</option>
                  <option value="vn">Visual Novel</option>
                  <option value="video">Video</option>
                  <option value="movie">Movie</option>
                </select>
              </div>

              {/* Title with Search */}
              <div className="relative">
                <label className="label">
                  <span className="label-text">Search for Media</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder={`Search for ${mediaForm.mediaType}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                  />
                  {isSearching && (
                    <span className="loading loading-spinner loading-sm absolute right-3 top-1/2 transform -translate-y-1/2"></span>
                  )}

                  {/* Search Results - Positioned as absolute popup */}
                  {showResults && searchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1">
                      <div className="card bg-base-100 shadow-xl border border-base-300 max-h-60 overflow-y-auto">
                        <div className="card-body p-2">
                          {searchResults.map((result) => (
                            <div
                              key={result.contentId}
                              onClick={() => handleSelectResult(result)}
                              className="flex items-center gap-3 p-3 hover:bg-base-200 cursor-pointer rounded"
                            >
                              <img
                                src={result.contentImage || ''}
                                alt={
                                  result.title.contentTitleRomaji ||
                                  result.title.contentTitleNative
                                }
                                className="w-12 h-16 object-cover rounded"
                              />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {result.title.contentTitleEnglish ||
                                    result.title.contentTitleRomaji ||
                                    result.title.contentTitleNative}
                                </div>
                                <div className="text-sm text-base-content/60">
                                  {result.type}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="divider">OR</div>

                <div>
                  <label className="label">
                    <span className="label-text">Title *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="Enter title manually"
                    value={mediaForm.title}
                    onChange={(e) =>
                      setMediaForm({ ...mediaForm, title: e.target.value })
                    }
                    required
                  />
                </div>
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
                  onClick={handleCloseAddMediaModal}
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

      {/* Quick Log Modal */}
      {selectedMedia && (
        <QuickLog
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          media={{
            contentId: selectedMedia.mediaId,
            title: {
              contentTitleNative: selectedMedia.title,
              contentTitleRomaji: selectedMedia.title,
              contentTitleEnglish: selectedMedia.title,
            },
            type: selectedMedia.mediaType as
              | 'anime'
              | 'manga'
              | 'reading'
              | 'vn'
              | 'video'
              | 'movie',
            contentImage: undefined, // Let QuickLog handle image loading
            isAdult: false,
          }}
        />
      )}

      {/* Edit Club Modal */}
      {isEditClubModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Edit Club</h3>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={handleCloseEditModal}
              >
                <MdClose className="text-lg" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateClubMutation.mutate(editForm);
              }}
              className="space-y-4"
            >
              {/* Club Name */}
              <div>
                <label className="label">
                  <span className="label-text">Club Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                  maxLength={100}
                />
              </div>

              {/* Avatar Upload */}
              <div>
                <label className="label">
                  <span className="label-text">Club Avatar</span>
                </label>

                {/* Current/Preview Avatar - Centered */}
                <div className="flex justify-center mb-4">
                  <div className="avatar">
                    <div className="w-24 h-24 rounded-full ring ring-base-300 ring-offset-2">
                      {editPreviews.avatar ? (
                        <img
                          src={editPreviews.avatar}
                          alt="New avatar preview"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : club?.avatar ? (
                        <img
                          src={club.avatar}
                          alt="Current avatar"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                          <MdGroup className="text-3xl text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Upload/Remove buttons - Centered */}
                <div className="flex flex-col items-center gap-2">
                  <label className="btn btn-outline btn-sm">
                    <MdEdit className="text-base mr-1" />
                    {editPreviews.avatar || club?.avatar
                      ? 'Change Avatar'
                      : 'Upload Avatar'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleEditFileSelect(e, 'avatar')}
                      className="hidden"
                    />
                  </label>
                  {(editPreviews.avatar || club?.avatar) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleEditFileRemove('avatar')}
                    >
                      Remove Avatar
                    </button>
                  )}
                </div>

                <div className="label">
                  <span className="label-text-alt text-center block">
                    Recommended: Square image, max 5MB
                  </span>
                </div>
              </div>

              {/* Banner Upload */}
              <div>
                <label className="label">
                  <span className="label-text">Club Banner</span>
                </label>

                {/* Current/Preview Banner */}
                <div className="mb-4">
                  <div className="w-full h-32 rounded-lg overflow-hidden border-2 border-dashed border-base-300 bg-base-50 flex items-center justify-center">
                    {editPreviews.banner ? (
                      <img
                        src={editPreviews.banner}
                        alt="New banner preview"
                        className="w-full h-full object-cover"
                      />
                    ) : club?.banner ? (
                      <img
                        src={club.banner}
                        alt="Current banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-base-content/50">
                        <div className="text-3xl mb-2">🖼️</div>
                        <div className="text-sm">No banner uploaded</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload/Remove buttons - Centered */}
                <div className="flex flex-col items-center gap-2">
                  <label className="btn btn-outline btn-sm">
                    <MdEdit className="text-base mr-1" />
                    {editPreviews.banner || club?.banner
                      ? 'Change Banner'
                      : 'Upload Banner'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleEditFileSelect(e, 'banner')}
                      className="hidden"
                    />
                  </label>
                  {(editPreviews.banner || club?.banner) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleEditFileRemove('banner')}
                    >
                      Remove Banner
                    </button>
                  )}
                </div>

                <div className="label">
                  <span className="label-text-alt text-center block">
                    Recommended: 16:9 aspect ratio, max 5MB
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="label">
                  <span className="label-text">Privacy</span>
                </label>
                <div className="flex gap-4">
                  <label className="label cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      className="radio radio-primary"
                      checked={editForm.isPublic}
                      onChange={() =>
                        setEditForm({ ...editForm, isPublic: true })
                      }
                    />
                    <span className="label-text ml-2">Public</span>
                  </label>
                  <label className="label cursor-pointer">
                    <input
                      type="radio"
                      name="privacy"
                      className="radio radio-primary"
                      checked={!editForm.isPublic}
                      onChange={() =>
                        setEditForm({ ...editForm, isPublic: false })
                      }
                    />
                    <span className="label-text ml-2">Private</span>
                  </label>
                </div>
              </div>

              {/* Member Limit */}
              <div>
                <label className="label">
                  <span className="label-text">Member Limit</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  value={editForm.memberLimit}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      memberLimit: parseInt(e.target.value) || 100,
                    })
                  }
                  min={1}
                  max={1000}
                />
              </div>

              {/* Rules */}
              <div>
                <label className="label">
                  <span className="label-text">Rules</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  value={editForm.rules}
                  onChange={(e) =>
                    setEditForm({ ...editForm, rules: e.target.value })
                  }
                  rows={4}
                  maxLength={1000}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="label">
                  <span className="label-text">Tags</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter tags separated by commas"
                  value={editForm.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter((tag) => tag.length > 0);
                    setEditForm({ ...editForm, tags });
                  }}
                />
                <div className="label">
                  <span className="label-text-alt">
                    Separate tags with commas (e.g., beginner, anime,
                    study-group)
                  </span>
                </div>
              </div>

              {/* Submit buttons */}
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCloseEditModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    updateClubMutation.isPending || !editForm.name.trim()
                  }
                >
                  {updateClubMutation.isPending ? 'Updating...' : 'Update Club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disband Club Confirmation Modal */}
      {isDisbandConfirmModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-warning">Disband Club</h3>
            <p className="py-4">
              This will permanently disband the club and remove all data. This
              action cannot be undone.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsDisbandConfirmModalOpen(false)}
                disabled={leaveMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={() => {
                  setIsDisbandConfirmModalOpen(false);
                  leaveMutation.mutate();
                }}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? 'Disbanding...' : 'Disband Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Club Confirmation Modal */}
      {isLeaveConfirmModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Leave Club</h3>
            <p className="py-4">
              Are you sure you want to leave this club? You will need to request
              to join again if the club is private.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setIsLeaveConfirmModalOpen(false)}
                disabled={leaveMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => {
                  setIsLeaveConfirmModalOpen(false);
                  leaveMutation.mutate();
                }}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? 'Leaving...' : 'Leave Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Leadership Confirmation Modal */}
      {isTransferLeadershipModalOpen && selectedNewLeader && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-warning">
              Transfer Leadership
            </h3>
            <p className="py-4">
              Are you sure you want to transfer club leadership to{' '}
              <span className="font-semibold">
                {selectedNewLeader.username}
              </span>
              ?
            </p>
            <div className="alert alert-warning mb-4">
              <MdInfo className="text-lg" />
              <div className="text-sm">
                <div className="font-semibold">
                  This action cannot be undone!
                </div>
                <div>
                  You will become a regular member and lose all leadership
                  privileges.
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setIsTransferLeadershipModalOpen(false);
                  setSelectedNewLeader(null);
                }}
                disabled={transferLeadershipMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={() =>
                  transferLeadershipMutation.mutate(selectedNewLeader.userId)
                }
                disabled={transferLeadershipMutation.isPending}
              >
                {transferLeadershipMutation.isPending
                  ? 'Transferring...'
                  : 'Transfer Leadership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubDetailScreen;
