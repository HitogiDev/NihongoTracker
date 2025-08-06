import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdLogout, MdPerson, MdSettings } from 'react-icons/md';
import { useUserDataStore } from '../store/userData';
import { useMutation } from '@tanstack/react-query';
import { logoutUserFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { logoutResponseType } from '../types';
import Loader from './Loader';
import { IconContext } from 'react-icons';

function Header() {
  const { user, logout } = useUserDataStore();
  const navigate = useNavigate();

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

  return (
    <div className="relative">
      <div className="navbar transition duration-200 bg-neutral/85 hover:bg-neutral/100 text-neutral-content absolute w-full z-40 max-h-32">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h8m-8 6h16"
                />
              </svg>
            </div>
            {user ? (
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content mt-3 z-[50] p-2 shadow-xl bg-base-100 text-base-content rounded-xl w-64 border border-base-300"
              >
                <li>
                  <Link
                    to="/goals"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Goals
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/list`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Immersion List
                  </Link>
                </li>
                <li>{/* <QuickLog /> */}</li>
                <li className="lg:hidden">
                  <Link
                    to={`/user/${user.username}`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdPerson className="text-lg" />
                    Profile
                  </Link>
                </li>
                <li className="lg:hidden">
                  <Link
                    to="/settings"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdSettings className="text-lg" />
                    Settings
                  </Link>
                </li>
                <li className="lg:hidden">
                  <a
                    onClick={logoutHandler}
                    className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                  >
                    <MdLogout className="text-lg" />
                    Logout
                  </a>
                </li>
              </ul>
            ) : (
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content mt-3 z-[50] p-2 shadow-xl bg-base-100 text-base-content rounded-xl w-64 border border-base-300"
              >
                <li>
                  <Link
                    to="/"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
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
                  to="/goals"
                >
                  Goals
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
                  to={`/user/${user.username}/list`}
                >
                  Immersion List
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
          {user ? (
            <>
              <Link
                className="btn btn-primary btn-sm sm:btn-md"
                to="/createlog"
              >
                Create Log
              </Link>
              <div className="dropdown dropdown-hover dropdown-bottom dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  className="btn btn-sm sm:btn-md m-1"
                >
                  {user.username}
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[50] menu p-2 shadow-xl bg-base-100 text-base-content rounded-xl w-52 border border-base-300"
                >
                  <IconContext.Provider
                    value={{ className: 'text-lg currentColor' }}
                  >
                    <li>
                      <Link
                        to={`/user/${user.username}`}
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <MdPerson />
                        Profile
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={`/settings`}
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <MdSettings />
                        Settings
                      </Link>
                    </li>
                    <li>
                      <a
                        onClick={logoutHandler}
                        className="rounded-lg font-medium hover:bg-error/10 hover:text-error transition-all duration-200 whitespace-nowrap"
                      >
                        <MdLogout />
                        Logout
                      </a>
                    </li>
                  </IconContext.Provider>
                </ul>
              </div>
            </>
          ) : (
            <>
              <Link className="btn btn-primary btn-sm sm:btn-md" to="/login">
                Sign In
              </Link>
              <Link
                className="btn btn-primary btn-outline btn-sm sm:btn-md"
                to="/register"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
      {isPending && <Loader />}
    </div>
  );
}

export default Header;
