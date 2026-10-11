import { useState } from "react";
import { ArrowLeft, Bell, Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserDataStore } from "../store/userData";
import { useNotificationCount } from "../hooks/useNotificationCount";
import { nativeRoute } from "./navigation";
import SearchModal from "../components/SearchModal";
import Button from "../components/ui/Button";
import NativeSupportLink from "./NativeSupportLink";

export default function NativeHeader() {
  const { t } = useTranslation("nav");
  const { pathname, search } = useLocation();
  const user = useUserDataStore((state) => state.user);
  const count = useNotificationCount();
  const route = nativeRoute(pathname, search, user?.username);
  const [searchOpen, setSearchOpen] = useState(false);
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
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
            {route.screen === "auth" && pathname === "/login"
              ? "NihongoTracker"
              : t(route.title)}
          </h1>
          {user && route.primary && (
            <>
              <NativeSupportLink />
              <Button
                appearance="ghost"
                size="sm"
                shape="square"
                aria-label={t("a11y.search")}
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
              {route.tab === "profile" ? (
                <Link
                  to="/settings"
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={t("titles.settings")}
                >
                  <Settings className="h-5 w-5" />
                </Link>
              ) : (
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
