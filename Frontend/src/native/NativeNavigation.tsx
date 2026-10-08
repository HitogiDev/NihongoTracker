import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { App } from "@capacitor/app";
import { useUserDataStore } from "../store/userData";
import { isNativeApp } from "../utils/nativeRuntime";
import { nativeRoute } from "./navigation";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { NativeDirtyContext } from "./NativeDirtyContext";

const positions = new Map<string, number>();

export default function NativeNavigation({
  children,
}: {
  children: ReactNode;
}) {
  const { t } = useTranslation("nav");
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const user = useUserDataStore((store) => store.user);
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const clearDirty = useCallback(() => {
    dirty.current = false;
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    const route = nativeRoute(pathname, search, user?.username);
    if (!route.primary || !route.tab || route.tab === "home") return;
    try {
      sessionStorage.setItem(
        `nihongo:native:${user?._id}:tab:${route.tab}`,
        `${pathname}${search}`,
      );
    } catch {
      /* The tabs still work without saved filters. */
    }
  }, [pathname, search, user?._id, user?.username]);

  useEffect(() => {
    const onBack = (event: Event) => {
      event.preventDefault();
      const route = nativeRoute(pathname, search, user?.username);
      if (route.primary) {
        if (pathname !== "/") navigate("/", { replace: true });
        else if (isNativeApp()) void App.exitApp();
      } else if (!route.parent) {
        if (isNativeApp()) void App.exitApp();
      } else if (route.screen === "settings" && search) navigate("/settings");
      else if (window.history.state?.idx > 0) navigate(-1);
      else if (state?.nativeFrom) navigate(state.nativeFrom);
      else navigate(route.parent ?? "/login");
    };
    window.addEventListener("nihongo:native-back", onBack);
    return () => window.removeEventListener("nihongo:native-back", onBack);
  }, [pathname, search, state, user?.username, navigate]);

  useLayoutEffect(() => {
    const key = `${user?._id ?? "guest"}:${pathname}${search}`;
    const target = positions.get(key) ?? 0;
    let restoring = true;
    const restore = () => {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) < 2) restoring = false;
    };
    const save = () => {
      if (!restoring) positions.set(key, window.scrollY);
    };
    const stop = () => {
      restoring = false;
    };
    const observer = new ResizeObserver(() => {
      if (restoring) restore();
    });
    const main = document.querySelector("[data-native-main]");
    if (main) observer.observe(main);
    const frame = requestAnimationFrame(restore);
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    return () => {
      if (!restoring) positions.set(key, window.scrollY);
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", save);
      window.removeEventListener("touchstart", stop);
    };
  }, [pathname, search, user?._id]);

  return (
    <NativeDirtyContext.Provider value={{ setDirty, clearDirty }}>
      {children}
      <Modal
        open={blocker.state === "blocked"}
        onClose={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
        title={t("native.unsavedTitle")}
        actions={
          <>
            <Button
              appearance="ghost"
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              {t("native.keepEditing")}
            </Button>
            <Button
              variant="error"
              onClick={() => {
                clearDirty();
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              {t("native.discard")}
            </Button>
          </>
        }
      >
        <p>{t("native.unsavedMessage")}</p>
      </Modal>
    </NativeDirtyContext.Provider>
  );
}
