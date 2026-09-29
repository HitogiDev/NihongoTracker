import { House, Plus, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';

function MobileBottomNav() {
  const { t } = useTranslation('nav');
  const user = useUserDataStore((state) => state.user);
  const { pathname } = useLocation();

  if (!user) return null;

  const profilePath = `/user/${user.username}`;
  const destinations = [
    {
      to: '/',
      label: t('mobileNavigation.home'),
      icon: House,
      active: pathname === '/',
    },
    {
      to: '/log',
      label: t('mobileNavigation.log'),
      icon: Plus,
      active: pathname === '/log' || pathname === '/matchmedia',
    },
    {
      to: profilePath,
      label: t('mobileNavigation.profile'),
      icon: UserRound,
      active: pathname === profilePath || pathname.startsWith(`${profilePath}/`),
    },
  ];

  return (
    <nav
      className="mobile-bottom-dock dock dock-md md:hidden"
      aria-label={t('a11y.primaryNavigation')}
    >
      {destinations.map(({ to, label, icon: Icon, active }) => (
        <Link
          key={to}
          to={to}
          className={active ? 'dock-active text-primary' : ''}
          aria-current={active ? 'page' : undefined}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span className="dock-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default MobileBottomNav;
