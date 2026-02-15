import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
  Info,
  Star,
  Menu,
  Heart,
  FileText,
  Search,
} from 'lucide-react';

import { useUserDataStore } from '../store/userData';
import { useMutation } from '@tanstack/react-query';
import { logoutUserFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { logoutResponseType } from '../types';
import Loader from './Loader';
import SearchModal from './SearchModal';

function Header() {
  const { user, logout } = useUserDataStore();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  function logoutHandler(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    mutate();
  }

  // Ctrl+K / Cmd+K shortcut
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
      <div className="navbar transition duration-200 bg-neutral/85 hover:bg-neutral/100 text-neutral-content absolute w-full z-40 max-h-32">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <Menu className="h-6 w-6" />
            </div>
            {user ? (
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content mt-3 z-[50] p-3 shadow-xl bg-base-100 text-base-content rounded-xl w-72 border border-base-300 max-h-96 overflow-y-auto"
              >
                {isAdmin && (
                  <>
                    <li>
                      <Link
                        to="/admin"
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <ShieldUser className="w-4 h-4" />
                        Admin
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
                    Navigation
                  </span>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/stats`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <ChartLine className="w-4 h-4" />
                    Stats
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <BarChart className="w-4 h-4" />
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to="/clubs"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Clubs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/calculator"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Calculator className="w-4 h-4" />
                    Calculator
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/list`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <List className="w-4 h-4" />
                    Immersion List
                  </Link>
                </li>
                <li>
                  <Link
                    to="/texthooker"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <FileText className="w-4 h-4" />
                    Texthooker
                  </Link>
                </li>

                {/* Account Section */}
                <li>
                  <div className="divider my-1"></div>
                </li>
                <li className="menu-title px-2">
                  <span className="text-xs font-bold text-base-content/70">
                    Account
                  </span>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </li>
                <li>
                  <a
                    onClick={logoutHandler}
                    className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                  >
                    <LogOut className="text-lg w-4 h-4" />
                    Logout
                  </a>
                </li>
              </ul>
            ) : (
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content mt-3 z-[50] p-3 shadow-xl bg-base-100 text-base-content rounded-xl w-72 border border-base-300"
              >
                <li>
                  <Link
                    to="/"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <House className="text-lg" />
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Star className="text-lg" />
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <BarChart className="w-4 h-4" />
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <Info className="text-lg" />
                    About
                  </Link>
                </li>
              </ul>
            )}
          </div>
          <Link className="btn btn-ghost text-xl hidden sm:flex" to="/">
            NihongoTracker
          </Link>
          <Link className="btn btn-ghost text-base sm:hidden" to="/">
            NT
          </Link>
        </div>
        {user ? (
          <div className="hidden lg:inline-flex">
            {/* <QuickLog /> */}
            <ul className="inline-flex flex-row gap-6">
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to={`/user/${user.username}/stats`}
                >
                  Stats
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/ranking"
                >
                  Ranking
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/clubs"
                >
                  Clubs
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/calculator"
                >
                  Calculator
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to={`/user/${user.username}/list`}
                >
                  Immersion List
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/texthooker"
                >
                  Texthooker
                </Link>
              </li>
            </ul>
          </div>
        ) : (
          <div className="navbar-center hidden lg:flex">
            <ul className="inline-flex flex-row gap-6">
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/features"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/ranking"
                >
                  Ranking
                </Link>
              </li>
              <li>
                <Link
                  className="px-3 py-2 rounded-lg font-medium transition-all duration-300 hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30 whitespace-nowrap"
                  to="/about"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>
        )}

        <div className="navbar-end gap-1 sm:gap-3 mx-1 sm:mx-3">
          {/* Search Button */}
          <button
            className="btn btn-ghost btn-sm sm:btn-md gap-2"
            onClick={() => setIsSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
            <span className="hidden lg:inline text-xs text-base-content/50">
              <kbd className="kbd kbd-xs">
                {/Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
                  ? '⌘'
                  : 'Ctrl'}
              </kbd>{' '}
              <kbd className="kbd kbd-xs">K</kbd>
            </span>
          </button>

          {user ? (
            <>
              <Link
                className="btn btn-primary btn-sm sm:btn-md"
                to="/createlog"
              >
                <span className="hidden sm:inline">Create Log</span>
                <span className="inline sm:hidden">Log</span>
              </Link>
              <div className="dropdown dropdown-hover dropdown-bottom dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  className="btn btn-sm sm:btn-md m-1 gap-2 max-w-full"
                >
                  {/* Username: full on md+, truncated on smaller screens to avoid overflow */}
                  <span className="hidden md:inline">{user.username}</span>
                  <span className="inline md:hidden truncate max-w-[5rem]">
                    {user.username}
                  </span>
                  {user?.patreon?.isActive &&
                    user?.patreon?.tier === 'consumer' && (
                      <div
                        className={`badge badge-sm gap-1 max-w-[7rem] overflow-hidden text-ellipsis whitespace-nowrap md:max-w-none md:overflow-visible md:whitespace-normal ${
                          user.patreon.badgeColor === 'rainbow'
                            ? 'badge-rainbow'
                            : user.patreon.badgeColor === 'primary'
                              ? 'badge-primary'
                              : user.patreon.badgeColor === 'secondary'
                                ? 'badge-secondary'
                                : ''
                        }`}
                        style={
                          user.patreon.badgeColor &&
                          user.patreon.badgeColor !== 'rainbow' &&
                          user.patreon.badgeColor !== 'primary' &&
                          user.patreon.badgeColor !== 'secondary'
                            ? {
                                backgroundColor: user.patreon.badgeColor,
                                color:
                                  user.patreon.badgeTextColor ===
                                    'primary-content' ||
                                  user.patreon.badgeTextColor ===
                                    'secondary-content'
                                    ? undefined
                                    : user.patreon.badgeTextColor || '#ffffff',
                                border: 'none',
                              }
                            : user.patreon.badgeColor === 'rainbow' ||
                                user.patreon.badgeTextColor
                              ? {
                                  color:
                                    user.patreon.badgeTextColor ===
                                      'primary-content' ||
                                    user.patreon.badgeTextColor ===
                                      'secondary-content'
                                      ? undefined
                                      : user.patreon.badgeTextColor ||
                                        undefined,
                                  border:
                                    user.patreon.badgeColor === 'rainbow'
                                      ? 'none'
                                      : undefined,
                                }
                              : {}
                        }
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap md:max-w-none md:overflow-visible md:whitespace-normal">
                          {user.patreon.customBadgeText || 'Consumer'}
                        </span>
                      </div>
                    )}
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[50] menu p-2 shadow-xl bg-base-100 text-base-content rounded-xl w-52 border border-base-300"
                >
                  {isAdmin && (
                    <li>
                      <Link
                        to="/admin"
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <ShieldUser className="w-4 h-4" />
                        Admin
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      to={`/user/${user.username}`}
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={`/settings`}
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/pricing"
                      className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                    >
                      <Heart className="w-4 h-4" />
                      Donate
                    </Link>
                  </li>
                  <li>
                    <a
                      onClick={logoutHandler}
                      className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </a>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <Link className="btn btn-primary btn-sm sm:btn-md" to="/login">
                Sign In
              </Link>
              <Link
                className="btn btn-disabled btn-primary btn-outline btn-sm sm:btn-md"
                to="/register"
              >
                Coming Soon!
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
