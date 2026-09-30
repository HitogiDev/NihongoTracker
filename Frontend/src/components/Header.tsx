import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  LogOut,
  User,
  Settings,
  BarChart,
  ChartLine,
  Users,
  Calculator,
  List,
  ShieldUser,
  House,
  Star,
  Menu,
  X,
  Heart,
  FileText,
  Search,
  Sun,
  Moon,
  SunMoon,
  Bell,
  Layers,
  Send,
} from 'lucide-react';

import LanguageSwitcher, { LanguageMenuItem } from './LanguageSwitcher';
import { useUserDataStore } from '../store/userData';
import { useMutation } from '@tanstack/react-query';
import { logoutUserFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { logoutResponseType } from '../types';
import Loader from './Loader';
import SearchModal from './SearchModal';
import NotificationBell from './NotificationBell';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { hasAvatarFrame } from '../utils/customization';
import UserAvatar from './UserAvatar';
import { applyAppTheme } from '../utils/appTheme';
import { useTranslation } from 'react-i18next';
import { useHideRankingFeatures } from '../hooks/useRankingVisibility';

type ThemeMode = 'dark' | 'light' | 'system' | 'custom';

const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'system'];

const normalizeThemeMode = (theme: string | null | undefined): ThemeMode => {
  if (
    theme === 'dark' ||
    theme === 'light' ||
    theme === 'system' ||
    theme === 'custom'
  ) {
    return theme;
  }

  return 'system';
};

const resolveThemeForDocument = (theme: ThemeMode) => {
  const selectedTheme = theme || 'system';

  if (selectedTheme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return true;
  }

  return selectedTheme !== 'light';
};

