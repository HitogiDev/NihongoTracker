import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { haptic } from './haptics';

const HOLD_MS = 450;
const MOVE_TOLERANCE_PX = 10;
/** Holding these elements already has a meaning, or edits text. */
const IGNORED = 'input, textarea, select, [contenteditable="true"], .native-selectable-log';

/** Read the hint that a hover would show on the web. */
function hintFor(target: Element) {
  const tooltip = target.closest<HTMLElement>('.tooltip');
  const tip =
    tooltip?.dataset.tip ??
    tooltip?.querySelector('.tooltip-content')?.textContent ??
    target.closest('[title]')?.getAttribute('title');
  return tip?.trim() || null;
}

/**
 * Native CSS hides daisyUI tooltips and `title` hints, because touch screens have no hover.
 * Holding the element shows the hint in a toast, like an Android tooltip.
 */
export default function NativeTooltipPress() {
  useEffect(() => {
    let timer = 0;
    let startX = 0;
    let startY = 0;
    let shown = false;

    const cancel = () => {
      window.clearTimeout(timer);
      timer = 0;
    };
    const onStart = (event: TouchEvent) => {
      cancel();
      shown = false;
      const target = event.target as Element | null;
      if (event.touches.length !== 1 || !target || target.closest(IGNORED)) return;
      const hint = hintFor(target);
      if (!hint) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      timer = window.setTimeout(() => {
        timer = 0;
        shown = true;
        haptic('light');
        toast.info(hint, { toastId: `hint:${hint}`, autoClose: 3000 });
      }, HOLD_MS);
    };
    const onMove = (event: TouchEvent) => {
      if (!timer) return;
      const dx = Math.abs(event.touches[0].clientX - startX);
      const dy = Math.abs(event.touches[0].clientY - startY);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancel();
    };
    // The hold shows the hint only. It must not also run the action of the element.
    const onClick = (event: MouseEvent) => {
      if (!shown) return;
      shown = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onContextMenu = (event: Event) => {
      if (shown || timer) event.preventDefault();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', cancel);
    document.addEventListener('touchcancel', cancel);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      cancel();
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', cancel);
      document.removeEventListener('touchcancel', cancel);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return null;
}
