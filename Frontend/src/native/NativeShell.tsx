import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { useUserDataStore } from "../store/userData";
import { useSessionTimerStore } from "../store/sessionTimer";
import { nativeRoute } from "./navigation";
import NativeNavigation from "./NativeNavigation";
import NativeHeader from "./NativeHeader";
import MobileBottomNav from "../components/MobileBottomNav";
import NativeOnboarding from "./NativeOnboarding";
import NativeFab from "./NativeFab";
import NativeSessionBar from "./NativeSessionBar";
import PullToRefresh from "./PullToRefresh";
import NativePushPrompt from "./NativePushPrompt";
import NativeTooltipPress from "./NativeTooltipPress";
import { useNativeOnboardingStore } from "./onboardingStore";

export default function NativeShell() {
  const { pathname, search } = useLocation();
  const user = useUserDataStore((store) => store.user);
  const hasSession = useSessionTimerStore((store) => Boolean(store.state));
  const onboardingStep = useNativeOnboardingStore((store) =>
    user ? store.steps[user._id] : undefined,
  );
  const route = nativeRoute(pathname, search, user?.username);
  const dock = Boolean(user && route.primary);
  if (user && ["/login", "/register"].includes(pathname))
    return <Navigate to="/" replace />;
  if (user && onboardingStep !== undefined)
    return <NativeOnboarding key={user._id} account={user._id} />;
  return (
    <NativeNavigation key={user?._id ?? "guest"}>
      <div
        className={dock ? "native-shell native-shell-dock" : "native-shell"}
        data-native-screen={route.screen}
        data-native-session={user && hasSession && pathname !== "/session" ? "true" : undefined}
      >
        <NativeHeader />
        <main
          className="native-content min-w-0 flex-1 bg-base-200"
          data-native-main
        >
          {route.screen === "home" && <NativePushPrompt />}
          <Outlet key={route.screen === "settings" ? search : undefined} />
        </main>
        {user && <NativeSessionBar />}
        <ToastContainer autoClose={2500} position="top-center" />
        <PullToRefresh />
        <NativeTooltipPress />
        <NativeFab />
        {dock && <MobileBottomNav />}
      </div>
    </NativeNavigation>
  );
}
