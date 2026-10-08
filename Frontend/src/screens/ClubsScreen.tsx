import OfflineImage from '../components/OfflineImage';
import DropdownSelect from '../components/ui/DropdownSelect';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Users,
  Earth,
  Lock,
  ListFilter,
  Funnel,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { getClubsFn } from '../api/clubApi';
import { IClubResponse } from '../types';
import { useUserDataStore } from '../store/userData';
import { useTranslation } from 'react-i18next';
import Field from '../components/ui/Field';
import LinkifiedText from '../components/ui/LinkifiedText';
import { isMobileApp } from '../utils/nativeRuntime';
import { useNativePageState } from '../native/useNativePageState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

function ClubsScreen() {
  const { t } = useTranslation('clubs');
  const { t: nt } = useTranslation('nav');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useUserDataStore();

  // Search and filter states
  const [searchInput, setSearchInput] = useNativePageState('clubs:searchInput', '');
  const [search, setSearch] = useNativePageState('clubs:search', '');
  const [sortBy, setSortBy] = useNativePageState('clubs:sort', 'memberCount');
  const [sortOrder, setSortOrder] = useNativePageState<'asc' | 'desc'>('clubs:order', 'desc');
  const [visibility, setVisibility] = useNativePageState<
    'all' | 'public' | 'private'
  >('clubs:visibility', 'all');
  const [membership, setMembership] = useNativePageState<
    'all' | 'member' | 'leader'
  >('clubs:membership', 'all');
  const [selectedTags, setSelectedTags] = useNativePageState<string[]>('clubs:tags', []);
  const [page, setPage] = useNativePageState('clubs:page', 1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === searchInput) return;
      setSearch(searchInput);
      setPage(1);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput, search, setSearch, setPage]);

  // Query clubs
  const {
    data: clubsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'clubs',
      search,
      sortBy,
      sortOrder,
      visibility,
      membership,
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
        isPublic: visibility === 'all' ? undefined : visibility === 'public',
        tags: selectedTags.join(','),
        membership,
      }),
    placeholderData: (previousData) => previousData,
  });

  // TODO: make them dynamic according to the club tags
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

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setVisibility('all');
    setMembership('all');
    setSelectedTags([]);
    setPage(1);
  };

  const hasActiveFilters =
    searchInput.trim() !== '' ||
    visibility !== 'all' ||
    membership !== 'all' ||
    selectedTags.length > 0;

  const sortOptions = [
    { value: 'memberCount', label: t('browse.sort.members') },
    { value: 'createdAt', label: t('browse.sort.newest') },
    { value: 'name', label: t('browse.sort.name') },
  ];

  if (isMobileApp()) return <section className="native-page space-y-4">
    <div className="flex items-center gap-2"><Field className="flex-1" label={t('browse.searchPlaceholder')}><input type="search" className="input focus:input-primary w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></Field><Button appearance="outline" shape="square" aria-label={nt('native.filters')} onClick={() => setFiltersOpen(true)}><Funnel className="h-5 w-5" /></Button></div>
    <div className="flex gap-2"><div className="join flex flex-1"><Button className="join-item flex-1" variant={membership === 'all' ? 'primary' : 'default'} appearance={membership === 'all' ? 'solid' : 'outline'} onClick={() => { setMembership('all'); setPage(1); }}>{nt('native.exploreClubs')}</Button><Button className="join-item flex-1" variant={membership !== 'all' ? 'primary' : 'default'} appearance={membership !== 'all' ? 'solid' : 'outline'} onClick={() => { setMembership('member'); setPage(1); }}>{nt('native.yourClubs')}</Button></div><Link to="/clubs/create" className="btn btn-outline btn-square" aria-label={t('browse.create')}><Plus className="h-5 w-5" /></Link></div>
    {isLoading && <div className="skeleton h-28" />}
    {error && <div className="alert flex flex-col items-start" role="alert"><p>{navigator.onLine ? nt('native.unavailable') : nt('native.offline')}</p><Button onClick={() => void refetch()}>{nt('native.retry')}</Button></div>}
    {!isLoading && !error && !clubsData?.clubs.length && <p className="surface p-6 text-center text-base-content/65">{t('browse.empty')}</p>}
    <div className="space-y-3">{clubsData?.clubs.map((club) => <ClubCard key={club._id} club={club} />)}</div>
    {(clubsData?.total ?? 0) > 12 && <div className="join flex justify-center"><Button className="join-item" disabled={page === 1} onClick={() => setPage(page - 1)}>{t('browse.previous')}</Button><span className="join-item btn" aria-live="polite">{page}</span><Button className="join-item" disabled={page * 12 >= (clubsData?.total ?? 0)} onClick={() => setPage(page + 1)}>{t('browse.next')}</Button></div>}
    <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title={nt('native.filters')} actions={<><Button appearance="ghost" onClick={resetFilters}>{nt('native.reset')}</Button><Button variant="primary" onClick={() => setFiltersOpen(false)}>{nt('native.apply')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('browse.sortBy')}><DropdownSelect className="select w-full" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>{sortOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</DropdownSelect></Field>
        <label className="flex min-h-12 items-center justify-between gap-3"><span>{t('browse.descending')}</span><input type="checkbox" className="toggle" checked={sortOrder === 'desc'} onChange={(e) => { setSortOrder(e.target.checked ? 'desc' : 'asc'); setPage(1); }} /></label>
        <Field label={t('browse.public')}><DropdownSelect className="select w-full" value={visibility} onChange={(e) => { const value = e.target.value; if (value === 'all' || value === 'public' || value === 'private') { setVisibility(value); setPage(1); } }}><option value="all">{nt('native.allTypes')}</option><option value="public">{t('browse.public')}</option><option value="private">{t('browse.private')}</option></DropdownSelect></Field>
        <Field label={nt('native.yourClubs')}><DropdownSelect className="select w-full" value={membership} onChange={(e) => { const value = e.target.value; if (value === 'all' || value === 'member' || value === 'leader') { setMembership(value); setPage(1); } }}><option value="all">{nt('native.exploreClubs')}</option><option value="member">{t('roles.member')}</option><option value="leader">{t('roles.leader')}</option></DropdownSelect></Field>
        <div className="flex flex-wrap gap-2">{availableTags.map((tag) => <Button key={tag} variant={selectedTags.includes(tag) ? 'primary' : 'default'} appearance={selectedTags.includes(tag) ? 'solid' : 'outline'} aria-pressed={selectedTags.includes(tag)} onClick={() => handleTagToggle(tag)}>{tag}</Button>)}</div>
      </div>
    </Modal>
  </section>;
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
            {t('browse.loadFailed')}
          </h2>
          <p className="text-base-content/70">{t('common.tryAgainLater')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Users className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-base-content">
              {t('browse.title')}
            </h1>
          </div>
          <p className="text-base-content/70">{t('browse.subtitle')}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-8 max-w-4xl mx-auto">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 text-xl" />
            <input
              type="text"
              placeholder={t('browse.searchPlaceholder')}
              className="input w-full pl-12 pr-4"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
            />
          </div>

          {user && (
            <button
              className="btn btn-primary gap-2 whitespace-nowrap"
              onClick={() => navigate('/clubs/create')}
            >
              <Plus className="text-lg" />
              {t('browse.create')}
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <div className="surface p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-base-content mb-3 flex items-center gap-2">
                  <ListFilter className="w-5 h-5" />
                  {t('browse.sortBy')}
                </h3>
                <div className="dropdown w-full">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-outline w-full justify-between"
                  >
                    <span>
                      {sortOptions.find((opt) => opt.value === sortBy)?.label ||
                        t('browse.sort.members')}
                    </span>
                    <ChevronDown className="text-lg" />
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu p-2 surface-raised w-full"
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
                    <span>{t('browse.descending')}</span>
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

              <div>
                <Field
                  label={
                    <>
                      <Funnel className="w-5 h-5" />
                      {t('browse.visibility')}
                    </>
                  }
                >
                  {(id) => (
                    <DropdownSelect
                      id={id}
                      className="select w-full"
                      value={visibility}
                      onChange={(e) => {
                        setVisibility(e.target.value as typeof visibility);
                        setPage(1);
                      }}
                    >
                      <option value="all">
                        {t('browse.visibilityOptions.all')}
                      </option>
                      <option value="public">
                        {t('browse.visibilityOptions.public')}
                      </option>
                      <option value="private">
                        {t('browse.visibilityOptions.private')}
                      </option>
                    </DropdownSelect>
                  )}
                </Field>
              </div>

              {user && (
                <div>
                  <Field label={t('browse.membership')}>
                    {(id) => (
                      <DropdownSelect
                        id={id}
                        className="select w-full"
                        value={membership}
                        onChange={(e) => {
                          setMembership(e.target.value as typeof membership);
                          setPage(1);
                        }}
                      >
                        <option value="all">
                          {t('browse.membershipOptions.all')}
                        </option>
                        <option value="member">
                          {t('browse.membershipOptions.member')}
                        </option>
                        <option value="leader">
                          {t('browse.membershipOptions.leader')}
                        </option>
                      </DropdownSelect>
                    )}
                  </Field>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-base-content mb-3">
                  {t('common.tags')}
                </h3>
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

              {hasActiveFilters && (
                <button
                  className="btn btn-ghost btn-sm w-full gap-2"
                  onClick={resetFilters}
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('browse.clearFilters')}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1">
            {clubsData?.clubs && clubsData.clubs.length > 0 ? (
              <>
                <div className="mb-6 text-base-content/70">
                  {t('browse.showing', {
                    shown: clubsData.clubs.length,
                    total: clubsData.total,
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {clubsData.clubs.map((club) => (
                    <ClubCard key={club._id} club={club} />
                  ))}
                </div>

                {clubsData.total > 12 && (
                  <div className="flex justify-center mt-8">
                    <div className="join">
                      <button
                        className="join-item btn btn-sm"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        {t('browse.previous')}
                      </button>
                      <button className="join-item btn btn-active btn-sm">
                        Page {page}
                      </button>
                      <button
                        className="join-item btn btn-sm"
                        disabled={page * 12 >= clubsData.total}
                        onClick={() => setPage(page + 1)}
                      >
                        {t('browse.next')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Users className="text-6xl text-base-content/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-base-content mb-2">
                  {t('browse.empty')}
                </h3>
                <p className="text-base-content/70 mb-6">
                  {search || selectedTags.length > 0
                    ? t('browse.emptyFiltered')
                    : t('browse.emptyFirst')}
                </p>
                {user && (
                  <button
                    className="btn btn-primary gap-2"
                    onClick={() => navigate('/clubs/create')}
                  >
                    <Plus className="text-lg" />
                    {t('browse.createFirst')}
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
  const { t } = useTranslation('clubs');
  const navigate = useNavigate();

  if (isMobileApp()) return <Link to={`/clubs/${club._id}`} className="surface flex min-h-28 items-center gap-3 p-3">
    {club.avatar || club.banner ? <OfflineImage src={club.avatar || club.banner} alt="" className="h-20 w-20 shrink-0 rounded-box object-cover" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-box bg-primary/10"><Users className="h-7 w-7 text-primary" /></div>}
    <div className="min-w-0 flex-1 space-y-1"><h2 className="truncate font-semibold">{club.name}</h2><p className="line-clamp-2 text-sm text-base-content/65">{club.description}</p><p className="text-xs text-base-content/60">{t('browse.memberCount', { current: club.memberCount, limit: club.memberLimit })}</p>
      {club.isUserMember && <span className={club.userStatus === 'pending' ? 'badge badge-warning badge-sm' : 'badge badge-primary badge-sm'}>{club.userStatus === 'pending' ? t('browse.pending') : t('roles.member')}</span>}
    </div>
  </Link>;
  return (
    <div
      className="card surface hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-primary/30"
      onClick={() => navigate(`/clubs/${club._id}`)}
    >
      <div className="relative h-32 overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/20 to-secondary/20">
        {club.banner && (
          <OfflineImage
            src={club.banner}
            alt={`${club.name} banner`}
            className="w-full h-full object-cover"
          />
        )}

        <div className="absolute top-3 right-3">
          <div
            className={`badge gap-1 ${club.isPublic ? 'badge-success' : 'badge-warning'}`}
          >
            {club.isPublic ? (
              <Earth className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {club.isPublic ? t('browse.public') : t('browse.private')}
          </div>
        </div>
      </div>

      <div className="card-body pt-6 pb-6">
        <div className="flex justify-center md:justify-start -mt-16 mb-4">
          <div className="avatar">
            <div className="w-20 h-20 rounded-full bg-base-100 p-1 shadow-lg">
              {club.avatar ? (
                <OfflineImage
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
        <div className="mb-3">
          <h3 className="card-title text-lg font-bold truncate">{club.name}</h3>
        </div>

        {club.description && (
          <p className="text-sm text-base-content/70 line-clamp-2 mb-3">
            <LinkifiedText text={club.description} />
          </p>
        )}

        <div className="flex items-center text-sm text-base-content/70 mb-4">
          <div className="flex items-center gap-1">
            <Users className="text-base w-4 h-4" />
            <span>
              {t('browse.memberCount', {
                current: club.memberCount,
                limit: club.memberLimit,
              })}
            </span>
          </div>
        </div>

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

        <div className="card-actions justify-end">
          {club.isUserMember && club.userStatus === 'active' ? (
            <div className="badge badge-primary gap-1">
              <Users className="w-4 h-4" />
              {club.userRole === 'owner'
                ? t('roles.owner')
                : club.userRole === 'leader'
                  ? t('roles.leader')
                  : club.userRole === 'moderator'
                    ? t('roles.moderator')
                    : t('roles.member')}
            </div>
          ) : club.isUserMember && club.userStatus === 'pending' ? (
            <div className="badge badge-warning gap-1">
              <Users className="text-xs" />
              {t('browse.pending')}
            </div>
          ) : (
            <div className="badge badge-ghost">
              {club.isPublic
                ? t('browse.clickToJoin')
                : t('browse.clickToRequest')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClubsScreen;
