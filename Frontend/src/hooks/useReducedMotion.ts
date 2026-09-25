import { useEffect, useState } from 'react';

/**
 * Whether the visitor asked their OS to reduce motion.
 *
 * The animated cosmetics honour `prefers-reduced-motion` in CSS, so a user with
 * the setting on sees them frozen. The settings screen reads this to explain
 * why, instead of letting them think the feature is broken.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
