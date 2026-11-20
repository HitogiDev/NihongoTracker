import { useState } from "react";
import { ArrowLeft, Bell, Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserDataStore } from "../store/userData";
import { useNotificationCount } from "../hooks/useNotificationCount";
import { nativeRoute } from "./navigation";
import SearchModal from "../components/SearchModal";
import Button from "../components/ui/Button";
import { useNativeTitleStore } from "./nativeTitle";

/** Form screens keep the header free for the back action and the title. */
const NO_SEARCH_SCREENS = new Set(["auth", "log", "settings", "session"]);

function profileUsername(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "user" && parts[1] && !parts[2]
    ? decodeURIComponent(parts[1])
    : undefined;
}

export default function NativeHeader() {
  const { t } = useTranslation("nav");
  const { pathname, search } = useLocation();
  const user = useUserDataStore((state) => state.user);
  const count = useNotificationCount();
  const route = nativeRoute(pathname, search, user?.username);
  const [searchOpen, setSearchOpen] = useState(false);
  const dataTitle = useNativeTitleStore((state) => state.titles[pathname]);
  // The own profile tab keeps its tab name. Other profiles show the username.
  const foreignProfile = route.tab === "profile" ? undefined : profileUsername(pathname);
  const title =
    route.screen === "auth" && pathname === "/login"
      ? "NihongoTracker"
      : (dataTitle ?? foreignProfile ?? t(route.title));
  const showSearch =
    Boolean(user) && (route.primary || !NO_SEARCH_SCREENS.has(route.screen));
  return (
    <>
      <header className="native-header bg-base-100 text-base-content">
        <div className="navbar min-h-14 h-14 gap-2 px-3">
          {route.parent && (
            <Button
              appearance="ghost"
              size="sm"
              shape="square"
              aria-label={t("native.back")}
              onClick={() =>
                window.dispatchEvent(
                  new Event("nihongo:native-back", { cancelable: true }),
                )
              }
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1
            className="min-w-0 flex-1 truncate text-lg font-semibold"
            data-generic-title={dataTitle || foreignProfile ? undefined : ""}
          >
            {title}
          </h1>
          {showSearch && (
            <Button
              appearance="ghost"
              size="sm"
              shape="square"
              aria-label={t("a11y.search")}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
          {user && route.primary && (
            <>
              <Link
                to="/notifications"
                className="btn btn-ghost btn-sm btn-square relative"
                aria-label={t("a11y.notifications")}
              >
                <Bell className="h-5 w-5" />
                {count > 0 && (
                  <span
                    className="native-notification-dot bg-primary"
                    aria-label={String(count)}
                  />
                )}
              </Link>
              {route.tab === "profile" && (
                <Link
                  to="/settings"
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={t("titles.settings")}
                >
                  <Settings className="h-5 w-5" />
                </Link>
              )}
            </>
          )}
        </div>
      </header>
      {searchOpen && (
        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}
