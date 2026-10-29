import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from '../utils/nativeRuntime';

export type HapticKind = 'light' | 'medium' | 'success' | 'warning';

/** Vibrate for a touch. Devices without a vibration motor ignore the call. */
export function haptic(kind: HapticKind = 'light') {
  if (!isNativeApp()) return;
  const request =
    kind === 'success'
      ? Haptics.notification({ type: NotificationType.Success })
      : kind === 'warning'
        ? Haptics.notification({ type: NotificationType.Warning })
        : Haptics.impact({
            style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
          });
  void request.catch(() => undefined);
}

const TOUCH_TARGETS =
  '.btn, [role="tab"], .dock a, .tab, .toggle, .checkbox, .radio, .join-item';

/**
 * Give every button a light tap. A delegated listener avoids a change in each
 * component. The tap fires on click, so starting a scroll on a button stays
 * silent. Disabled controls and elements that opt out also stay silent.
 */
export function installTouchHaptics() {
  const onClick = (event: MouseEvent) => {
    if ((event as PointerEvent).pointerType === 'mouse') return;
    const target = (event.target as Element | null)?.closest<HTMLElement>(
      TOUCH_TARGETS,
    );
    if (
      !target ||
      target.matches(':disabled, [aria-disabled="true"]') ||
      target.closest('[data-no-haptic]')
    )
      return;
    haptic('light');
  };
  document.addEventListener('click', onClick, { passive: true });
  return () => document.removeEventListener('click', onClick);
}
