import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  PlayCircle,
  Percent,
  Send,
  Star,
  Timer,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  compareUserStatsFn,
  getConnectionsFn,
  IComparisonResult,
  searchUsersFn,
} from '../api/trackerApi';
import {
  getMediaCommunityFn,
  recommendMediaFn,
  MediaCommunityRelation,
} from '../api/mediaSocialApi';
import {
  IMediaCommunityPerson,
  OutletMediaContextType,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { getApiErrorMessage } from '../utils/apiError';
import { numberWithCommas } from '../utils/utils';
import ActivityCard from '../components/social/ActivityCard';
import UserAvatar from '../components/UserAvatar';
import Modal from '../components/ui/Modal';
import Field from '../components/ui/Field';
import Spinner from '../components/ui/Spinner';
import { BTN } from '../components/ui/buttons';
import { useDebounce } from '../hooks/useDebounce';

function PeopleProgressList({
  title,
  people,
  mediaType,
  empty,
}: {
  title: string;
  people: IMediaCommunityPerson[];
  mediaType?: string;
  empty: string;
}) {
  const { t } = useTranslation('media');

  const getProgressText = (person: IMediaCommunityPerson) => {
    const progress = person.progress;
    const parts: string[] = [];

    if (mediaType === 'manga' || mediaType === 'light-novel') {
      if (progress.volume !== null) {
        parts.push(t('social.volumeProgress', { volume: progress.volume }));
      }
      if (progress.chars > 0) {
        parts.push(
          t('social.charactersProgress', {
            count: numberWithCommas(progress.chars),
          })
        );
      }
    } else if (mediaType === 'anime' || mediaType === 'tv show') {
      if (progress.episodes > 0) {
        parts.push(
          t('social.episodesProgress', {
            count: numberWithCommas(progress.episodes),
          })
        );
      }
    } else if (
      ['vn', 'game', 'reading', 'book'].includes(mediaType ?? '') &&
      progress.chars > 0
    ) {
      parts.push(
        t('social.charactersProgress', {
          count: numberWithCommas(progress.chars),
        })
      );
    }

    if (progress.chars === 0 && progress.pages > 0) {
      parts.push(
        t('social.pagesProgress', {
          count: numberWithCommas(progress.pages),
        })
      );
    }
    if (parts.length === 0 && progress.time > 0) {
      parts.push(
        t('social.timeProgress', {
          count: numberWithCommas(progress.time),
        })
      );
    }

    return parts.join(' · ') || t('social.noProgressRecorded');
  };

  const getStatus = (status?: string | null) => {
    if (!status) return null;
    const labels: Record<string, string> = {
      completed: t('list.status.completed'),
      in_progress: t('list.status.inProgress'),
      paused: t('list.status.paused'),
      planning: t('list.status.planning'),
      dropped: t('list.status.dropped'),
    };
    return labels[status] ?? status;
  };

  return (
    <section className="card card-sm surface-muted">
      <div className="card-body">
        <h3 className="card-title text-base">
          <Users className="h-5 w-5 text-primary" />
          {title}
          <span className="badge badge-neutral badge-sm">{people.length}</span>
        </h3>
        {people.length > 0 ? (
          <ul className="list">
            {people.map((person) => (
              <li key={person.user._id} className="list-row px-0">
                <UserAvatar
                  username={person.user.username}
                  avatar={person.user.avatar}
                  containerClassName="h-10 w-10 overflow-hidden rounded-full"
                  imageClassName="h-full w-full object-cover"
                  fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                  textClassName="text-sm font-semibold"
                />
                <div className="list-col-grow min-w-0">
                  <Link
                    to={`/user/${encodeURIComponent(person.user.username)}`}
                    className="link link-hover truncate font-medium"
                  >
                    {person.user.username}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                    <span>{getProgressText(person)}</span>
                    {getStatus(person.status) && (
                      <span
                        className={
                          person.status === 'completed'
                            ? 'badge badge-success badge-xs'
                            : person.status === 'in_progress'
                              ? 'badge badge-primary badge-xs'
                              : 'badge badge-ghost badge-xs'
                        }
                      >
                        {getStatus(person.status)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-sm text-base-content/60">{empty}</p>
        )}
      </div>
    </section>
  );
}

export default function MediaSocial() {
  const { t } = useTranslation(['media', 'common']);
  const { mediaDocument, mediaType } = useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState('');
  const [message, setMessage] = useState('');
  const [compareUsername, setCompareUsername] = useState('');
  const [compareDropdownOpen, setCompareDropdownOpen] = useState(false);
  const [comparison, setComparison] = useState<IComparisonResult | null>(null);
  const [relation, setRelation] = useState<MediaCommunityRelation>('following');
  const recipientDropdownRef = useRef<HTMLDetailsElement>(null);
  const compareDropdownRef = useRef<HTMLDivElement>(null);
  const mediaId = mediaDocument?.contentId;
  const type = mediaDocument?.type ?? mediaType;
  const title =
    mediaDocument?.title.contentTitleEnglish ||
    mediaDocument?.title.contentTitleRomaji ||
    mediaDocument?.title.contentTitleNative ||
    '';
  const communityQuery = useQuery({
    queryKey: ['mediaCommunity', type, mediaId, relation],
    queryFn: () =>
      getMediaCommunityFn(type!, mediaId!, currentUser ? relation : undefined),
    enabled: Boolean(type && mediaId),
    staleTime: 60_000,
  });
  const connectionsQuery = useQuery({
    queryKey: ['connections', currentUser?.username, 'followers', 1],
    queryFn: () => getConnectionsFn(currentUser!.username, 'followers', 1, 50),
    enabled: Boolean(currentUser),
  });
  const selectedRecipient = connectionsQuery.data?.users.find(
    (user) => user.username === recipientUsername
  );
  const debouncedCompareUsername = useDebounce(compareUsername, 250);
  const compareUsersQuery = useQuery({
    queryKey: ['compare-users', debouncedCompareUsername],
    queryFn: () => searchUsersFn(debouncedCompareUsername.trim()),
    enabled: debouncedCompareUsername.trim().length >= 2,
    staleTime: 30_000,
  });
  const compareUsers = (compareUsersQuery.data ?? []).filter(
    (user) =>
      user.username.toLowerCase() !== currentUser?.username.toLowerCase()
  );

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const dropdown = recipientDropdownRef.current;
      if (dropdown && !dropdown.contains(event.target as Node)) {
        dropdown.removeAttribute('open');
      }
      const compareDropdown = compareDropdownRef.current;
      if (compareDropdown && !compareDropdown.contains(event.target as Node)) {
        setCompareDropdownOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, []);
  const recommendMutation = useMutation({
    mutationFn: () =>
      recommendMediaFn({
        recipientUsername,
        mediaId: mediaId!,
        mediaType: mediaDocument!.type,
        message,
      }),
    onSuccess: () => {
      toast.success(t('media:recommendations.sentSuccess'));
      setRecommendOpen(false);
      setRecipientUsername('');
      setMessage('');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const compareMutation = useMutation({
    mutationFn: () =>
      compareUserStatsFn(
        currentUser!.username,
        compareUsername.trim(),
        mediaId!,
        type!
      ),
    onSuccess: setComparison,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const community = communityQuery.data;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {t('media:social.title', { title })}
          </h1>
          <p className="text-sm text-base-content/60">{t('media:social.subtitle')}</p>
        </div>
        {currentUser && mediaDocument && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/recommendations"
              className="btn btn-ghost btn-sm btn-square"
              title={t('media:recommendations.inbox')}
              aria-label={t('media:recommendations.inbox')}
            >
              <Inbox className="h-4 w-4" />
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setRecommendOpen(true)}
            >
              <Send className="h-4 w-4" />
              {t('media:recommendations.recommend')}
            </button>
          </div>
        )}
      </div>

      {communityQuery.isError && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{t('media:social.loadFailed')}</span>
          <button className="btn btn-sm" onClick={() => communityQuery.refetch()}>
            {t('media:social.retry')}
          </button>
        </div>
      )}

      {communityQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-28 w-full" />
          ))}
        </div>
      ) : community ? (
        <>
          <section className="card surface mb-6">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <BarChart3 className="h-5 w-5" />
                {t('media:social.communityStats')}
              </h2>
              <div className="stats stats-vertical mt-2 w-full shadow-sm sm:stats-horizontal">
                <div className="stat">
                  <Users className="stat-figure h-5 w-5 text-primary" />
                  <div className="stat-title">{t('media:social.trackingUsers')}</div>
                  <div className="stat-value text-primary">
                    {numberWithCommas(community.stats.trackingUsers)}
                  </div>
                </div>
                <div className="stat">
                  <CheckCircle2 className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.completedUsers')}</div>
                  <div className="stat-value">
                    {numberWithCommas(community.stats.completedUsers)}
                  </div>
                </div>
                <div className="stat">
                  <PlayCircle className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.inProgressUsers')}</div>
                  <div className="stat-value">
                    {numberWithCommas(community.stats.inProgressUsers)}
                  </div>
                </div>
                <div className="stat">
                  <Percent className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.completionRate')}</div>
                  <div className="stat-value">
                    {community.stats.completionRate !== null
                      ? `${community.stats.completionRate}%`
                      : t('media:social.notAvailable')}
                  </div>
                </div>
                <div className="stat">
                  <Star className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.averageRating')}</div>
                  <div className="stat-value">
                    {community.stats.averageRating ?? t('media:social.notAvailable')}
                  </div>
                  <div className="stat-desc">
                    {t('media:social.reviewCount', { count: community.stats.reviewCount })}
                  </div>
                </div>
                <div className="stat">
                  <Timer className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.averageCompletion')}</div>
                  <div className="stat-value">
                    {community.stats.completionDaysAverage ??
                      t('media:social.notAvailable')}
                  </div>
                  {community.stats.completionDaysAverage !== null && (
                    <div className="stat-desc">{t('media:social.days')}</div>
                  )}
                </div>
                <div className="stat">
                  <Clock3 className="stat-figure h-5 w-5" />
                  <div className="stat-title">{t('media:social.medianCompletion')}</div>
                  <div className="stat-value">
                    {community.stats.completionDaysMedian ?? t('media:social.notAvailable')}
                  </div>
                  {community.stats.completionDaysMedian !== null && (
                    <div className="stat-desc">{t('media:social.days')}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="card surface mb-6">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <Users className="h-5 w-5" />
                {t('media:social.peopleProgress')}
              </h2>
              {currentUser ? (
                <div
                  role="tablist"
                  aria-label={t('media:social.peopleFilters')}
                  className="join w-fit max-w-full overflow-x-auto"
                >
                  {(
                    [
                      ['following', t('media:social.following')],
                      ['friends', t('media:social.friends')],
                      ['followers', t('media:social.followers')],
                    ] as Array<[MediaCommunityRelation, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={relation === value}
                      className={
                        relation === value ? BTN.segmentActive : BTN.segment
                      }
                      onClick={() => setRelation(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/60">
                  {t('media:social.signInForPeopleProgress')}
                </p>
              )}
              {currentUser && (
                <PeopleProgressList
                  title={t('media:social.peopleInFilter', {
                    filter: t(`media:social.${relation}`),
                  })}
                  people={community.people ?? []}
                  mediaType={type}
                  empty={t('media:social.noPeopleForFilter')}
                />
              )}
            </div>
          </section>

          {currentUser && (
            <section className="card surface mb-6">
              <div className="card-body">
                <h2 className="card-title text-lg">{t('media:social.compare')}</h2>
                <div className="join w-full max-w-xl">
                  <div
                    ref={compareDropdownRef}
                    className={`dropdown dropdown-bottom join-item min-w-0 flex-1 ${
                      compareDropdownOpen ? 'dropdown-open' : ''
                    }`}
                  >
                    <input
                      className="input input-md w-full focus:input-primary"
                      value={compareUsername}
                      placeholder={t('media:social.usernamePlaceholder')}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={compareDropdownOpen}
                      onFocus={() =>
                        setCompareDropdownOpen(compareUsername.trim().length >= 2)
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setCompareUsername(value);
                        setCompareDropdownOpen(value.trim().length >= 2);
                      }}
                    />
                    {compareDropdownOpen &&
                      debouncedCompareUsername.trim().length >= 2 && (
                        <ul className="dropdown-content menu surface-raised z-50 mt-2 max-h-72 w-full min-w-64 flex-nowrap overflow-y-auto p-2 shadow-lg">
                          {compareUsersQuery.isLoading ? (
                            <li>
                              <span className="text-sm text-base-content/60">
                                {t('media:social.searchingUsers')}
                              </span>
                            </li>
                          ) : compareUsers.length > 0 ? (
                            compareUsers.map((user) => (
                              <li key={user._id}>
                                <button
                                  type="button"
                                  className="flex items-center gap-3 text-left"
                                  onClick={() => {
                                    setCompareUsername(user.username);
                                    setCompareDropdownOpen(false);
                                  }}
                                >
                                  <UserAvatar
                                    username={user.username}
                                    avatar={user.avatar}
                                    containerClassName="h-9 w-9 shrink-0 rounded-full"
                                    imageClassName="h-full w-full rounded-full object-cover"
                                    fallbackClassName="flex h-full w-full items-center justify-center rounded-full bg-base-300"
                                    textClassName="text-xs font-semibold"
                                  />
                                  <span className="truncate">{user.username}</span>
                                </button>
                              </li>
                            ))
                          ) : (
                            <li>
                              <span className="text-sm text-base-content/60">
                                {t('media:social.noUsersFound')}
                              </span>
                            </li>
                          )}
                        </ul>
                      )}
                  </div>
                  <button
                    className="join-item btn btn-primary"
                    disabled={
                      compareMutation.isPending ||
                      !compareUsername.trim() ||
                      compareUsername.trim().toLowerCase() ===
                        currentUser.username.toLowerCase()
                    }
                    onClick={() => compareMutation.mutate()}
                  >
                    {compareMutation.isPending ? <Spinner size="sm" /> : t('media:social.compareAction')}
                  </button>
                </div>
                {comparison && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[comparison.user1, comparison.user2].map((comparedUser, index) => (
                      <div key={comparedUser.username} className="surface-muted p-4">
                        <h3 className="text-base font-semibold text-base-content">
                          {comparedUser.username}
                          {index === 0 && (
                            <span className="ml-2 text-xs font-normal text-base-content/60">
                              {t('media:social.you')}
                            </span>
                          )}
                        </h3>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-base-content/60">{t('media:stats.totalXp')}</div>
                            <div className="text-2xl font-bold text-primary">
                              {numberWithCommas(comparedUser.stats.totalXp)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-base-content/60">{t('media:stats.timeLabel')}</div>
                            <div className="text-2xl font-bold text-secondary">
                              {numberWithCommas(comparedUser.stats.totalTime)}
                            </div>
                            <div className="text-xs text-base-content/60">
                              {t('media:social.minutes', { count: comparedUser.stats.totalTime })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="card surface">
            <div className="card-body">
              <h2 className="card-title text-lg">
                <MessageSquareText className="h-5 w-5" />
                {t('media:social.communityActivity')}
              </h2>
              {community.activities.length > 0 ? (
                <div className="mt-2 space-y-3">
                  {community.activities.map((activity) => (
                    <ActivityCard key={activity._id} activity={activity} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-base-content/60">
                  {t('media:social.noRecentActivity')}
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}

      <Modal
        open={recommendOpen}
        onClose={() => setRecommendOpen(false)}
        title={t('media:recommendations.modalTitle', { title })}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setRecommendOpen(false)}>
              {t('common:cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={!recipientUsername || recommendMutation.isPending}
              onClick={() => recommendMutation.mutate()}
            >
              {recommendMutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
              {t('media:recommendations.send')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('media:recommendations.recipient')} required>
            {(id) => (
              <details ref={recipientDropdownRef} className="dropdown w-full">
                <summary
                  id={id}
                  className="select flex w-full cursor-pointer items-center gap-3 focus:select-primary"
                >
                  {selectedRecipient ? (
                    <>
                      <UserAvatar
                        username={selectedRecipient.username}
                        avatar={selectedRecipient.avatar}
                        containerClassName="h-7 w-7 shrink-0 overflow-hidden rounded-full"
                        imageClassName="h-full w-full object-cover"
                        fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                        textClassName="text-xs font-semibold"
                      />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {selectedRecipient.username}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-base-content/60">
                      {t('media:recommendations.chooseRecipient')}
                    </span>
                  )}
                </summary>
                <ul className="menu dropdown-content z-20 mt-1 max-h-64 w-full flex-nowrap overflow-y-auto rounded-box bg-base-100 p-2 shadow-lg">
                  {connectionsQuery.data?.users.map((user) => (
                    <li key={user._id}>
                      <button
                        type="button"
                        className={user.username === recipientUsername ? 'menu-active' : undefined}
                        onClick={(event) => {
                          setRecipientUsername(user.username);
                          event.currentTarget.closest('details')?.removeAttribute('open');
                        }}
                      >
                        <UserAvatar
                          username={user.username}
                          avatar={user.avatar}
                          containerClassName="h-8 w-8 shrink-0 overflow-hidden rounded-full"
                          imageClassName="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                          textClassName="text-xs font-semibold"
                        />
                        <span className="truncate">{user.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Field>
          {connectionsQuery.data?.users.length === 0 && (
            <p className="text-sm text-base-content/60">
              {t('media:recommendations.noRecipients')}
            </p>
          )}
          <Field
            label={t('media:recommendations.message')}
            aside={`${message.length}/280`}
            hint={t('media:recommendations.messageHint')}
          >
            {(id) => (
              <textarea
                id={id}
                className="textarea w-full focus:textarea-primary"
                rows={3}
                maxLength={280}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>
    </main>
  );
}