function Header() {
  const { t } = useTranslation(['nav', 'common']);
  const { user, logout } = useUserDataStore();
  const hideRankingFeatures = useHideRankingFeatures();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigationDialogRef = useRef<HTMLDialogElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return normalizeThemeMode(localStorage.getItem('theme'));
    }

    return 'system';
  });

  const equippedFrame = user?.customization?.avatarFrame;
  const hasEquippedFrame = hasAvatarFrame(equippedFrame);

  const MAX_BADGE_COUNT = 99;
  const totalCount = useNotificationCount();
  const formatBadgeCount = (count: number): string => {
    if (count > MAX_BADGE_COUNT) {
      return `${MAX_BADGE_COUNT}+`;
    }

    return `${count}`;
  };

  const isAdmin = Array.isArray(user?.roles)
    ? (user?.roles as string[]).includes('admin')
    : user?.roles === 'admin';
  const { mutate, isPending } = useMutation({
    mutationFn: logoutUserFn,
    onSuccess: (data: logoutResponseType) => {
      logout();
      useUserDataStore.persist.clearStorage();
      toast.success(data.message);
      navigate('/');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : t('common:errors.generic'));
      }
    },
  });

  function logoutHandler(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    navigationDialogRef.current?.close();
    mutate();
  }

  useEffect(() => {
    navigationDialogRef.current?.close();
  }, [pathname]);

  function closeNavigationOnLinkClick(e: React.MouseEvent<HTMLUListElement>) {
    if ((e.target as HTMLElement).closest('a')) {
      navigationDialogRef.current?.close();
    }
  }

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onThemeChange = (e: CustomEvent) => {
      setThemeMode(normalizeThemeMode(e.detail as string | null | undefined));
    };
    window.addEventListener('themeChange', onThemeChange as EventListener);
    return () =>
      window.removeEventListener('themeChange', onThemeChange as EventListener);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const onSystemThemeChange = () => {
      if (themeMode === 'system') {
        document.documentElement.setAttribute(
          'data-theme',
          resolveThemeForDocument('system') ? 'dark' : 'light',
        );
      }
    };

    mediaQuery.addEventListener('change', onSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', onSystemThemeChange);
    };
  }, [themeMode]);

  function toggleTheme() {
    const currentIndex = THEME_CYCLE.indexOf(themeMode);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    setThemeMode(nextTheme);
    applyAppTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    window.dispatchEvent(new CustomEvent('themeChange', { detail: nextTheme }));
  }

  const themeIcon =
    themeMode === 'system' ? (
      <SunMoon className="w-5 h-5" />
    ) : themeMode === 'dark' ? (
      <Moon className="w-5 h-5" />
    ) : (
      <Sun className="w-5 h-5" />
    );
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative">
      <div className="site-navbar navbar transition duration-200 bg-neutral/85 hover:bg-neutral/100 text-neutral-content absolute w-full z-40 max-h-32">
        <div className="navbar-start flex-1 w-auto">
          <>
            <button
              type="button"
              aria-label={t('a11y.primaryNavigation')}
              aria-haspopup="dialog"
              onClick={() => navigationDialogRef.current?.showModal()}
              className={`btn btn-ghost ${
                user ? 'min-[1450px]:hidden' : 'xl:hidden'
              }`}
            >
              <Menu className="h-6 w-6" />
            </button>
            <dialog
              ref={navigationDialogRef}
              className="modal modal-start p-0"
              aria-labelledby="site-navigation-title"
            >
              <div className="modal-box flex h-dvh max-h-dvh w-[min(22rem,90vw)] max-w-none flex-col rounded-box bg-base-100 p-0 text-base-content shadow-lg">
                <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
                  <h2 id="site-navigation-title" className="text-lg font-semibold">
                    {t('sections.navigation')}
                  </h2>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square"
                    aria-label={t('common:close')}
                    onClick={() => navigationDialogRef.current?.close()}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
            {user ? (
              <ul
                className="menu min-h-0 w-full flex-1 overflow-y-auto p-4"
                onClick={closeNavigationOnLinkClick}
              >
                {isAdmin && (
                  <>
                    <li>
                      <Link
                        to="/admin"
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <ShieldUser className="w-4 h-4" />
                        {t('links.admin')}
                      </Link>
                    </li>
                    <li>
                      <div className="divider my-1"></div>
                    </li>
                  </>
                )}

                {/* Main Navigation */}
                <li className="menu-title px-2">
                  <span className="text-xs font-bold text-base-content/70">
                    {t('sections.navigation')}
                  </span>
                </li>
                <li>
                  <Link
                    to="/recommendations"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    {t('links.recommendations')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/stats`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <ChartLine className="w-4 h-4" />
                    {t('links.stats')}
                  </Link>
                </li>
                {!hideRankingFeatures && (
                  <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <BarChart className="w-4 h-4" />
                    {t('links.ranking')}
                  </Link>
                  </li>
                )}
                <li>
                  <Link
                    to="/clubs"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    {t('links.clubs')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/lists"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Layers className="w-4 h-4" />
                    {t('links.lists')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/calculator"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Calculator className="w-4 h-4" />
                    {t('links.calculator')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/list`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <List className="w-4 h-4" />
                    {t('links.immersionList')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/texthooker"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" />
                    {t('links.texthooker')}
                  </Link>
                </li>

                {/* Account Section */}
                <li>
                  <div className="divider my-1"></div>
                </li>
                <li className="menu-title px-2">
                  <span className="text-xs font-bold text-base-content/70">
                    {t('sections.account')}
                  </span>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <User className="w-4 h-4" />
                    {t('links.profile')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Settings className="w-4 h-4" />
                    {t('links.settings')}
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={logoutHandler}
                    className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                  >
                    <LogOut className="text-lg w-4 h-4" />
                    {t('links.logout')}
                  </button>
                </li>
              </ul>
            ) : (
              <ul
                className="menu min-h-0 w-full flex-1 overflow-y-auto p-4"
                onClick={closeNavigationOnLinkClick}
              >
                <li>
                  <Link
                    to="/"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <House className="text-lg" />
                    {t('links.home')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Star className="text-lg" />
                    {t('links.features')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <BarChart className="w-4 h-4" />
                    {t('links.ranking')}
                  </Link>
                </li>
                <LanguageMenuItem />
              </ul>
            )}
              </div>
              <form method="dialog" className="modal-backdrop">
                <button aria-label={t('common:close')}>
                  {t('common:close')}
                </button>
              </form>
            </dialog>
          </>
          <Link className="btn btn-ghost text-xl hidden sm:flex" to="/">
            NihongoTracker
          </Link>
          <Link className="btn btn-ghost text-base sm:hidden" to="/">
            NT
          </Link>
        </div>
        {user ? (
          <div className="hidden xl:inline-flex flex-none justify-center">
            {/* <QuickLog /> */}
            <ul className="inline-flex flex-row gap-1 min-[1450px]:gap-3 min-[1600px]:gap-6">
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to={`/user/${user.username}/stats`}
                >
                  {t('links.stats')}
                </Link>
              </li>
              {!hideRankingFeatures && (
                <li className="hidden min-[1450px]:block">
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/ranking"
                >
                  {t('links.ranking')}
                </Link>
                </li>
              )}
              <li className="hidden min-[1450px]:block">
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/clubs"
                >
                  {t('links.clubs')}
                </Link>
              </li>
              <li className="hidden min-[1450px]:block">
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/lists"
                >
                  {t('links.lists')}
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/calculator"
                >
                  {t('links.calculator')}
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to={`/user/${user.username}/list`}
                >
                  {t('links.immersionList')}
                </Link>
              </li>
              <li className="hidden min-[1450px]:block">
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/texthooker"
                >
                  {t('links.texthooker')}
                </Link>
              </li>
            </ul>
          </div>
        ) : (
          <div className="navbar-center hidden xl:flex flex-none justify-center">
            <ul className="inline-flex flex-row gap-6">
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/"
                >
                  {t('links.home')}
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/features"
                >
                  {t('links.features')}
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/ranking"
                >
                  {t('links.ranking')}
                </Link>
              </li>
            </ul>
          </div>
        )}

        <div className="navbar-end flex-1 w-auto gap-1 sm:gap-3 mx-1 sm:mx-3">
          {/* Search Button */}
          <button
            className="btn btn-ghost btn-sm sm:btn-md gap-2"
            onClick={() => setIsSearchOpen(true)}
            aria-label={t('a11y.search')}
          >
            <Search className="w-4 h-4" />
            <span className="hidden min-[1750px]:inline text-xs text-base-content/50">
              <kbd className="kbd kbd-xs">
                {/Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
                  ? '⌘'
                  : 'Ctrl'}
              </kbd>{' '}
              <kbd className="kbd kbd-xs">K</kbd>
            </span>
          </button>

          {user && (
            <>
              <Link
                to="/notifications"
                className="btn btn-ghost btn-sm sm:btn-md btn-circle md:hidden relative"
                aria-label={t('a11y.notifications')}
              >
                <Bell className="w-4 h-4" />
                {totalCount > 0 && (
                  <span className="badge badge-primary absolute -top-1 -right-1">
                    {formatBadgeCount(totalCount)}
                  </span>
                )}
              </Link>

              {/* Desktop */}
              <div className="hidden md:block">
                <NotificationBell />
              </div>
            </>
          )}

          {user ? (
            <>
              <Link
                className="btn btn-primary btn-sm sm:btn-md hidden md:inline-flex"
                to="/log"
              >
                <span className="hidden sm:inline">
                  {t('actions.createLog')}
                </span>
                <span className="inline sm:hidden">
                  {t('actions.createLogShort')}
                </span>
              </Link>
              <div className="dropdown dropdown-hover dropdown-bottom dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  aria-label={t('a11y.userMenu', { username: user.username })}
                  // Not btn-circle: that pins the button to the same 40px as the
                  // avatar, so the ring would spill outside it. p-1 leaves room.
                  className="btn btn-ghost avatar m-1 h-auto min-h-0 w-auto rounded-full p-1"
                >
                  {/* Shared UserAvatar structure: no empty wrapper when there is
                      no frame, so the daisyUI .avatar overflow-clip can't cut the
                      supporter ring's box-shadow, and the image is round on its
                      own. An equipped frame replaces the ring. */}
                  <UserAvatar
                    username={user.username}
                    avatar={user.avatar}
                    frame={equippedFrame}
                    containerClassName={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${
                      user?.patreon?.isActive && !hasEquippedFrame
                        ? 'ring-2 ring-primary ring-offset-neutral ring-offset-1'
                        : ''
                    }`}
                  />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[50] menu p-2 surface-raised text-base-content w-52"
                >
                  {isAdmin && (
                    <li>
                      <Link
                        to="/admin"
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <ShieldUser className="w-4 h-4" />
                        {t('links.admin')}
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      to={`/user/${user.username}`}
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <User className="w-4 h-4" />
                      {t('links.profile')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/settings`}
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <Settings className="w-4 h-4" />
                      {t('links.settings')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/support"
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <Heart className="w-4 h-4" />
                      {t('links.donate')}
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={logoutHandler}
                      className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('links.logout')}
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <button
                className="btn btn-ghost btn-sm sm:btn-md btn-circle"
                onClick={toggleTheme}
                aria-label={t('a11y.themeToggle', {
                  mode: t(`themeModes.${themeMode}`),
                })}
              >
                {themeIcon}
              </button>
              <Link
                className="btn btn-primary btn-ghost btn-sm sm:btn-md"
                to="/login"
              >
                {t('links.login')}
              </Link>
              <Link className="btn btn-primary btn-sm sm:btn-md" to="/register">
                {t('links.signUp')}
              </Link>
            </>
          )}
        </div>
      </div>
      {isPending && <Loader />}

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}

export default Header;
