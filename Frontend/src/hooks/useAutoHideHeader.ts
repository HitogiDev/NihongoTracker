import { useEffect, useRef, useState, type RefObject } from 'react';

/** Keep the header visible near the top of the page. */
const ALWAYS_VISIBLE_UNTIL_PX = 80;
/** Scroll distance in one direction before the header changes. */
const HIDE_AFTER_PX = 16;
const SHOW_AFTER_PX = 8;
/** Programmatic scroll after a navigation must not hide the header. */
const NAVIGATION_GRACE_MS = 600;

/**
 * Hide the header while the user scrolls down. Show it again after a short scroll up.
 * The header stays visible while `suspended` is true or while it contains the focus.
 * It writes `data-site-header` on the root element so that sticky bars can follow the header.
 */
export function useAutoHideHeader(
  headerRef: RefObject<HTMLElement | null>,
  { suspended, resetKey }: { suspended: boolean; resetKey: string },
) {
  const [hidden, setHidden] = useState(false);
  const suspendedRef = useRef(suspended);
  const graceUntil = useRef(0);

  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) setHidden(false);
  }, [suspended]);

  useEffect(() => {
    graceUntil.current = performance.now() + NAVIGATION_GRACE_MS;
    setHidden(false);
  }, [resetKey]);

  useEffect(() => {
    let lastY = window.scrollY;
    let travel = 0;

    // Browsers already send at most one scroll event for each frame.
    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;

      const header = headerRef.current;
      const hasFocus = Boolean(header?.contains(document.activeElement));
      if (
        y <= ALWAYS_VISIBLE_UNTIL_PX ||
        suspendedRef.current ||
        hasFocus ||
        performance.now() < graceUntil.current
      ) {
        travel = 0;
        if (y <= ALWAYS_VISIBLE_UNTIL_PX || suspendedRef.current || hasFocus)
          setHidden(false);
        return;
      }

      // Restart the count when the direction changes.
      if (delta === 0) return;
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > HIDE_AFTER_PX) setHidden(true);
      else if (travel < -SHOW_AFTER_PX) setHidden(false);
    };

    // Keyboard users tab into a hidden header. Show it when it gets the focus.
    const onFocusIn = (event: FocusEvent) => {
      if (headerRef.current?.contains(event.target as Node)) setHidden(false);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [headerRef]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.siteHeader = hidden ? 'hidden' : 'shown';
  }, [hidden]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.siteHeader;
    },
    [],
  );

  return hidden;
}
