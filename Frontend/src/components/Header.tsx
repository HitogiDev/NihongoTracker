import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MdLogout,
  MdPerson,
  MdSettings,
  MdBarChart,
  MdLeaderboard,
  MdGroup,
  MdCalculate,
  MdList,
  MdAdminPanelSettings,
  MdHome,
  MdInfo,
  MdStar,
  MdMenu,
  MdFavorite,
} from "react-icons/md";
import { useUserDataStore } from "../store/userData";
import { useMutation } from "@tanstack/react-query";
import { logoutUserFn } from "../api/trackerApi";
import { toast } from "react-toastify";
import { AxiosError } from "axios";
import { logoutResponseType } from "../types";
import Loader from "./Loader";
import { IconContext } from "react-icons";

function Header() {
  const { user, logout } = useUserDataStore();
  const navigate = useNavigate();
  const isAdmin = Array.isArray(user?.roles)
    ? (user?.roles as string[]).includes("admin")
    : user?.roles === "admin";
  const { mutate, isPending } = useMutation({
    mutationFn: logoutUserFn,
    onSuccess: (data: logoutResponseType) => {
      logout();
      useUserDataStore.persist.clearStorage();
      toast.success(data.message);
      navigate("/");
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : "An error occurred");
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
              <MdMenu className="h-6 w-6" />
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
                        <MdAdminPanelSettings className="text-lg" />
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
                    <MdBarChart className="text-lg" />
                    Stats
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdLeaderboard className="text-lg" />
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to="/clubs"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdGroup className="text-lg" />
                    Clubs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/calculator"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdCalculate className="text-lg" />
                    Calculator
                  </Link>
                </li>
                <li>
                  <Link
                    to={`/user/${user.username}/list`}
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdList className="text-lg" />
                    Immersion List
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
                    <MdPerson className="text-lg" />
                    Profile
                  </Link>
                </li>
                <li>
                  <Link
                    to="/settings"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdSettings className="text-lg" />
                    Settings
                  </Link>
                </li>
                <li>
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
                className="menu menu-sm dropdown-content mt-3 z-[50] p-3 shadow-xl bg-base-100 text-base-content rounded-xl w-72 border border-base-300"
              >
                <li>
                  <Link
                    to="/"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdHome className="text-lg" />
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdStar className="text-lg" />
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    to="/ranking"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdLeaderboard className="text-lg" />
                    Ranking
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                  >
                    <MdInfo className="text-lg" />
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
                  className="btn btn-sm sm:btn-md m-1 gap-2"
                >
                  {user.username}
                  {user?.patreon?.isActive &&
                    user?.patreon?.tier === "consumer" && (
                      <div
                        className={`badge badge-sm gap-1 ${
                          user.patreon.badgeColor === "rainbow"
                            ? "badge-rainbow"
                            : user.patreon.badgeColor === "primary"
                              ? "badge-primary"
                              : user.patreon.badgeColor === "secondary"
                                ? "badge-secondary"
                                : ""
                        }`}
                        style={
                          user.patreon.badgeColor &&
                          user.patreon.badgeColor !== "rainbow" &&
                          user.patreon.badgeColor !== "primary" &&
                          user.patreon.badgeColor !== "secondary"
                            ? {
                                backgroundColor: user.patreon.badgeColor,
                                color:
                                  user.patreon.badgeTextColor ===
                                    "primary-content" ||
                                  user.patreon.badgeTextColor ===
                                    "secondary-content"
                                    ? undefined
                                    : user.patreon.badgeTextColor || "#ffffff",
                                border: "none",
                              }
                            : user.patreon.badgeColor === "rainbow" ||
                                user.patreon.badgeTextColor
                              ? {
                                  color:
                                    user.patreon.badgeTextColor ===
                                      "primary-content" ||
                                    user.patreon.badgeTextColor ===
                                      "secondary-content"
                                      ? undefined
                                      : user.patreon.badgeTextColor ||
                                        undefined,
                                  border:
                                    user.patreon.badgeColor === "rainbow"
                                      ? "none"
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
                        <span className="font-bold">
                          {user.patreon.customBadgeText || "Consumer"}
                        </span>
                      </div>
                    )}
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[50] menu p-2 shadow-xl bg-base-100 text-base-content rounded-xl w-52 border border-base-300"
                >
                  <IconContext.Provider
                    value={{ className: "text-lg currentColor" }}
                  >
                    {isAdmin && (
                      <li>
                        <Link
                          to="/admin"
                          className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                        >
                          <MdAdminPanelSettings />
                          Admin
                        </Link>
                      </li>
                    )}
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
                      <Link
                        to="/support"
                        className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap"
                      >
                        <MdFavorite />
                        Donate
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
    </div>
  );
}

export default Header;
