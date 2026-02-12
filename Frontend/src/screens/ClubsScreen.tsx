import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Users,
  Earth,
  Lock,
  ListFilter,
  Funnel,
  ChevronDown,
} from 'lucide-react';
import { getClubsFn } from '../api/clubApi';
import { IClubResponse } from '../types';
import { useUserDataStore } from '../store/userData';

function ClubsScreen() {
  const navigate = useNavigate();
  const { user } = useUserDataStore();

  // Search and filter states
  const [searchInput, setSearchInput] = useState(''); // Input value
  const [search, setSearch] = useState(''); // Debounced value for query
  const [sortBy, setSortBy] = useState('memberCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Query clubs
  const {
    data: clubsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'clubs',
      search,
      sortBy,
      sortOrder,
      showPublicOnly,
      selectedTags,
      page,
    ],
    queryFn: () =>
      getClubsFn({
        page,
        limit: 12,
        search,
        sortBy,
        sortOrder,
        isPublic: showPublicOnly ? true : undefined,
        tags: selectedTags.join(','),
      }),
    placeholderData: (previousData) => previousData,
  });

  // Available tags for filtering
  const availableTags = [
    'beginner',
    'intermediate',
    'advanced',
    'anime',
    'manga',
    'reading',
    'visual-novel',
    'competitive',
    'casual',
    'study-group',
  ];

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1); // Reset to first page when filtering
  };

  const sortOptions = [
    { value: 'memberCount', label: 'Members' },
    { value: 'createdAt', label: 'Newest' },
    { value: 'name', label: 'Name' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-error mb-4">
            Error loading clubs
          </h2>
          <p className="text-base-content/70">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Users className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-base-content">
              Immersion Clubs
            </h1>
          </div>
          <p className="text-base-content/70">
            Join clubs to immerse with others, participate in challenges, and
            share your Japanese learning journey
          </p>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8 max-w-4xl mx-auto">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 text-xl" />
            <input
              type="text"
              placeholder="Search clubs..."
              className="input input-bordered w-full pl-12 pr-4"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
            />
          </div>

          {/* Create Club Button */}
          {user && (
            <button
              className="btn btn-primary gap-2 whitespace-nowrap"
              onClick={() => navigate('/clubs/create')}
            >
              <Plus className="text-lg" />
              Create Club
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Filters */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-base-100 rounded-lg shadow-sm p-6 space-y-6">
              {/* Sort Options */}
              <div>
                <h3 className="font-semibold text-base-content mb-3 flex items-center gap-2">
                  <ListFilter className="text-lg" />
                  Sort By
                </h3>
                <div className="dropdown w-full">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-outline w-full justify-between"
                  >
                    <span>
                      {sortOptions.find((opt) => opt.value === sortBy)?.label ||
                        'Members'}
                    </span>
                    <ChevronDown className="text-lg" />
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-full border border-base-300"
                  >
                    {sortOptions.map((option) => (
                      <li key={option.value}>
                        <button
                          className={`text-left ${
                            sortBy === option.value
                              ? 'active bg-primary text-primary-content'
                              : ''
                          }`}
                          onClick={() => {
                            setSortBy(option.value);
                            setPage(1);
                          }}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2">
                  <label className="label cursor-pointer">
                    <span className="label-text">Descending</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      checked={sortOrder === 'desc'}
                      onChange={(e) =>
                        setSortOrder(e.target.checked ? 'desc' : 'asc')
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Visibility Filter */}
              <div>
                <h3 className="font-semibold text-base-content mb-3 flex items-center gap-2">
                  <Funnel className="text-lg" />
                  Visibility
                </h3>
                <label className="label cursor-pointer">
                  <span className="label-text">Public Only</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={showPublicOnly}
                    onChange={(e) => {
                      setShowPublicOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                </label>
              </div>

              {/* Tags Filter */}
              <div>
                <h3 className="font-semibold text-base-content mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      className={`badge badge-outline text-xs py-2 px-3 cursor-pointer transition-all ${
                        selectedTags.includes(tag)
                          ? 'badge-primary bg-primary/10'
                          : 'hover:bg-base-200'
                      }`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Clubs Grid */}
          <div className="flex-1">
            {clubsData?.clubs && clubsData.clubs.length > 0 ? (
              <>
                {/* Results Info */}
                <div className="mb-6 text-base-content/70">
                  Showing {clubsData.clubs.length} of {clubsData.total} clubs
                </div>

                {/* Clubs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {clubsData.clubs.map((club) => (
                    <ClubCard key={club._id} club={club} />
                  ))}
                </div>

                {/* Pagination */}
                {clubsData.total > 12 && (
                  <div className="flex justify-center mt-8">
                    <div className="join">
                      <button
                        className="join-item btn"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </button>
                      <button className="join-item btn btn-active">
                        Page {page}
                      </button>
                      <button
                        className="join-item btn"
                        disabled={page * 12 >= clubsData.total}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Users className="text-6xl text-base-content/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-base-content mb-2">
                  No clubs found
                </h3>
                <p className="text-base-content/70 mb-6">
                  {search || selectedTags.length > 0
                    ? 'Try adjusting your search or filters'
                    : 'Be the first to create a club!'}
                </p>
                {user && (
                  <button
                    className="btn btn-primary gap-2"
                    onClick={() => navigate('/clubs/create')}
                  >
                    <Plus className="text-lg" />
                    Create First Club
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Club Card Component
function ClubCard({ club }: { club: IClubResponse }) {
  const navigate = useNavigate();

  return (
    <div
      className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-base-300 hover:border-primary/30"
      onClick={() => navigate(`/clubs/${club._id}`)}
    >
      {/* Banner */}
      <div className="relative h-32 overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/20 to-secondary/20">
        {club.banner && (
          <img
            src={club.banner}
            alt={`${club.name} banner`}
            className="w-full h-full object-cover"
          />
        )}

        {/* Privacy Badge */}
        <div className="absolute top-3 right-3">
          <div
            className={`badge gap-1 ${club.isPublic ? 'badge-success' : 'badge-warning'}`}
          >
            {club.isPublic ? (
              <Earth className="text-xs" />
            ) : (
              <Lock className="text-xs" />
            )}
            {club.isPublic ? 'Public' : 'Private'}
          </div>
        </div>
      </div>

      <div className="card-body pt-6 pb-6">
        {/* Club Avatar */}
        <div className="flex justify-center md:justify-start -mt-16 mb-4">
          <div className="avatar">
            <div className="w-20 h-20 rounded-full bg-base-100 p-1 shadow-lg">
              {club.avatar ? (
                <img
                  src={club.avatar}
                  alt={club.name}
                  className="rounded-full w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="text-2xl text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Club Name */}
        <div className="mb-3">
          <h3 className="card-title text-lg font-bold truncate">{club.name}</h3>
        </div>

        {/* Description */}
        {club.description && (
          <p className="text-sm text-base-content/70 line-clamp-2 mb-3">
            {club.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center text-sm text-base-content/70 mb-4">
          <div className="flex items-center gap-1">
            <Users className="text-base" />
            <span>
              {club.memberCount}/{club.memberLimit} members
            </span>
          </div>
        </div>

        {/* Tags */}
        {club.tags && club.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {club.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge badge-outline badge-xs">
                {tag}
              </span>
            ))}
            {club.tags.length > 3 && (
              <span className="badge badge-ghost badge-xs">
                +{club.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Join Status */}
        <div className="card-actions justify-end">
          {club.isUserMember && club.userStatus === 'active' ? (
            <div className="badge badge-primary gap-1">
              <Users className="text-xs" />
              {club.userRole === 'leader'
                ? 'Leader'
                : club.userRole === 'moderator'
                  ? 'Moderator'
                  : 'Member'}
            </div>
          ) : club.isUserMember && club.userStatus === 'pending' ? (
            <div className="badge badge-warning gap-1">
              <Users className="text-xs" />
              Pending
            </div>
          ) : (
            <div className="badge badge-ghost">
              {club.isPublic ? 'Click to join' : 'Click to request'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClubsScreen;
