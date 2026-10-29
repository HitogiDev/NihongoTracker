import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import queryClient from "../queryClient";
import { syncOfflineQueue } from "../offline/offlineQueue";
import { haptic } from "./haptics";

const TRIGGER_DISTANCE = 72;
const MAX_DISTANCE = 120;
const MIN_REFRESH_MS = 600;
/** Pulling inside these elements scrolls or edits their content. */
const IGNORED_START =
  'input, textarea, select, [contenteditable="true"], [data-no-pull], .overflow-x-auto, .carousel';
/** Forms keep their draft, so a pull gesture there only gets in the way. */
const IGNORED_SCREENS = new Set(["log", "auth"]);

/**
 * Refresh the active queries when the user pulls the page down from its top.
 * One gesture handler covers every list, so screens need no extra code.
 */
export default function PullToRefresh() {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let state: "idle" | "tracking" | "pulling" = "idle";
    let current = 0;

    const reset = () => {
      state = "idle";
      current = 0;
      setDistance(0);
    };
    const canStart = (target: EventTarget | null) => {
      if (busy.current || window.scrollY > 0) return false;
      if (document.querySelector("dialog[open], dialog.modal-open"))
        return false;
      const screen = document.querySelector<HTMLElement>("[data-native-screen]")
        ?.dataset.nativeScreen;
      if (screen && IGNORED_SCREENS.has(screen)) return false;
      return !(target as Element | null)?.closest?.(IGNORED_START);
    };
    const refresh = async () => {
      busy.current = true;
      haptic("medium");
      setRefreshing(true);
      setDistance(TRIGGER_DISTANCE);
      await Promise.allSettled([
        syncOfflineQueue(),
        queryClient.refetchQueries({ type: "active" }),
        new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_MS)),
      ]);
      busy.current = false;
      setRefreshing(false);
      reset();
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !canStart(event.target)) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      state = "tracking";
    };
    const onMove = (event: TouchEvent) => {
      if (state === "idle") return;
      const dy = event.touches[0].clientY - startY;
      const dx = Math.abs(event.touches[0].clientX - startX);
      if (state === "tracking") {
        if (dy < -8 || dx > 12) return reset();
        if (dy < 8 || dy < dx * 1.5) return;
        state = "pulling";
      }
      if (window.scrollY > 0) return reset();
      const next = Math.min(MAX_DISTANCE, dy * 0.5);
      if (current < TRIGGER_DISTANCE && next >= TRIGGER_DISTANCE)
        haptic("light");
      current = next;
      setDistance(next);
    };
    const onEnd = () => {
      if (state === "pulling" && current >= TRIGGER_DISTANCE) {
        state = "idle";
        void refresh();
      } else if (state !== "idle") {
        reset();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", reset);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, []);

  if (distance <= 0 && !refreshing) return null;
  const progress = Math.min(1, distance / TRIGGER_DISTANCE);
  return (
    <div
      className="native-pull-indicator pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-base-100 text-primary shadow-lg"
        style={{
          opacity: progress,
          transform: `translateY(${distance - 40}px)`,
        }}
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </span>
    </div>
  );
}
