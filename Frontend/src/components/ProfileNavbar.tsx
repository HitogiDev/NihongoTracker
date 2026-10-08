import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserDataStore } from '../store/userData';
import { useState } from 'react';
import { Ellipsis, Settings } from 'lucide-react';
import { isMobileApp } from '../utils/nativeRuntime';
import Button from './ui/Button';
import Modal from './ui/Modal';

function ProfileNavbar({
  username,
  canViewStatistics = true,
  canViewImmersionActivity = true,
}: {
  username: string | undefined;
  canViewStatistics?: boolean;
  canViewImmersionActivity?: boolean;
}) {
  const { t } = useTranslation('profile');
  const { t: nt } = useTranslation('nav');
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const loggedUser = useUserDataStore((state) => state.user);
  const isAdmin = loggedUser?.roles?.includes('admin');
  const viewedUsername = username?.toLowerCase();
  const loggedUsername = loggedUser?.username?.toLowerCase();
  const isOwnProfile =
    Boolean(viewedUsername) &&
    Boolean(loggedUsername) &&
    viewedUsername === loggedUsername;
  const showModerationTab = Boolean(isAdmin && !isOwnProfile);

  const isActive = (path: string) => {
    if (path === `/user/${username}/`) {
      // For overview, match exact path or path ending with username
      return (
        location.pathname === path || location.pathname === `/user/${username}`
      );
    }
    return location.pathname === path;
  };
  const tabClass = (path: string) =>
    isActive(path)
      ? 'active bg-primary text-primary-content flex min-h-11 items-center justify-center whitespace-nowrap'
      : 'flex min-h-11 items-center justify-center whitespace-nowrap';

  if (isMobileApp()) return <>
    <nav className="flex items-center bg-base-100 px-2" aria-label={nt('native.profile')}>
      <div className="tabs tabs-border min-w-0 flex-1 flex-nowrap">
        {(['overview', 'activity', ...(canViewStatistics ? ['stats'] : [])] as const).map((tab) => {
          const path = `/user/${username}/${tab === 'overview' ? '' : tab}`;
          return <Link key={tab} to={path} className={isActive(path) ? 'tab tab-active flex-1 px-2' : 'tab flex-1 px-2'}>{t(`tabs.${tab}` as 'tabs.overview')}</Link>;
        })}
      </div>
      <Button appearance="ghost" shape="square" aria-label={nt('native.more')} onClick={() => setMoreOpen(true)}><Ellipsis className="h-5 w-5" /></Button>
    </nav>
    <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={nt('native.more')}>
      <nav className="flex flex-col gap-2">
        {(['list', 'lists', 'goals', 'achievements', ...(showModerationTab ? ['moderation'] : [])] as const).filter((tab) => tab !== 'list' || canViewImmersionActivity).map((tab) => <Link key={tab} to={`/user/${username}/${tab}`} className="btn btn-ghost justify-start" onClick={() => setMoreOpen(false)}>{t(tab === 'list' ? 'tabs.immersionList' : `tabs.${tab}` as 'tabs.lists')}</Link>)}
        {isOwnProfile && <Link to="/settings" className="btn btn-ghost justify-start" onClick={() => setMoreOpen(false)}><Settings className="h-5 w-5" />{nt('titles.settings')}</Link>}
      </nav>
    </Modal>
  </>;
  return (
    <div className="navbar min-h-12 w-full min-w-0 overflow-x-auto bg-base-100">
      <div className="mx-auto min-w-max md:min-w-0">
        <ul className="menu menu-horizontal flex-nowrap gap-2 px-2 md:gap-5">
          <li>
            <Link
              to={`/user/${username}/`}
              className={tabClass(`/user/${username}/`)}
            >
              {t('tabs.overview')}
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/activity`}
              className={tabClass(`/user/${username}/activity`)}
            >
              {t('tabs.activity')}
            </Link>
          </li>
          {canViewStatistics && (
            <li>
              <Link
                to={`/user/${username}/stats`}
                className={tabClass(`/user/${username}/stats`)}
              >
                {t('tabs.stats')}
              </Link>
            </li>
          )}
          {canViewImmersionActivity && (
            <li>
              <Link
                to={`/user/${username}/list`}
                className={tabClass(`/user/${username}/list`)}
              >
                {t('tabs.immersionList')}
              </Link>
            </li>
          )}
          <li>
            <Link
              to={`/user/${username}/lists`}
              className={tabClass(`/user/${username}/lists`)}
            >
              {t('tabs.lists')}
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/goals`}
              className={tabClass(`/user/${username}/goals`)}
            >
              {t('tabs.goals')}
            </Link>
          </li>
          <li>
            <Link
              to={`/user/${username}/achievements`}
              className={tabClass(`/user/${username}/achievements`)}
            >
              {t('tabs.achievements')}
            </Link>
          </li>
          {showModerationTab && (
            <li>
              <Link
                to={`/user/${username}/moderation`}
                className={tabClass(`/user/${username}/moderation`)}
              >
                {t('tabs.moderation')}
              </Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default ProfileNavbar;
