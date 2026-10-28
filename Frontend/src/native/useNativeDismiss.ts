import { useEffect, useRef } from 'react';

const DISMISS_EVENT = 'nihongo:native-dismiss';

/**
 * Ask the open overlays to close before the Android back button navigates.
 * Return true when an overlay consumed the back press.
 */
export function dispatchNativeDismiss() {
  return !window.dispatchEvent(new Event(DISMISS_EVENT, { cancelable: true }));
}

/** Close a menu or popover on the Android back button while it is open. */
export function useNativeDismiss(open: boolean, close: () => void) {
  const closeRef = useRef(close);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    if (!open) return undefined;
    const onDismiss = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener(DISMISS_EVENT, onDismiss);
    return () => window.removeEventListener(DISMISS_EVENT, onDismiss);
  }, [open]);
}
